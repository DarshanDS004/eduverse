# redis.js — Redis Client & Cache Layer

> **EduVerse** | `config/redis.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Use Cases](#2-purpose--use-cases)
3. [Dependencies](#3-dependencies)
4. [Connection Setup](#4-connection-setup)
5. [Reconnect Strategy](#5-reconnect-strategy)
6. [Safe Wrapper Methods](#6-safe-wrapper-methods)
7. [Cache Key Helpers](#7-cache-key-helpers)
8. [TTL Constants](#8-ttl-constants)
9. [Error Handling](#9-error-handling)
10. [Environment Variables](#10-environment-variables)
11. [Usage Examples](#11-usage-examples)
12. [Workflow Diagram](#12-workflow-diagram)
13. [Possible Improvements](#13-possible-improvements)

---

## 1. Overview

`redis.js` provides a Redis client with graceful fallback behavior, safe wrapper methods, centralized cache key naming, and TTL constants. All Redis interactions in EduVerse go through this module.

**File location:** `config/redis.js`

---

## 2. Purpose & Use Cases

| Use Case | Cache Key Pattern | TTL |
|---|---|---|
| Course listing cache (avoid heavy DB queries) | `courses:list:{filters}` | 30 min |
| Course detail cache | `courses:detail:{id}` | 30 min |
| User session caching | `session:user:{id}` | 1 hour |
| Unread notification count | `notif:count:{userId}` | 5 min |
| Quiz result caching | `quiz:result:{attemptId}` | 1 hour |
| Platform settings | `platform:settings` | 1 hour |
| Feature flags | `platform:flags` | 1 hour |
| Instructor stats | `instructor:stats:{id}` | 30 min |
| Rate limiting counters | custom keys | varies |
| Bull job queue backing store | managed by Bull | managed by Bull |

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `redis` | npm | Redis client (`createClient`) |

```bash
npm install redis
```

---

## 4. Connection Setup

Redis is connected once at server startup:

```javascript
const redis = require('./config/redis');
await redis.connect();
```

**Connection configuration:**
```javascript
client = createClient({
  socket: {
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 5) return false;           // Stop retrying after 5 attempts
      return Math.min(retries * 200, 3000);    // 200ms, 400ms, ..., 3000ms
    },
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB) || 0,
});
```

**If `REDIS_HOST` is not set:**
```
⚠️  [Redis] REDIS_HOST not set. Redis disabled — running without cache.
```
The `connect()` function returns `null` and all wrapper methods return `null`/`false` safely.

---

## 5. Reconnect Strategy

The client uses exponential backoff for reconnection:

| Attempt | Delay |
|---|---|
| 1 | 200ms |
| 2 | 400ms |
| 3 | 600ms |
| 4 | 800ms |
| 5 | 1000ms |
| >5 | Stop retrying |

**Connection events logged:**

| Event | Log |
|---|---|
| `connect` | `✅ Redis connected.` |
| `ready` | Sets `isConnected = true` |
| `error` | `❌ [Redis] Error: {message}` |
| `end` | `⚠️  [Redis] Connection closed.` |
| `reconnecting` | `🔄 [Redis] Reconnecting...` |

After max retries exceeded, the application continues **without Redis** (cache miss on all gets, no-op on all sets).

---

## 6. Safe Wrapper Methods

All methods check `if (!client || !isConnected) return null/false` before executing. They never throw — errors are caught and logged.

---

### `get(key)`

```javascript
/**
 * Get a cached value
 * @param {string} key
 * @returns {any|null} Parsed JSON value, or null if not found / Redis down
 */
const value = await redis.get('courses:list:{}');
```

Internally: `client.get(key)` → `JSON.parse(val)` → returns parsed value or `null`.

---

### `set(key, value, ttlSeconds?)`

```javascript
/**
 * Set a cached value
 * @param {string} key
 * @param {any}    value       - Will be JSON.stringify'd
 * @param {number} ttlSeconds  - Optional expiry in seconds
 * @returns {boolean} true on success, false on failure
 */
await redis.set('courses:detail:42', courseData, redis.TTL.LONG);
```

- With TTL: uses `client.setEx(key, ttlSeconds, serialized)`
- Without TTL: uses `client.set(key, serialized)` (persists until manually deleted)

---

### `del(key)`

```javascript
/**
 * Delete a cached key
 * @param {string} key
 * @returns {boolean}
 */
await redis.del('courses:detail:42');
```

Used when a resource is updated — invalidate its cached version.

---

### `delPattern(pattern)`

```javascript
/**
 * Delete all keys matching a glob pattern
 * @param {string} pattern - e.g. 'courses:list:*'
 * @returns {boolean}
 */
await redis.delPattern('courses:list:*');
```

Uses `SCAN` (cursor-based) instead of `KEYS` — safe for production with large key sets. Processes 100 keys per scan iteration.

**When to use:** When a course is created/updated, all course listing cache entries must be invalidated since any filter combination could have been cached.

---

### `exists(key)`

```javascript
/**
 * Check if a key exists
 * @param {string} key
 * @returns {boolean}
 */
const cached = await redis.exists('quiz:result:99');
if (cached) { ... }
```

---

### `ttl(key)`

```javascript
/**
 * Get remaining TTL of a key in seconds
 * @param {string} key
 * @returns {number} -1 if no expiry, -2 if key doesn't exist
 */
const remaining = await redis.ttl('session:user:7');
```

---

### `incr(key, ttlSeconds?)`

```javascript
/**
 * Atomic increment — used for rate limiting
 * @param {string} key
 * @param {number} ttlSeconds - Set TTL on first increment (when value becomes 1)
 * @returns {number|null} New value after increment
 */
const count = await redis.incr(`ratelimit:${ip}:login`, 60);
if (count > 5) {
  // Block: too many login attempts in 60 seconds
}
```

The TTL is only set when `val === 1` (first increment in the window). This is the correct pattern for sliding window rate limiting.

---

## 7. Cache Key Helpers

Centralized key name functions prevent typos and naming collisions across the codebase:

```javascript
const { keys } = require('./config/redis');

keys.courseList({ category: 'math', level: 'beginner' })
// → "courses:list:{"category":"math","level":"beginner"}"

keys.courseDetail(42)
// → "courses:detail:42"

keys.userSession(7)
// → "session:user:7"

keys.notifCount(7)
// → "notif:count:7"

keys.quizResult(99)
// → "quiz:result:99"

keys.platformSettings()
// → "platform:settings"

keys.featureFlags()
// → "platform:flags"

keys.instructorStats(3)
// → "instructor:stats:3"
```

**Always use these helpers** instead of hardcoding key strings in controllers.

---

## 8. TTL Constants

```javascript
const { TTL } = require('./config/redis');

TTL.SHORT   // 60       — 1 minute
TTL.MEDIUM  // 300      — 5 minutes
TTL.LONG    // 1800     — 30 minutes
TTL.HOUR    // 3600     — 1 hour
TTL.DAY     // 86400    — 24 hours
```

**Usage guidelines:**

| TTL | Use For |
|---|---|
| `SHORT` | Rapidly changing data (notification counts, active session flags) |
| `MEDIUM` | Semi-static data (user profiles, class lists) |
| `LONG` | Stable lists (course catalog, quiz results) |
| `HOUR` | Expensive computed data (instructor stats, platform analytics) |
| `DAY` | Near-static config (platform settings, feature flags) |

---

## 9. Error Handling

All wrapper methods use try/catch and return safe defaults on error:

```javascript
async function get(key) {
  if (!client || !isConnected) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('[Redis] get error:', err.message);
    return null;  // ← Never throws to caller
  }
}
```

**The application always falls through to the database** when Redis returns null — cache miss and Redis failure are treated identically by callers.

---

## 10. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | No | — | Redis server hostname. If not set, Redis is disabled entirely |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | — | Redis AUTH password (if ACLs are enabled) |
| `REDIS_DB` | No | `0` | Redis logical database index (0–15) |

---

## 11. Usage Examples

### Cache-aside pattern in a controller:

```javascript
const redis = require('../config/redis');

async function getCourseDetail(courseId) {
  // 1. Check cache
  const cached = await redis.get(redis.keys.courseDetail(courseId));
  if (cached) return cached;

  // 2. Query DB
  const [[course]] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);

  // 3. Store in cache
  await redis.set(redis.keys.courseDetail(courseId), course, redis.TTL.LONG);

  return course;
}
```

### Invalidate on update:

```javascript
async function updateCourse(courseId, data) {
  await db.query('UPDATE courses SET ? WHERE id = ?', [data, courseId]);

  // Invalidate course detail cache
  await redis.del(redis.keys.courseDetail(courseId));

  // Invalidate all course listing caches (any filter might include this course)
  await redis.delPattern('courses:list:*');
}
```

### Rate limiting:

```javascript
async function loginRateLimiter(req, res, next) {
  const key = `ratelimit:login:${req.ip}`;
  const attempts = await redis.incr(key, 60); // window: 60 seconds

  if (attempts > 10) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  next();
}
```

---

## 12. Workflow Diagram

```
Controller receives request
        │
        ▼
redis.get(redis.keys.courseDetail(id))
        │
        ├─ Redis connected + key exists → return cached data ──→ Response
        │
        └─ Redis down OR key missing
                │
                ▼
        DB query (full SQL)
                │
                ▼
        redis.set(key, data, TTL.LONG)  ← Store for next request
                │
                ▼
        Return data → Response
```

---

## 13. Possible Improvements

1. **Cache stampede prevention** — When many requests miss cache simultaneously and all hit the DB, use a lock (mutex) or probabilistic early expiry to prevent thundering herd.

2. **Compression** — Compress large cached values (e.g., course listings) with `zlib` before storing to reduce Redis memory usage.

3. **Redis Cluster support** — For high availability, add cluster configuration:
   ```javascript
   const { createCluster } = require('redis');
   ```

4. **Metrics** — Track cache hit/miss ratios and log them to a monitoring system (Prometheus, Datadog) to optimize TTLs and identify cold spots.

5. **Namespace isolation** — Prefix all keys with `eduverse:` to prevent collisions with other apps sharing the same Redis instance:
   ```javascript
   courseDetail: (id) => `eduverse:courses:detail:${id}`
   ```

6. **Type safety** — Add TypeScript types or JSDoc to the key helpers and wrapper methods for better IDE support and fewer runtime errors.
