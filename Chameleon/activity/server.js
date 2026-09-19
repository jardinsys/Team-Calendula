// Activity-only Express server
// Serves the Discord embedded app + API routes needed by the activity

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
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

// Sync status
app.get('/api/ws-status', (req, res) => {
    const wss = getSyncWss();
    res.json({
        totalClients: wss ? wss.clients.size : 0,
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
// SYNC (@robojs/sync) — replaces custom WebSocket layer
// ==========================================
// @robojs/sync owns the /sync protocol (we mount it JWT-gated at /sync on
// Express's own HTTP server, so the Discord proxy needs no new mapping).
// Bridges kept from the old custom layer:
//   - Redis system events -> broadcast on sync key evt.<systemId>
//   - Note presence       -> server-tracked rooms, broadcast on npp.<noteId>
// A client may only watch evt keys for its own system (enforced below).

let syncWss = null;
const evtSeq = new Map();      // systemId -> last seq sent
const sysUnsubs = new Map();   // systemId -> unsubscribe fn from subscribeEvents
const watchers = new Map();    // cleanKey -> Set<ws>  (ours, for routing)
const npRooms = new Map();     // noteId -> Map<userId, {username, editing}>

function cleanKey(keyArr) { return Array.isArray(keyArr) ? keyArr.join('.') : String(keyArr); }

function getSyncWss() {
    return syncWss;
}

// Broadcast a Redis-originated system event to connections watching
// evt.<systemId>. Clients dedupe on seq and map to query keys.
function broadcastSystemEvent(systemId, event) {
    if (!syncWss) return;
    const key = `evt.${systemId}`;
    const set = watchers.get(key);
    if (!set || set.size === 0) return;
    try {
        const seq = (evtSeq.get(key) || 0) + 1;
        evtSeq.set(key, seq);
        const payload = JSON.stringify({ type: 'update', key: ['evt', String(systemId)], data: { seq, event } });
        for (const ws of set) {
            if (ws.readyState === 1) ws.send(payload);
        }
    } catch (err) {
        console.error('[Sync] broadcast failed:', err.message);
    }
}

function broadcastPresence(noteId, lastSaved) {
    if (!syncWss) return;
    const room = npRooms.get(noteId);
    if (!room) return;
    const payload = {
        type: 'update',
        key: ['npp', noteId],
        data: {
            users: Array.from(room.entries()).map(([uid, d]) => ({ userId: uid, username: d.username, editing: d.editing })),
            lastSaved: lastSaved || null
        }
    };
    const set = watchers.get(`npp.${noteId}`);
    if (set) {
        const data = JSON.stringify(payload);
        for (const ws of set) {
            if (ws.readyState === 1) ws.send(data);
        }
    }
}

function setupSync(serverInstance) {
    // Async IIFE: pluginOptions lives in an ESM module with top-level await,
    // so require() is forbidden — import() is mandatory here.
    (async () => {
        const eventsMod = await import('@robojs/server/.robo/build/events/_start.js');
        // SyncServer.start() requires a @robojs/server plugin engine; supply a
        // stub so registration succeeds, then gate + hand off /sync ourselves.
        eventsMod.pluginOptions.engine = { registerWebsocket() {} };

        let SyncServer;
        try {
            const m = await import('@robojs/sync/.robo/build/core/server.js');
            SyncServer = m.SyncServer;
        } catch (err) {
            console.error('[Sync] Failed to load @robojs/sync server:', err.message);
            return;
        }

        try {
            SyncServer.start();
            syncWss = SyncServer.getSocketServer();
        } catch (err) {
            console.error('[Sync] Server start failed:', err.message);
            return;
        }
        syncAttach(serverInstance);
    })().catch(err => {
        console.error('[Sync] Mount failed:', err.message);
    });
}

function syncAttach(serverInstance) {

    // JWT-gated '/sync' upgrade — same host the Discord proxy already allows
    serverInstance.on('upgrade', (req, socket, head) => {
        let url;
        try {
            url = new URL(req.url, `http://${req.headers.host}`);
        } catch {
            return;
        }
        if (url.pathname !== '/sync') return;

        const token = url.searchParams.get('token');
        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        let decoded = null;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        syncWss.handleUpgrade(req, socket, head, (ws) => {
            ws.userId = decoded?.userId || null;
            ws.systemId = null;         // resolved async below
            ws.evtWatch = new Set();    // systems this conn is watching
            ws.npRooms = new Set();     // note rooms this conn has joined
            syncWss.emit('connection', ws, req);
        });
    });

    // Second listener (runs after SyncServer's protocol handler attached
    // its own message/close handlers) — routing, auth scoping, presence.
    syncWss.on('connection', (ws) => {
        // Resolve this user's system once, like the old WS layer did
        (async () => {
            let systemId = null;
            try {
                const user = await User.findById(ws.userId).select('systemID');
                systemId = user?.systemID?.toString() || null;
            } catch (err) {
                console.error('[Sync] Failed to resolve systemId:', err.message);
            }
            if (!systemId || ws.readyState !== 1) return;
            ws.systemId = systemId;
            // Tell the client its identity (userId for self-filtering,
            // systemId for auth-scoped evt watches). Private to this conn.
            try {
                ws.send(JSON.stringify({ type: 'update', key: ['hello'], data: { userId: ws.userId, systemId } }));
            } catch {}
        })();

        ws.on('message', (raw) => {
            let msg;
            try { msg = JSON.parse(raw); } catch { return; }
            const key = Array.isArray(msg.key) ? cleanKey(msg.key) : null;
            if (!key) return;

            // --- Watch bookkeeping + evt auth scoping -------------------
            if (msg.type === 'on' || msg.type === 'off') {
                if (key.startsWith('evt.')) {
                    if (!ws.systemId || key !== `evt.${ws.systemId}`) return; // cross-system forbidden
                    if (msg.type === 'on') addWatcher(key, ws);
                    else removeWatcher(key, ws);
                } else if (key.startsWith('npp.')) {
                    if (msg.type === 'on') addWatcher(key, ws);
                    else removeWatcher(key, ws);
                }
                // everything else ("hello" etc.) — no route needed
                return;
            }

            // --- Note presence writes ----------------------------------
            if (msg.type === 'update' && key.startsWith('np.')) {
                const noteId = key.slice(3);
                if (!noteId) return;

                // Leaving: client navigated away within the same socket
                if (msg.data?.leaving) {
                    const room = npRooms.get(noteId);
                    if (room) {
                        room.delete(ws.userId);
                        if (room.size === 0) npRooms.delete(noteId);
                        else broadcastPresence(noteId);
                    }
                    ws.npRooms.delete(noteId);
                    return;
                }

                ws.npRooms.add(noteId);
                if (!npRooms.has(noteId)) npRooms.set(noteId, new Map());
                npRooms.get(noteId).set(ws.userId, {
                    username: msg.data?.username || ws.userId,
                    editing: !!msg.data?.editing
                });
                broadcastPresence(noteId);

                // Save notification rides the same room update; clients
                // filter out their own userId for the lastSavedBy display.
                if (msg.data?.saved) {
                    broadcastPresence(noteId, {
                        userId: ws.userId,
                        username: msg.data.username || ws.userId,
                        timestamp: Date.now()
                    });
                }
            }
        });

        ws.on('close', () => {
            // Leave all note rooms
            for (const noteId of ws.npRooms) {
                const room = npRooms.get(noteId);
                if (room) {
                    room.delete(ws.userId);
                    if (room.size === 0) {
                        npRooms.delete(noteId);
                    } else {
                        broadcastPresence(noteId);
                    }
                }
            }
            ws.npRooms.clear();
            // Drop evt/npp watches
            for (const key of Array.from(watchers.keys())) {
                const set = watchers.get(key);
                if (set?.has(ws)) removeWatcher(key, ws);
            }
        });
    });

    function addWatcher(cleanK, ws) {
        if (!watchers.has(cleanK)) watchers.set(cleanK, new Set());
        const before = watchers.get(cleanK).size;
        watchers.get(cleanK).add(ws);
        // First live watcher of a system's evt key → subscribe Redis once
        if (cleanK.startsWith('evt.') && before === 0) {
            const systemId = cleanK.slice(4);
            if (!sysUnsubs.has(systemId)) {
                sysUnsubs.set(systemId, subscribeEvents(systemId, (event) => {
                    broadcastSystemEvent(systemId, event);
                }));
            }
        }
    }

    function removeWatcher(cleanK, ws) {
        const set = watchers.get(cleanK);
        if (!set) return;
        set.delete(ws);
        if (set.size === 0) {
            watchers.delete(cleanK);
            if (cleanK.startsWith('evt.')) {
                const systemId = cleanK.slice(4);
                const unsub = sysUnsubs.get(systemId);
                if (unsub) { try { unsub(); } catch (_) {} sysUnsubs.delete(systemId); }
            }
        }
    }

    console.log('[Sync] Server attached at /sync');
}

function start() {
    return new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
            console.log(`🎡 Activity Server running on port ${PORT}`);
            setupSync(server);
            resolve(server);
        }).on('error', reject);
    });
}

function stop() {
    return new Promise((resolve) => {
        if (syncWss) {
            for (const ws of syncWss.clients) ws.close();
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

module.exports = { app, start, stop, PORT };
