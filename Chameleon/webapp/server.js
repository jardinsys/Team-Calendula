// Systemiser Webapp API Server
// Chameleon/webapp/server.js

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const config = require('../config.json');
const { JWT_SECRET } = require('../api/middleware/auth');
const { subscribeEvents, broadcastLocal } = require('../redis');

const app = express();
const PORT = config.apiPort || 3001;

// ==========================================
// MIDDLEWARE
// ==========================================

// CORS - Allow webapp origin
app.use(cors({
    origin: config.webapp?.origin || 'https://systemise.teamcalendula.net',
    credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Session middleware (for OAuth flow)
app.use(session({
    secret: config.sessionSecret || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// ==========================================
// DATABASE CONNECTION
// ==========================================

// Use the system MongoDB URI
const mongoURI = config.mongoURIs.system;

mongoose.connect(mongoURI)
    .then(() => console.log('📦 Webapp API connected to MongoDB'))
    .catch(err => console.error('❌ Webapp MongoDB connection error:', err));

// ==========================================
// API ROUTES
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (Discord OAuth)
const authRoutes = require('../api/routes/auth');
app.use('/api/auth', authRoutes);

// Protected routes (require authentication)
const { authenticateToken } = require('../api/middleware/auth');

// System routes
const systemRoutes = require('../api/routes/system');
app.use('/api/system', authenticateToken, systemRoutes);

// Entity routes
const alterRoutes = require('../api/routes/alters');
const stateRoutes = require('../api/routes/states');
const groupRoutes = require('../api/routes/groups');
app.use('/api/alters', authenticateToken, alterRoutes);
app.use('/api/states', authenticateToken, stateRoutes);
app.use('/api/groups', authenticateToken, groupRoutes);

// Notes routes
const noteRoutes = require('../api/routes/notes');
app.use('/api/notes', authenticateToken, noteRoutes);

// Front routes
const frontRoutes = require('../api/routes/front');
app.use('/api/front', authenticateToken, frontRoutes);

// Quick action routes
const quickRoutes = require('../api/routes/quick');
app.use('/api/quick', authenticateToken, quickRoutes);

const importRoutes = require('../api/routes/import');
app.use('/api/import', authenticateToken, importRoutes);

// Friends routes
const friendsRoutes = require('../api/routes/friends');
app.use('/api/friends', authenticateToken, friendsRoutes);

// User account routes (wipe data, delete account)
const userRoutes = require('../api/routes/user');
app.use('/api/user', authenticateToken, userRoutes);

// Public routes (optional auth — privacy-gated entity view)
const publicRoutes = require('../api/routes/public');
app.use('/api/public', publicRoutes);

// Activity pending page — reads + clears Redis key set by bot commands
const redis = require('../redis');
app.get('/api/activity/pending-page', authenticateToken, async (req, res) => {
    try {
        const key = `pendingActivity:${req.user._id}`;
        const page = await redis.get(key);
        if (page) {
            await redis.del(key);
            return res.json({ page });
        }
        res.json({ page: null });
    } catch (err) {
        console.error('[Activity] Pending page error:', err);
        res.json({ page: null });
    }
});

// ==========================================
// STATIC FILES
// ==========================================

// Activity static files — built from Chameleon/activity/
// Assets are referenced as /assets/* from index.html, served at root level
app.use('/assets', express.static(path.join(__dirname, '../activity/dist/assets')));

// Activity assets — also serve from /discord_activity/assets/ for Discord CDN proxy
app.use('/discord_activity/assets', express.static(path.join(__dirname, '../activity/dist/assets')));

// Activity SPA — serve index.html for /discord_activity and all subpaths
// IMPORTANT: Must come AFTER the /discord_activity/assets static middleware
// so that asset requests don't hit this catch-all
app.get('/discord_activity', (req, res) => {
    res.sendFile(path.join(__dirname, '../activity/dist', 'index.html'));
});
app.get('/discord_activity/{*any}', (req, res) => {
    if (!req.path.startsWith('/discord_activity/assets')) {
        res.sendFile(path.join(__dirname, '../activity/dist', 'index.html'));
    }
});

// Discord Activity at root — detect via frame_id query param
// Enables URL Mapping with Target set to root URL: https://systemise.teamcalendula.net
app.use('/', (req, res, next) => {
    if (req.query.frame_id && (req.path === '/' || req.path === '')) {
        return res.sendFile(path.join(__dirname, '../activity/dist', 'index.html'));
    }
    next();
});

// Serve built webapp in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // Handle webapp React routing - serve index.html for all non-API, non-activity routes
    app.get('{*any}', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/discord_activity')) return;
        // If this request has frame_id, it's a Discord Activity — serve activity SPA
        if (req.query.frame_id) {
            return res.sendFile(path.join(__dirname, '../activity/dist', 'index.html'));
        }
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler for API routes (Express 5 — catches any unmatched /api/*)
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({ 
        error: err.message || 'Internal server error' 
    });
});

// ==========================================
// START SERVER + WEBSOCKET
// ==========================================

let server = null;
let wss = null;
let heartbeatInterval = null;

// Map<systemId, Set<ws>> — tracks connected clients per system
const wsClients = new Map();

// ==========================================
// NOTE ROOMS — real-time collaboration presence
// Map<noteId, Map<userId, { ws, systemId, username, editing }>>
// ==========================================
const noteRooms = new Map();

function addClient(systemId, ws) {
    if (!wsClients.has(systemId)) wsClients.set(systemId, new Set());
    wsClients.get(systemId).add(ws);
}

function removeClient(systemId, ws) {
    const clients = wsClients.get(systemId);
    if (clients) {
        clients.delete(ws);
        if (clients.size === 0) wsClients.delete(systemId);
    }
}

function broadcastToSystem(systemId, event) {
    const clients = wsClients.get(systemId);
    if (!clients || !clients.size) return;
    const data = JSON.stringify(event);
    for (const ws of clients) {
        if (ws.readyState === 1) ws.send(data);
    }
}

// ==========================================
// NOTE ROOM HELPERS
// ==========================================

function joinNoteRoom(noteId, userId, data) {
    if (!noteRooms.has(noteId)) noteRooms.set(noteId, new Map());
    noteRooms.get(noteId).set(userId, data);
}

function leaveNoteRoom(noteId, userId) {
    const room = noteRooms.get(noteId);
    if (!room) return;
    room.delete(userId);
    if (room.size === 0) noteRooms.delete(noteId);
}

function leaveAllNoteRooms(userId) {
    for (const [noteId, room] of noteRooms) {
        room.delete(userId);
        if (room.size === 0) noteRooms.delete(noteId);
    }
}

function getNoteRoomUsers(noteId) {
    const room = noteRooms.get(noteId);
    if (!room) return [];
    return Array.from(room.entries()).map(([uid, d]) => ({
        userId: uid, username: d.username, editing: d.editing
    }));
}

function broadcastToNoteRoom(noteId, event, excludeUserId) {
    const room = noteRooms.get(noteId);
    if (!room) return;
    const data = JSON.stringify(event);
    for (const [uid, entry] of room) {
        if (uid === excludeUserId) continue;
        if (entry.ws.readyState === 1) entry.ws.send(data);
    }
}

// Wire Redis local broadcasts to WebSocket clients
// (API-originated events: notes, friends, etc.)
const { publishEvent } = require('../redis');

function setupWebSocket(serverInstance) {
    wss = new WebSocketServer({ noServer: true });

    serverInstance.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            ws.userId = decoded.userId;
            ws.systemId = decoded.systemId || null;
            wss.emit('connection', ws, request);
        });
    });

    // Heartbeat: ping every 30s, terminate if no pong in 10s
    heartbeatInterval = setInterval(() => {
        if (!wss) return;
        for (const ws of wss.clients) {
            if (ws.isAlive === false) {
                leaveAllNoteRooms(ws.userId);
                ws.terminate();
                continue;
            }
            ws.isAlive = false;
            ws.ping();
        }
    }, 30000);

    wss.on('connection', async (ws) => {
        // Look up the user's systemID if not in JWT
        if (!ws.systemId) {
            try {
                const User = require('../schemas/user');
                const user = await User.findById(ws.userId).select('systemID');
                ws.systemId = user?.systemID?.toString() || null;
            } catch (err) {
                console.error('[WS] Failed to resolve systemId:', err.message);
            }
        }

        if (!ws.systemId) {
            ws.close(4000, 'No system');
            return;
        }

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        addClient(ws.systemId, ws);

        // Subscribe this system's Redis channel
        subscribeEvents(ws.systemId);

        // Also listen for local (same-process) broadcasts
        const unsub = subscribeEvents(ws.systemId, (event) => {
            broadcastToSystem(ws.systemId, event);
        });

        // Handle note room + system events from this client
        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }

            const { type, noteId } = msg;

            if (type === 'note:open' && noteId) {
                const username = msg.username || ws.userId;
                joinNoteRoom(noteId, ws.userId, {
                    ws, systemId: ws.systemId, username, editing: false
                });
                broadcastToNoteRoom(noteId, {
                    type: 'note:presence',
                    noteId,
                    users: getNoteRoomUsers(noteId)
                });
            }

            if (type === 'note:close' && noteId) {
                leaveNoteRoom(noteId, ws.userId);
                broadcastToNoteRoom(noteId, {
                    type: 'note:presence',
                    noteId,
                    users: getNoteRoomUsers(noteId)
                });
            }

            if (type === 'note:focus' && noteId) {
                const room = noteRooms.get(noteId);
                const entry = room?.get(ws.userId);
                if (entry) entry.editing = true;
                broadcastToNoteRoom(noteId, {
                    type: 'note:editing',
                    noteId, userId: ws.userId,
                    username: entry?.username || ws.userId,
                    editing: true
                }, ws.userId);
            }

            if (type === 'note:blur' && noteId) {
                const room = noteRooms.get(noteId);
                const entry = room?.get(ws.userId);
                if (entry) entry.editing = false;
                broadcastToNoteRoom(noteId, {
                    type: 'note:editing',
                    noteId, userId: ws.userId,
                    username: entry?.username || ws.userId,
                    editing: false
                }, ws.userId);
            }

            if (type === 'note:saved' && noteId) {
                broadcastToNoteRoom(noteId, {
                    type: 'note:saved',
                    noteId, userId: ws.userId,
                    username: msg.username || ws.userId,
                    timestamp: Date.now()
                }, ws.userId);
            }
        });

        ws.on('close', () => {
            // Capture rooms before leaving so we can broadcast departure
            const roomsToNotify = [];
            for (const [noteId, room] of noteRooms) {
                if (room.has(ws.userId)) roomsToNotify.push(noteId);
            }
            leaveAllNoteRooms(ws.userId);
            for (const noteId of roomsToNotify) {
                broadcastToNoteRoom(noteId, {
                    type: 'note:presence',
                    noteId,
                    users: getNoteRoomUsers(noteId)
                });
            }
            removeClient(ws.systemId, ws);
            unsub();
        });

        ws.on('error', () => {
            leaveAllNoteRooms(ws.userId);
            removeClient(ws.systemId, ws);
            unsub();
        });

        // Send initial connection ack
        ws.send(JSON.stringify({ type: 'connected', systemId: ws.systemId }));
    });

    console.log('[WebSocket] Server attached');
}

function start() {
    return new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
            console.log(`🌐 Webapp API running on port ${PORT}`);
            setupWebSocket(server);
            resolve(server);
        }).on('error', reject);
    });
}

function stop() {
    return new Promise((resolve) => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (wss) {
            for (const ws of wss.clients) ws.close();
        }
        if (server) {
            server.close(resolve);
        } else {
            resolve();
        }
    });
}

// Auto-start if run directly
if (require.main === module) {
    start().catch(err => {
        console.error('Failed to start webapp server:', err);
        process.exit(1);
    });
}

module.exports = { app, start, stop, PORT, broadcastToSystem };
