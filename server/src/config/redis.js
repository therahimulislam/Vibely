// server/src/config/redis.js
// Redis client for online status and caching

const Redis = require('ioredis');

let redis = null;

const connectRedis = () => {
    try {
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
        });

        redis.on('connect', () => {
            console.log('✅ Redis connected');
        });

        redis.on('error', (err) => {
            console.warn('⚠️ Redis connection error (app will work without caching):', err.message);
        });

        redis.connect().catch(() => {
            console.warn('⚠️ Redis not available — running without caching');
            redis = null;
        });
    } catch (error) {
        console.warn('⚠️ Redis setup failed:', error.message);
        redis = null;
    }
};

const getRedis = () => redis;

module.exports = { connectRedis, getRedis };
