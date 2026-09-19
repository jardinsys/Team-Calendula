// Token utilities — generate, hash, and verify API/recovery tokens
// Chameleon/api/utils/tokens.js

const crypto = require('crypto');

const TOKEN_LENGTH = 32; // 32 bytes = 64 hex chars
const USER_PREFIX = 'usr_live_';
const SYSTEM_PREFIX = 'sys_live_';

/**
 * Generate a new random token with prefix.
 * @param {'user' | 'system'} type
 * @returns {{ raw: string, hash: string }}
 */
function generateToken(type) {
    const prefix = type === 'system' ? SYSTEM_PREFIX : USER_PREFIX;
    const random = crypto.randomBytes(TOKEN_LENGTH).toString('hex');
    const raw = `${prefix}${random}`;
    const hash = hashToken(raw);
    return { raw, hash };
}

/**
 * Hash a raw token using SHA-256.
 * High-entropy random tokens don't need salt — SHA-256 is sufficient.
 * @param {string} raw
 * @returns {string} hex hash
 */
function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Verify a raw token against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 * @param {string} raw
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyToken(raw, storedHash) {
    const computed = hashToken(raw);
    if (computed.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
}

/**
 * Check if a token entry has expired.
 * @param {{ expiresAt?: Date }} tokenEntry
 * @returns {boolean}
 */
function isTokenExpired(tokenEntry) {
    if (!tokenEntry.expiresAt) return false;
    return new Date() > new Date(tokenEntry.expiresAt);
}

module.exports = { generateToken, hashToken, verifyToken, isTokenExpired, USER_PREFIX, SYSTEM_PREFIX };
