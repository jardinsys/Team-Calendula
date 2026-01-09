// Authentication Routes
// Handles Discord OAuth and session management

const express = require('express');
const passport = require('passport');
const router = express.Router();

const { generateToken, authMiddleware } = require('../middleware/auth');
const User = require('../../schemas/user');
const System = require('../../schemas/system');
const config = require('../../../config.json');

// ===========================================
// DISCORD OAUTH
// ===========================================

// Initiate Discord OAuth login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/login?error=auth_failed' }),
    async (req, res) => {
        try {
            // Generate JWT for the user
            const token = generateToken(req.user);
            
            // Redirect to webapp with token
            const webappOrigin = config.webapp?.origin || 'http://localhost:5173';
            res.redirect(`${webappOrigin}/auth/callback?token=${token}`);
        } catch (err) {
            console.error('[Auth] Callback error:', err);
            res.redirect('/login?error=token_failed');
        }
    }
);

// ===========================================
// USER INFO
// ===========================================

// Get current authenticated user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        let system = null;
        let userType = 'basic'; // Default: just notes & friends
        
        if (user.systemID) {
            system = await System.findById(user.systemID);
            
            if (system) {
                // Determine user type based on system settings
                if (system.sys_type?.isSystem) {
                    userType = 'system'; // Full access: alters, states, groups
                } else if (system.sys_type?.isFragmented) {
                    userType = 'fractured'; // States + groups only
                }
            }
        }
        
        res.json({
            user: {
                _id: user._id,
                discordID: user.discordID,
                friendID: user.friendID,
                pronouns: user.pronouns,
                discord: user.discord,
                hasSystem: !!system
            },
            system: system ? {
                _id: system._id,
                name: system.name,
                sys_type: system.sys_type,
                avatar: system.avatar,
                alterSynonym: system.alterSynonym,
                color: system.color
            } : null,
            userType
        });
    } catch (err) {
        console.error('[Auth] Get me error:', err);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ===========================================
// LOGOUT
// ===========================================

router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('[Auth] Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// ===========================================
// TOKEN REFRESH
// ===========================================

router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const token = generateToken(user);
        res.json({ token });
    } catch (err) {
        console.error('[Auth] Refresh error:', err);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

module.exports = router;
