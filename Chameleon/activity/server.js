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
const { subscribeEvents, broadcastLocal } = require('../redis');

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
app.use(express.json());
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

// Public auth routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Protected routes
app.use('/api/system', authenticateToken, systemRoutes);
app.use('/system', authenticateToken, systemRoutes);
app.use('/api/import', authenticateToken, importRoutes);
app.use('/import', authenticateToken, importRoutes);

// Health
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// ACTIVITY STATIC FILES
// ==========================================

const activityDist = path.join(__dirname, '../activity/dist');

app.use('/assets', express.static(path.join(activityDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
}));

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
// START SERVER
// ==========================================

let server = null;
let wss = null;

function start() {
    return new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
            console.log(`🎡 Activity Server running on port ${PORT}`);
            resolve(server);
        }).on('error', reject);
    });
}

function stop() {
    return new Promise((resolve) => {
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

module.exports = { app, start, stop, PORT };
