import { Redis } from '@upstash/redis';

// ── Redis Cache Service (Upstash REST) ──────────────────────────────────────────
// Provides low-latency key-value caching over HTTP REST so database retrievals
// (catalogue tree, dynamic pages, writer directory, site content, pricing rules,
// auth verification and admin metrics) don't repeatedly hit MongoDB.
//
// Designed with graceful failure: if Redis is unreachable or unconfigured, it
// logs a notice and immediately falls back to direct database retrieval.

const cleanEnv = (v) => (v ? String(v).trim().replace(/^['"]|['"]$/g, '') : '');

const REDIS_URL = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const REDIS_TOKEN = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);

const KEY_PREFIX = 'academiapro:';

let redisClient = null;
let redisHealthy = false;
let initialized = false;

export const cacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
};

function initRedis() {
    if (initialized) return redisClient;
    initialized = true;

    if (!REDIS_URL || !REDIS_TOKEN) {
        console.warn('[Cache] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Redis cache is disabled (falling back to database).');
        return null;
    }

    try {
        redisClient = new Redis({
            url: REDIS_URL,
            token: REDIS_TOKEN,
        });

        // Async ping test on boot (does not block startup)
        redisClient.ping()
            .then((res) => {
                redisHealthy = true;
                console.log(`[Cache] ⚡ Upstash Redis connected successfully (ping: ${res}). Database retrieval caching active.`);
            })
            .catch((err) => {
                redisHealthy = false;
                console.warn('[Cache] ⚠️ Upstash Redis ping failed, fallback to direct DB will be used:', err.message);
            });

        return redisClient;
    } catch (err) {
        console.error('[Cache] Failed to initialize Redis client:', err.message);
        return null;
    }
}

export const redis = initRedis();

export function isRedisAvailable() {
    return Boolean(redisClient && redisHealthy);
}

const prefixKey = (k) => (k.startsWith(KEY_PREFIX) ? k : `${KEY_PREFIX}${k}`);

/**
 * Retrieve a cached value by key.
 * Returns parsed object/primitive, or null on cache miss or error.
 */
export async function cacheGet(key) {
    if (!redisClient) {
        cacheStats.misses++;
        return null;
    }

    try {
        const fullKey = prefixKey(key);
        const data = await redisClient.get(fullKey);

        if (data === null || data === undefined) {
            cacheStats.misses++;
            return null;
        }

        cacheStats.hits++;
        return data;
    } catch (err) {
        cacheStats.errors++;
        console.warn(`[Cache] Error reading key "${key}":`, err.message);
        return null;
    }
}

/**
 * Store a value in cache with a TTL in seconds.
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
    if (!redisClient || value === undefined) return false;

    try {
        const fullKey = prefixKey(key);
        const opts = ttlSeconds && ttlSeconds > 0 ? { ex: ttlSeconds } : undefined;
        await redisClient.set(fullKey, value, opts);
        cacheStats.sets++;
        return true;
    } catch (err) {
        cacheStats.errors++;
        console.warn(`[Cache] Error setting key "${key}":`, err.message);
        return false;
    }
}

/**
 * Delete one or more specific keys.
 */
export async function cacheDel(...keys) {
    if (!redisClient || !keys.length) return 0;

    try {
        const fullKeys = keys.filter(Boolean).map(prefixKey);
        if (!fullKeys.length) return 0;
        return await redisClient.del(...fullKeys);
    } catch (err) {
        cacheStats.errors++;
        console.warn('[Cache] Error deleting keys:', err.message);
        return 0;
    }
}

/**
 * Invalidate keys matching a pattern, e.g. "catalog:*" or "writers:*".
 */
export async function cacheDelPattern(pattern) {
    if (!redisClient || !pattern) return 0;

    try {
        const searchPattern = prefixKey(pattern.startsWith('*') ? pattern : `${pattern}*`);
        const keys = await redisClient.keys(searchPattern);
        if (Array.isArray(keys) && keys.length > 0) {
            const count = await redisClient.del(...keys);
            return count;
        }
        return 0;
    } catch (err) {
        cacheStats.errors++;
        console.warn(`[Cache] Error invalidating pattern "${pattern}":`, err.message);
        return 0;
    }
}

/**
 * Cache-aside helper:
 * Tries to fetch from cache first; on miss or failure, executes `fetchFn()`,
 * stores the result in cache, and returns it.
 *
 * @template T
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<T>} fetchFn
 * @returns {Promise<T>}
 */
export async function remember(key, ttlSeconds, fetchFn) {
    const cached = await cacheGet(key);
    if (cached !== null) {
        return cached;
    }

    const fresh = await fetchFn();
    if (fresh !== undefined && fresh !== null) {
        try {
            await cacheSet(key, fresh, ttlSeconds);
        } catch {
            // fail-open: do not fail request if cache write encounters an error
        }
    }

    return fresh;
}

/**
 * Express middleware for automatic response caching on GET endpoints.
 * Intercepts res.json, caches the output and sets X-Cache headers (HIT / MISS).
 *
 * @param {number} ttlSeconds
 * @param {((req: import('express').Request) => string)|string} [keyOrFn]
 */
export function cacheResponse(ttlSeconds = 300, keyOrFn) {
    return async (req, res, next) => {
        // Only cache idempotent GET requests without authorization headers or special bypass flags
        if (req.method !== 'GET' || req.headers['x-cache-bypass']) {
            return next();
        }

        const cacheKey = typeof keyOrFn === 'function'
            ? keyOrFn(req)
            : (typeof keyOrFn === 'string' ? keyOrFn : `route:${req.baseUrl || ''}${req.path}?${new URLSearchParams(req.query).toString()}`);

        try {
            const cached = await cacheGet(cacheKey);
            if (cached !== null) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-TTL', `${ttlSeconds}s`);
                return res.json(cached);
            }
        } catch {
            // Proceed without cache on error
        }

        res.setHeader('X-Cache', 'MISS');

        // Wrap res.json to capture response body
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // Only cache successful 200 responses
            if (res.statusCode === 200 && body !== undefined && body !== null) {
                cacheSet(cacheKey, body, ttlSeconds).catch(() => {});
            }
            return originalJson(body);
        };

        next();
    };
}

export default {
    redis,
    isRedisAvailable,
    cacheGet,
    cacheSet,
    cacheDel,
    cacheDelPattern,
    remember,
    cacheResponse,
    cacheStats,
};
