// Authentication Middleware
// Chameleon/webapp/api/middleware/auth.js

const jwt = require('jsonwebtoken');
const config = require('../../config.json');
const User = require('../../schemas/user');
const System = require('../../schemas/system');

const JWT_SECRET = config.jwtSecret || 'change-this-secret';

// Cache system lookups to avoid DB hit on every request (30s TTL)
const systemCache = new Map();
const SYSTEM_CACHE_TTL = 30 * 1000;

async function getCachedSystem(systemId) {
    const cached = systemCache.get(systemId);
    if (cached && Date.now() - cached.time < SYSTEM_CACHE_TTL) return cached.system;
    const system = await System.findById(systemId);
    systemCache.set(systemId, { system, time: Date.now() });
    return system;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticateToken(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired' });
            }
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Cleanup orphan users: no systemID and older than 30 days
        if (!user.systemID && user.createdAt) {
            const daysSinceCreation = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceCreation > 30) {
                console.log(`[Auth] Cleaning up orphan user ${user._id} (no system, created ${Math.floor(daysSinceCreation)} days ago)`);
                await User.findByIdAndDelete(user._id);
                return res.status(401).json({ error: 'Account expired. Please register again.' });
            }
        }

        // Attach user info to request
        req.user = {
            _id: user._id,
            discordID: user.discordID,
            systemID: user.systemID,
            userType: user.type || 'basic'
        };

        // If user has a system, attach system info
        if (user.systemID) {
            const system = await getCachedSystem(user.systemID);
            if (system) {
                req.system = system;
            }
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            discordID: user.discordID
        },
        JWT_SECRET,
        { expiresIn: '7d' } // Token valid for 7 days
    );
}

/**
 * Optional auth - doesn't fail if no token, just doesn't attach user
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (user) {
                req.user = {
                    _id: user._id,
                    discordID: user.discordID,
                    systemID: user.systemID,
                    userType: user.type || 'basic'
                };
            }
        }
    } catch (err) {
        // Ignore errors - user just won't be attached
    }
    next();
}

module.exports = {
    authenticateToken,
    authMiddleware: authenticateToken,
    generateToken,
    optionalAuth,
    optionalAuthMiddleware: optionalAuth,
    JWT_SECRET
};