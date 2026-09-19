// Token Routes — API/recovery token management
// Chameleon/api/routes/tokens.js

const express = require('express');
const router = express.Router();
const User = require('../../schemas/user');
const System = require('../../schemas/system');
const { authenticateToken, generateToken: generateJWT } = require('../middleware/auth');
const { generateToken, verifyToken, isTokenExpired } = require('../utils/tokens');

// ==========================================
// POST /api/auth/tokens — Generate new token
// ==========================================
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { label, type = 'user', expiresIn } = req.body;
        const userId = req.user._id;

        if (!['user', 'system'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "user" or "system"' });
        }

        // Enforce max 10 tokens per entity
        const Model = type === 'system' ? System : User;
        const doc = type === 'system'
            ? await System.findById(req.user.systemID)
            : await User.findById(userId);

        if (!doc) {
            return res.status(404).json({ error: `${type === 'system' ? 'System' : 'User'} not found` });
        }

        if (!doc.tokens) doc.tokens = [];

        if (doc.tokens.length >= 10) {
            return res.status(400).json({ error: 'Maximum 10 tokens per account. Revoke an existing token first.' });
        }

        // Generate token
        const { raw, hash } = generateToken(type);

        // Calculate expiry if specified
        let expiresAt = null;
        if (expiresIn) {
            // expiresIn: '30d', '1y', etc.
            const match = expiresIn.match(/^(\d+)([dmy])$/);
            if (match) {
                const amount = parseInt(match[1]);
                const unit = match[2];
                expiresAt = new Date();
                if (unit === 'd') expiresAt.setDate(expiresAt.getDate() + amount);
                else if (unit === 'm') expiresAt.setMonth(expiresAt.getMonth() + amount);
                else if (unit === 'y') expiresAt.setFullYear(expiresAt.getFullYear() + amount);
            }
        }

        // Add token to doc
        doc.tokens.push({
            hash,
            label: label || 'API Token',
            createdAt: new Date(),
            expiresAt,
        });

        await doc.save();

        console.log(`[Tokens] Generated ${type} token "${label || 'API Token'}" for ${type} ${doc._id}`);

        // Return raw token ONCE — this is the only time it's visible
        res.status(201).json({
            token: raw,
            label: label || 'API Token',
            expiresAt,
            message: 'Save this token now. It will not be shown again.',
        });
    } catch (error) {
        console.error('[Tokens] Generate error:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

// ==========================================
// GET /api/auth/tokens — List tokens (labels only)
// ==========================================
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { type = 'user' } = req.query;

        const doc = type === 'system'
            ? await System.findById(req.user.systemID)
            : await User.findById(req.user._id);

        if (!doc) {
            return res.status(404).json({ error: 'Not found' });
        }

        // Never return hashes — only metadata
        const tokens = (doc.tokens || []).map((t, i) => ({
            id: i,
            label: t.label,
            createdAt: t.createdAt,
            expiresAt: t.expiresAt,
            expired: isTokenExpired(t),
        }));

        res.json({ tokens });
    } catch (error) {
        console.error('[Tokens] List error:', error);
        res.status(500).json({ error: 'Failed to list tokens' });
    }
});

// ==========================================
// DELETE /api/auth/tokens/:id — Revoke token
// ==========================================
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { type = 'user' } = req.query;
        const index = parseInt(id);

        if (isNaN(index)) {
            return res.status(400).json({ error: 'Invalid token index' });
        }

        const doc = type === 'system'
            ? await System.findById(req.user.systemID)
            : await User.findById(req.user._id);

        if (!doc) {
            return res.status(404).json({ error: 'Not found' });
        }

        if (!doc.tokens || !doc.tokens[index]) {
            return res.status(404).json({ error: 'Token not found' });
        }

        const removed = doc.tokens.splice(index, 1);
        await doc.save();

        console.log(`[Tokens] Revoked token "${removed[0].label}" from ${type} ${doc._id}`);

        res.json({ message: 'Token revoked', label: removed[0].label });
    } catch (error) {
        console.error('[Tokens] Revoke error:', error);
        res.status(500).json({ error: 'Failed to revoke token' });
    }
});

// ==========================================
// POST /api/auth/tokens/exchange — Exchange raw token for JWT
// ==========================================
router.post('/exchange', async (req, res) => {
    try {
        const { token, type = 'user' } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        if (!['user', 'system'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "user" or "system"' });
        }

        // Validate prefix
        const expectedPrefix = type === 'system' ? 'sys_live_' : 'usr_live_';
        if (!token.startsWith(expectedPrefix)) {
            return res.status(401).json({ error: 'Invalid token format' });
        }

        // Find matching token
        const Model = type === 'system' ? System : User;
        const docs = await Model.find({ 'tokens.hash': { $exists: true, $ne: [] } });

        let matchedDoc = null;
        let matchedTokenIndex = -1;

        for (const doc of docs) {
            if (!doc.tokens) continue;
            for (let i = 0; i < doc.tokens.length; i++) {
                if (verifyToken(token, doc.tokens[i].hash)) {
                    matchedDoc = doc;
                    matchedTokenIndex = i;
                    break;
                }
            }
            if (matchedDoc) break;
        }

        if (!matchedDoc) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check expiry
        if (isTokenExpired(matchedDoc.tokens[matchedTokenIndex])) {
            return res.status(401).json({ error: 'Token expired' });
        }

        // For system tokens, we need the user to generate a JWT
        // System tokens are for system-level operations, but JWTs are user-scoped
        let user = null;
        if (type === 'system') {
            // Find user that owns this system
            user = await User.findOne({ systemID: matchedDoc._id.toString() });
            if (!user) {
                return res.status(404).json({ error: 'No user associated with this system' });
            }
        } else {
            user = matchedDoc;
        }

        // Generate JWT
        const jwt = generateJWT(user);

        console.log(`[Tokens] Exchanged ${type} token for JWT — user ${user._id}`);

        res.json({
            jwt,
            user: {
                _id: user._id,
                discordID: user.discordID,
                systemID: user.systemID,
            },
        });
    } catch (error) {
        console.error('[Tokens] Exchange error:', error);
        res.status(500).json({ error: 'Failed to exchange token' });
    }
});

module.exports = router;
