// Authentication Middleware
// Verifies JWT tokens for protected routes

const jwt = require('jsonwebtoken');
const config = require('../../../config.json');

const JWT_SECRET = config.jwtSecret;

/**
 * Required authentication middleware
 * Fails with 401 if no valid token
 */
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        
        req.userId = decoded.userId;
        req.discordId = decoded.discordId;
        
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Optional authentication middleware
 * Continues even without token, but populates req.userId if valid
 */
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
            req.discordId = decoded.discordId;
        }
        
        next();
    } catch (err) {
        // Continue without auth on error
        next();
    }
};

/**
 * Generate a JWT token for a user
 */
const generateToken = (user) => {
    return jwt.sign(
        { 
            userId: user._id.toString(), 
            discordId: user.discordID 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

module.exports = { 
    authMiddleware, 
    optionalAuthMiddleware,
    generateToken 
};
