// Systemiser API Server
// Handles both Discord bot integration and webapp authentication

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const path = require('path');

// MongoDB - reuse existing connection from Chameleon
require("../database");

// Import schemas
const Note = require('../schemas/note');
const System = require('../schemas/system');
const User = require('../schemas/user');
const Alter = require('../schemas/alter');
const State = require('../schemas/state');
const Group = require('../schemas/group');
const { Shift } = require('../schemas/front');
const config = require('../config.json');
const { authenticateToken } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const systemRoutes = require('./routes/system');
const altersRoutes = require('./routes/alters');
const statesRoutes = require('./routes/states');
const groupsRoutes = require('./routes/groups');
const notesRoutes = require('./routes/notes');
const frontRoutes = require('./routes/front');
const friendsRoutes = require('./routes/friends');
const quickRoutes = require('./routes/quick');
const importRoutes = require('./routes/import');
const userRoutes = require('./routes/user');
const publicRoutes = require('./routes/public');
const convertRoutes = require('./routes/convert');

const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

app.use(cors({
    origin: [
        config.webapp?.origin,
        'https://systemise.teamcalendula.net',
        'https://1453103517249179719.discordsays.com'
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json());

// Session configuration
app.use(session({
    secret: config.sessionSecret || 'systemiser-session-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ===========================================
// DISCORD OAUTH STRATEGY
// ===========================================

passport.use(new DiscordStrategy({
    clientID: config.discordOAuth?.clientId,
    clientSecret: config.discordOAuth?.clientSecret,
    callbackURL: config.discordOAuth?.callbackURL || 'http://localhost:3001/api/auth/discord/callback',
    scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Find or create user
        let user = await User.findOne({ discordID: profile.id });

        if (!user) {
            user = new User({
                _id: new mongoose.Types.ObjectId(),
                discordID: profile.id,
                joinedAt: new Date(),
                discord: {
                    name: {
                        display: profile.username,
                        indexable: profile.username.toLowerCase()
                    }
                }
            });
            await user.save();
            console.log(`[Auth] Created new user for Discord ID: ${profile.id}`);
        }

        return done(null, { user, profile, accessToken });
    } catch (err) {
        console.error('[Auth] Discord strategy error:', err);
        return done(err, null);
    }
}));

passport.serializeUser((data, done) => {
    done(null, data.user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ===========================================
// ROUTES
// ===========================================

// Legacy prefixed mounts (keep while callers migrate)
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/alters', altersRoutes);
app.use('/api/states', statesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/front', frontRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/quick', quickRoutes);
app.use('/api/import', importRoutes);
app.use('/api/user', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/convert', convertRoutes);

// Normalized root mounts for same-origin or downstream host usage
app.use('/auth', authRoutes);
app.use('/system', systemRoutes);
app.use('/alters', altersRoutes);
app.use('/states', statesRoutes);
app.use('/groups', groupsRoutes);
app.use('/notes', notesRoutes);
app.use('/front', frontRoutes);
app.use('/friends', friendsRoutes);
app.use('/quick', quickRoutes);
app.use('/import', importRoutes);
app.use('/user', userRoutes);
app.use('/public', publicRoutes);
app.use('/convert', convertRoutes);

// Health check
app.get('/api/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date(), service: 'Systemiser API' }); });
app.get('/health', (req, res) => { res.json({ status: 'ok', timestamp: new Date(), service: 'Systemiser API' }); });

// Activity pending page — reads + clears Redis key set by bot commands
const redis = require('../redis');
app.get('/api/activity/pending-page', authenticateToken, async (req, res) => {
    try {
        const key = `pendingActivity:${req.user._id}`;
        const page = await redis.get(key);
        if (page) { await redis.del(key); return res.json({ page }); }
        res.json({ page: null });
    } catch (err) {
        console.error('[Activity] Pending page error:', err);
        res.json({ page: null });
    }
});

// ===========================================
// ACTIVITY (Embedded App) STATIC FILES
// ===========================================

const activityDist = path.join(__dirname, '../../activity/dist');

app.use('/systemiser/assets', express.static(path.join(activityDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
}));

app.use('/systemiser', express.static(activityDist, {
    maxAge: '5m',
}));

app.get('/systemiser/*', (req, res) => {
    res.sendFile(path.join(activityDist, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[API Error]', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ===========================================
// START SERVER
// ===========================================

const PORT = config.apiPort || 3001;
app.listen(PORT, () => {
    console.log(`🌐 Systemiser API running on port ${PORT}`);
});

module.exports = app;
