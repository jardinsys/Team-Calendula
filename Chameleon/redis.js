const Redis = require('ioredis');
const config = require('./config.json');

const redisUrl = process.env.REDIS_URL || `redis://${config.redis.host}:${config.redis.port}/0`;
const redisOpts = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    connectTimeout: 5000
};

let redis;

try {
    redis = new Redis(redisUrl, redisOpts);
    redis.on('connect', () => console.log('[Redis] Connected to Redis'));
    redis.on('error', (err) => {
        console.error('[Redis] Error:', err.message);
        console.log('[Redis] Redis unavailable — falling back to MongoDB-only mode');
    });
    redis.on('ready', () => console.log('[Redis] Ready'));
} catch (err) {
    console.log('[Redis] Failed to initialize — falling back to MongoDB-only mode');
}

// Fallback: no-op Redis client for when Redis is unavailable
const noopRedis = {
    get: async () => null,
    set: async () => {},
    del: async () => {},
    scan: async () => ['0', []],
    zadd: async () => {},
    zrevrange: async () => [],
    zremrangebyrank: async () => {},
    expire: async () => {},
    exists: async () => 0,
    quit: async () => {},
    on: () => {}
};

const primaryRedis = redis || noopRedis;

// ==========================================
// PUB/SUB — separate ioredis connection
// ioredis requires a dedicated connection for subscribe
// ==========================================

let pubSubRedis;
let pubSubAvailable = false;

try {
    pubSubRedis = new Redis(redisUrl, redisOpts);
    pubSubRedis.on('ready', () => {
        pubSubAvailable = true;
        console.log('[Redis PubSub] Ready');
    });
    pubSubRedis.on('error', (err) => {
        pubSubAvailable = false;
        console.error('[Redis PubSub] Error:', err.message);
    });
} catch (err) {
    console.log('[Redis PubSub] Failed to initialize — real-time events disabled');
}

const noopPubSub = {
    publish: async () => 0,
    subscribe: async () => 0,
    unsubscribe: async () => 0,
    on: () => {}
};

const pubSub = pubSubRedis || noopPubSub;

// ==========================================
// EVENT HELPERS
// ==========================================

const EVENT_CHANNEL_PREFIX = 'events:';

/**
 * Publish a real-time event for a system.
 * Bot-originated events go through Redis; API-originated events
 * can call this directly or use publishLocalEvent() for same-process.
 */
function publishEvent(systemId, event) {
    if (!systemId) return;
    const channel = `${EVENT_CHANNEL_PREFIX}${systemId}`;
    const payload = JSON.stringify({ ...event, ts: Date.now() });
    pubSub.publish(channel, payload).catch(() => {});
}

// Event listener registry for same-process delivery (API server)
const localListeners = new Map();

/**
 * Subscribe to events for a system (same-process, for the API server).
 * Returns an unsubscribe function.
 */
function subscribeEvents(systemId, callback) {
    if (!localListeners.has(systemId)) {
        localListeners.set(systemId, new Set());
    }
    localListeners.get(systemId).add(callback);
    return () => {
        const listeners = localListeners.get(systemId);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) localListeners.delete(systemId);
        }
    };
}

/**
 * Broadcast a local event to all same-process subscribers.
 * Called by the Redis subscriber when a message arrives,
 * or directly by API routes for same-process events.
 */
function broadcastLocal(systemId, event) {
    const listeners = localListeners.get(systemId);
    if (!listeners) return;
    for (const cb of listeners) {
        try { cb(event); } catch (err) { console.error('[WS] Broadcast error:', err.message); }
    }
}

// Redis subscriber for cross-process events (bot → API)
if (pubSubRedis) {
    const subscribedChannels = new Set();

    pubSubRedis.on('message', (channel, message) => {
        if (!channel.startsWith(EVENT_CHANNEL_PREFIX)) return;
        const systemId = channel.slice(EVENT_CHANNEL_PREFIX.length);
        try {
            const event = JSON.parse(message);
            broadcastLocal(systemId, event);
        } catch (err) {
            console.error('[Redis PubSub] Parse error:', err.message);
        }
    });

    // Expose subscribe/unsubscribe that tracks channels
    primaryRedis._subscribe = async (systemId) => {
        const channel = `${EVENT_CHANNEL_PREFIX}${systemId}`;
        if (subscribedChannels.has(channel)) return;
        subscribedChannels.add(channel);
        await pubSub.subscribe(channel).catch(() => {});
    };

    primaryRedis._unsubscribe = async (systemId) => {
        const channel = `${EVENT_CHANNEL_PREFIX}${systemId}`;
        if (!subscribedChannels.has(channel)) return;
        subscribedChannels.delete(channel);
        await pubSub.unsubscribe(channel).catch(() => {});
    };
} else {
    primaryRedis._subscribe = async () => {};
    primaryRedis._unsubscribe = async () => {};
}

module.exports = primaryRedis;
module.exports.publishEvent = publishEvent;
module.exports.subscribeEvents = subscribeEvents;
module.exports.broadcastLocal = broadcastLocal;
