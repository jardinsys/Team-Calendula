// Systemiser API Server
// Handles both Discord bot integration and webapp authentication

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');

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
const config = require('../../config.json');

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

const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

app.use(cors({
    origin: config.webapp?.origin || 'http://localhost:5173',
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

app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/alters', altersRoutes);
app.use('/api/states', statesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/front', frontRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/quick', quickRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        service: 'Systemiser API'
    });
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
