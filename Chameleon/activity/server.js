// Activity-only Express server
// Serves the Discord embedded app + API routes needed by the activity

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');

const config = require('../config.json');
const { authenticateToken, JWT_SECRET } = require('../api/middleware/auth');
const { subscribeEvents } = require('../redis');

const app = express();
const PORT = config.apiPort || 3001;

// CORS origins: webapp origin, production domain, and Discord proxy origin
const ALLOWED_ORIGINS = [
    config.webapp?.origin,
    'https://systemise.teamcalendula.net',
    `https://${config.discordClientIDs?.system || '1453103517249179719'}.discordsays.com`,
    'https://discord.com',
].filter(Boolean);

app.use(cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(session({
    secret: config.sessionSecret || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

// ==========================================
// DATABASE
// ==========================================

mongoose.connect(config.mongoURIs.system)
    .then(() => console.log('📦 Activity API connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// ==========================================
// ROUTES
// ==========================================

const authRoutes = require('../api/routes/auth');
const systemRoutes = require('../api/routes/system');
const importRoutes = require('../api/routes/import');
const notesRoutes = require('../api/routes/notes');
const alterRoutes = require('../api/routes/alters');
const stateRoutes = require('../api/routes/states');
const groupRoutes = require('../api/routes/groups');
const frontRoutes = require('../api/routes/front');
const friendRoutes = require('../api/routes/friends');
const convertRoutes = require('../api/routes/convert');

// Dev-only routes (before auth router so they take priority)
const User = require('../schemas/user');
const System = require('../schemas/system');
const { generateToken } = require('../api/middleware/auth');

app.post('/api/auth/dev-flush', async (req, res) => {
    try {
        const { discordId } = req.body;
        const id = discordId || '1000000000000000001';
        const user = await User.findOne({ discordID: id });
        if (user) {
            if (user.systemID) {
                await System.findByIdAndDelete(user.systemID);
            }
            await User.findByIdAndDelete(user._id);
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('[Dev Flush] Error:', err);
        res.status(500).json({ error: 'Failed to flush' });
    }
});

app.post('/api/auth/dev-token', async (req, res) => {
    try {
        const { discordId, username } = req.body;
        const id = discordId || '1000000000000000001';
        const name = username || 'MockUser';

        let user = await User.findOne({ discordID: id });
        if (!user) {
            user = new User({
                discordID: id,
                joinedAt: new Date(),
                username: name,
                globalName: name,
                avatar: null,
                discord: { name: { display: name, indexable: name.toLowerCase() } }
            });
            await user.save();
        }

        const token = generateToken(user);
        res.json({
            token,
            user: {
                _id: user._id,
                discordID: user.discordID,
                username: user.username,
                globalName: user.globalName,
                avatar: user.avatar,
                type: user.type || 'basic',
                hasSystem: !!user.systemID,
                systemID: user.systemID
            }
        });
    } catch (err) {
        console.error('[Dev Token] Error:', err);
        res.status(500).json({ error: 'Failed to create dev token' });
    }
});

// Public auth routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Protected routes
app.use('/api/system', authenticateToken, systemRoutes);
app.use('/system', authenticateToken, systemRoutes);
app.use('/api/import', authenticateToken, importRoutes);
app.use('/import', authenticateToken, importRoutes);
app.use('/api/notes', authenticateToken, notesRoutes);
app.use('/notes', authenticateToken, notesRoutes);
app.use('/api/alters', authenticateToken, alterRoutes);
app.use('/alters', authenticateToken, alterRoutes);
app.use('/api/states', authenticateToken, stateRoutes);
app.use('/states', authenticateToken, stateRoutes);
app.use('/api/groups', authenticateToken, groupRoutes);
app.use('/groups', authenticateToken, groupRoutes);
app.use('/api/front', authenticateToken, frontRoutes);
app.use('/front', authenticateToken, frontRoutes);
app.use('/api/friends', authenticateToken, friendRoutes);
app.use('/friends', authenticateToken, friendRoutes);
app.use('/api/convert', authenticateToken, convertRoutes);
app.use('/convert', authenticateToken, convertRoutes);

// Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket status
app.get('/api/ws-status', (req, res) => {
    const systems = {};
    for (const [systemId, clients] of wsClients) {
        systems[systemId] = clients.size;
    }
    res.json({
        totalClients: wss?.clients?.size || 0,
        systems,
        noteRooms: noteRooms.size,
        uptime: process.uptime()
    });
});

// ==========================================
// ACTIVITY STATIC FILES
// ==========================================

const activityDist = path.join(__dirname, '../activity/dist');

app.use('/assets', express.static(path.join(activityDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
}));

// ==========================================
// R2 PROXY — Serves R2 content through activity domain (CSP-safe)
// ==========================================
const https = require('https');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const r2Config = require('../config.json');

const r2ProxyClient = new S3Client({
    region: 'auto',
    endpoint: r2Config.r2?.system?.app?.endpoint || 'https://placeholder.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: r2Config.r2?.system?.app?.accessKeyId || '',
        secretAccessKey: r2Config.r2?.system?.app?.secretAccessKey || '',
    },
});

// Proxy route: /media/r2/* — fetches content from R2 and returns it
app.get('/media/r2/{*any}', async (req, res) => {
    try {
        const r2Path = req.params.any; // everything after /media/r2/
        if (!r2Path) {
            return res.status(400).json({ error: 'No path provided' });
        }

        // Fetch from R2
        const command = new GetObjectCommand({
            Bucket: r2Config.r2.system.app.bucketName,
            Key: r2Path,
        });

        const response = await r2ProxyClient.send(command);
        const content = await response.Body.transformToString();

        // Set appropriate content type
        const contentType = response.ContentType || 'text/plain';
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(content);
    } catch (err) {
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
            return res.status(404).json({ error: 'Content not found' });
        }
        console.error('[R2 Proxy] Error:', err);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

app.use(express.static(activityDist, {
    maxAge: '5m',
}));

// SPA fallback — all non-API routes serve index.html
app.get('{*any}', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(activityDist, 'index.html'));
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((err, req, res, next) => {
    console.error('[Activity API Error]', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==========================================
// WEBSOCKET STATE
// ==========================================

let server = null;
let wss = null;
let heartbeatInterval = null;

// Map<systemId, Set<ws>> — tracks connected clients per system
const wsClients = new Map();

// Note rooms: Map<noteId, Map<userId, { ws, systemId, username, editing }>>
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

// ==========================================
// WEBSOCKET SERVER
// ==========================================

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
        console.log(`[WS] Client connected: systemId=${ws.systemId} userId=${ws.userId} (total: ${wsClients.get(ws.systemId)?.size || 0})`);

        // Subscribe this system's Redis channel
        subscribeEvents(ws.systemId, (event) => {
            broadcastToSystem(ws.systemId, event);
        });

        // Handle note room + system events from this client
        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }

            const { type, noteId } = msg;

            if (type === 'ping') {
                ws.isAlive = true;
                try { ws.send(JSON.stringify({ type: 'pong' })); } catch {}
                return;
            }

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
            console.log(`[WS] Client disconnected: systemId=${ws.systemId} userId=${ws.userId}`);
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
        });

        ws.on('error', () => {
            leaveAllNoteRooms(ws.userId);
            removeClient(ws.systemId, ws);
        });

        // Send initial connection ack
        ws.send(JSON.stringify({ type: 'connected', systemId: ws.systemId }));
    });

    console.log('[WebSocket] Server attached');
}

// ==========================================
// START / STOP
// ==========================================

function start() {
    return new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
            console.log(`🎡 Activity Server running on port ${PORT}`);
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
        if (server) server.close(resolve);
        else resolve();
    });
}

if (require.main === module) {
    start().catch(err => {
        console.error('Failed to start activity server:', err);
        process.exit(1);
    });
}

module.exports = { app, start, stop, PORT, broadcastToSystem };
