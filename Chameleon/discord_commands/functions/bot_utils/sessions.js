// Session management extracted from `bot_utils/index.js`.
// Re-exported through the `bot_utils` barrel so all consumers keep the same API.

const activeSessions = new Map();
const sessionTimeouts = new Map();
const TTL_MS = 15 * 60 * 1000;

function generateSessionId(userId) {
    return `${userId}_${Date.now()}`;
}

function getSession(sessionId) {
    return activeSessions.get(sessionId);
}

function setSession(sessionId, data) {
    if (sessionTimeouts.has(sessionId)) {
        clearTimeout(sessionTimeouts.get(sessionId));
    }
    activeSessions.set(sessionId, data);
    const timeout = setTimeout(() => {
        activeSessions.delete(sessionId);
        sessionTimeouts.delete(sessionId);
    }, TTL_MS);
    sessionTimeouts.set(sessionId, timeout);
}

function deleteSession(sessionId) {
    activeSessions.delete(sessionId);
    if (sessionTimeouts.has(sessionId)) {
        clearTimeout(sessionTimeouts.get(sessionId));
        sessionTimeouts.delete(sessionId);
    }
}

function extractSessionId(customId) {
    const parts = customId.split('_');
    return parts.slice(-2).join('_');
}

module.exports = {
    activeSessions,
    sessionTimeouts,
    generateSessionId,
    getSession,
    setSession,
    deleteSession,
    extractSessionId,
};
