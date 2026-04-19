/**
 * EduVerse — Redis Client
 * config/redis.js
 *
 * Used for:
 * - Session caching (faster than DB lookups)
 * - Course listing cache (avoid repeated heavy queries)
 * - Rate limiting counters
 * - Bull job queue backing store
 * - Leaderboard / quiz result caching
 *
 * Falls back gracefully if Redis is not configured —
 * the platform still runs, just without caching.
 */

'use strict';

const { createClient } = require('redis');

let client = null;
let isConnected = false;

/* ============================================================
   CREATE & CONNECT
============================================================ */

async function connect() {
  if (!process.env.REDIS_HOST) {
    console.warn('⚠️  [Redis] REDIS_HOST not set. Redis disabled — running without cache.');
    return null;
  }

  client = createClient({
    socket: {
      host:           process.env.REDIS_HOST || 'localhost',
      port:           parseInt(process.env.REDIS_PORT) || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.error('❌ [Redis] Max reconnect attempts reached. Running without Redis.');
          return false; // stop retrying
        }
        return Math.min(retries * 200, 3000); // exponential backoff
      },
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB) || 0,
  });

  client.on('connect',   () => console.log('✅ Redis connected.'));
  client.on('ready',     () => { isConnected = true; });
  client.on('error',     (err) => console.error('❌ [Redis] Error:', err.message));
  client.on('end',       () => { isConnected = false; console.warn('⚠️  [Redis] Connection closed.'); });
  client.on('reconnecting', () => console.log('🔄 [Redis] Reconnecting...'));

  try {
    await client.connect();
  } catch (err) {
    console.error('❌ [Redis] Failed to connect:', err.message);
    console.warn('⚠️  [Redis] Running without cache.');
    client = null;
  }

  return client;
}

/* ============================================================
   SAFE WRAPPERS
   All methods fail silently if Redis is not available.
   This ensures the app works even without Redis.
============================================================ */

/**
 * GET a cached value
 * Returns parsed JSON or null
 */
async function get(key) {
  if (!client || !isConnected) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('[Redis] get error:', err.message);
    return null;
  }
}

/**
 * SET a value with optional TTL (seconds)
 */
async function set(key, value, ttlSeconds) {
  if (!client || !isConnected) return false;
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      await client.set(key, serialized);
    }
    return true;
  } catch (err) {
    console.error('[Redis] set error:', err.message);
    return false;
  }
}

/**
 * DELETE a key
 */
async function del(key) {
  if (!client || !isConnected) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    console.error('[Redis] del error:', err.message);
    return false;
  }
}

/**
 * DELETE all keys matching a pattern
 * Used to invalidate related cache groups (e.g. all course listings)
 */
async function delPattern(pattern) {
  if (!client || !isConnected) return false;
  try {
    let cursor = 0;
    do {
      const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length > 0) {
        await client.del(result.keys);
      }
    } while (cursor !== 0);
    return true;
  } catch (err) {
    console.error('[Redis] delPattern error:', err.message);
    return false;
  }
}

/**
 * EXISTS — check if key exists
 */
async function exists(key) {
  if (!client || !isConnected) return false;
  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (err) {
    return false;
  }
}

/**
 * TTL — remaining time on a key in seconds
 */
async function ttl(key) {
  if (!client || !isConnected) return -1;
  try {
    return await client.ttl(key);
  } catch (err) {
    return -1;
  }
}

/**
 * INCR — atomic increment (used for rate limiting)
 */
async function incr(key, ttlSeconds) {
  if (!client || !isConnected) return null;
  try {
    const val = await client.incr(key);
    if (val === 1 && ttlSeconds) {
      await client.expire(key, ttlSeconds);
    }
    return val;
  } catch (err) {
    return null;
  }
}

/* ============================================================
   CACHE KEY HELPERS
   Centralized key naming prevents typos and collisions
============================================================ */

const keys = {
  courseList:      (filters) => `courses:list:${JSON.stringify(filters)}`,
  courseDetail:    (id)      => `courses:detail:${id}`,
  userSession:     (id)      => `session:user:${id}`,
  notifCount:      (userId)  => `notif:count:${userId}`,
  quizResult:      (attemptId) => `quiz:result:${attemptId}`,
  platformSettings:()        => 'platform:settings',
  featureFlags:    ()        => 'platform:flags',
  instructorStats: (id)      => `instructor:stats:${id}`,
};

/* ============================================================
   TTL CONSTANTS (seconds)
============================================================ */

const TTL = {
  SHORT:    60,           // 1 minute
  MEDIUM:   5 * 60,       // 5 minutes
  LONG:     30 * 60,      // 30 minutes
  HOUR:     60 * 60,      // 1 hour
  DAY:      24 * 60 * 60, // 24 hours
};

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  connect,
  get,
  set,
  del,
  delPattern,
  exists,
  ttl,
  incr,
  keys,
  TTL,
  getClient: () => client,
  isConnected: () => isConnected,
};