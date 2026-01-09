// Authentication Middleware
// Chameleon/webapp/api/middleware/auth.js

const jwt = require('jsonwebtoken');
const config = require('../../../../config.json');
const User = require('../../../../schemas/user');
const System = require('../../../../schemas/system');

const JWT_SECRET = config.jwtSecret || 'change-this-secret';

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

        // Attach user info to request
        req.user = {
            _id: user._id,
            discordID: user.discordID,
            systemID: user.systemID,
            userType: user.type || 'basic'
        };

        // If user has a system, attach system info
        if (user.systemID) {
            const system = await System.findById(user.systemID);
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
    generateToken,
    optionalAuth,
    JWT_SECRET
};