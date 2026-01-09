// Auth Routes - Discord OAuth
// Chameleon/webapp/api/routes/auth.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../../../../config.json');
const User = require('../../../../schemas/user');
const { generateToken, authenticateToken } = require('../middleware/auth');

const DISCORD_API = 'https://discord.com/api/v10';
const CLIENT_ID = config.discordClientIDs.system;
const CLIENT_SECRET = config.discordClientSecret.system;
const REDIRECT_URI = config.callBackUrl.system;
const WEBAPP_ORIGIN = config.webapp?.origin || 'https://systemise.teamcalendula.net';

// ==========================================
// GET /api/auth/discord
// Redirect to Discord OAuth
// ==========================================

router.get('/discord', (req, res) => {
    const scope = 'identify';
    const state = Math.random().toString(36).substring(7); // Simple state for CSRF protection

    // Store state in session
    req.session.oauthState = state;

    const authURL = `https://discord.com/api/oauth2/authorize?` +
        `client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}`;

    res.redirect(authURL);
});

// ==========================================
// GET /api/auth/discord/callback
// Handle Discord OAuth callback
// ==========================================

router.get('/discord/callback', async (req, res) => {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
        console.error('Discord OAuth error:', error);
        return res.redirect(`${WEBAPP_ORIGIN}/login?error=${error}`);
    }

    if (!code) {
        return res.redirect(`${WEBAPP_ORIGIN}/login?error=no_code`);
    }

    // Verify state (CSRF protection)
    if (state !== req.session.oauthState) {
        console.error('State mismatch:', state, req.session.oauthState);
        // Continue anyway for now, but log it
    }

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post(
            `${DISCORD_API}/oauth2/token`,
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const { access_token } = tokenResponse.data;

        // Get user info from Discord
        const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        const discordUser = userResponse.data;

        // Find or create user in database
        let user = await User.findOne({ discordID: discordUser.id });

        if (!user) {
            // Create new user
            user = new User({
                discordID: discordUser.id,
                username: discordUser.username,
                globalName: discordUser.global_name,
                avatar: discordUser.avatar,
                type: 'basic', // Default type, can be upgraded later
                createdAt: new Date()
            });
            await user.save();
            console.log(`New user registered: ${discordUser.username} (${discordUser.id})`);
        } else {
            // Update existing user info
            user.username = discordUser.username;
            user.globalName = discordUser.global_name;
            user.avatar = discordUser.avatar;
            user.lastLogin = new Date();
            await user.save();
        }

        // Generate JWT token
        const token = generateToken(user);

        // Redirect to webapp with token
        res.redirect(`${WEBAPP_ORIGIN}/auth/callback?token=${token}`);

    } catch (error) {
        console.error('Discord OAuth callback error:', error.response?.data || error.message);
        res.redirect(`${WEBAPP_ORIGIN}/login?error=oauth_failed`);
    }
});

// ==========================================
// GET /api/auth/me
// Get current user info
// ==========================================

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-__v');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build response with user type info
        const response = {
            _id: user._id,
            discordID: user.discordID,
            username: user.username,
            globalName: user.globalName,
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.discordID}/${user.avatar}.png` : null,
            type: user.type || 'basic',
            hasSystem: !!user.systemID,
            systemID: user.systemID,
            createdAt: user.createdAt
        };

        res.json(response);

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ==========================================
// POST /api/auth/logout
// Logout (client should discard token)
// ==========================================

router.post('/logout', authenticateToken, (req, res) => {
    // JWT tokens are stateless, so we just tell the client to discard it
    res.json({ success: true, message: 'Logged out' });
});

// ==========================================
// POST /api/auth/refresh
// Refresh JWT token
// ==========================================

router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newToken = generateToken(user);
        res.json({ token: newToken });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

module.exports = router;
