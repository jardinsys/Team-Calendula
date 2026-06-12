// Systemiser Webapp API Server
// Chameleon/webapp/server.js

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');

const config = require('../config.json');

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
// START SERVER
// ==========================================

let server = null;

function start() {
    return new Promise((resolve, reject) => {
        server = app.listen(PORT, () => {
            console.log(`🌐 Webapp API running on port ${PORT}`);
            resolve(server);
        }).on('error', reject);
    });
}

function stop() {
    return new Promise((resolve) => {
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

module.exports = { app, start, stop, PORT };
