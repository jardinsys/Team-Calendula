const Redis = require('ioredis');
const config = require('../config.json');

const redisUrl = `redis://${config.redis.host}:${config.redis.port}/0`;

let redis;

try {
    redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        connectTimeout: 5000
    });

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
    zadd: async () => {},
    zrevrange: async () => [],
    zremrangebyrank: async () => {},
    expire: async () => {},
    exists: async () => 0,
    quit: async () => {},
    on: () => {}
};

module.exports = redis || noopRedis;
