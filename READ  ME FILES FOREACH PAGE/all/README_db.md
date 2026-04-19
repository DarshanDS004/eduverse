# `db.js` — MySQL Database Connection Pool

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `db.js` |
| **Location** | `config/db.js` |
| **File Type** | Configuration / Database Utility |
| **Project** | EduVerse |

**Purpose:** This file establishes and exports a MySQL connection pool for the entire EduVerse application. It is the single source of truth for all database connectivity — every service layer that needs to query MySQL imports this file.

---

## 2. Responsibility

This file solves the problem of managing database connections efficiently across a Node.js server. Rather than opening a new connection on every database request (which is slow and resource-intensive), it creates a **connection pool** — a managed set of reusable connections — that any part of the application can borrow, use, and return.

**Why this file exists:**
- Centralize database configuration in one place.
- Provide a shared, reusable pool object to all modules.
- Validate that the database is reachable at server startup, failing fast if not.

---

## 3. Imports / Dependencies

| Import | Package | Purpose |
|---|---|---|
| `mysql2/promise` | `mysql2` | MySQL client for Node.js with native Promise support. Allows `async/await` style queries without callback hell. |

---

## 4. Core Logic Breakdown

### Step 1 — Pool Creation
```js
const pool = mysql.createPool({ ... });
```
A connection pool is created with the following configuration options:

| Option | Value / Source | Meaning |
|---|---|---|
| `host` | `DB_HOST` env or `'localhost'` | MySQL server hostname |
| `port` | `DB_PORT` env or `3306` | MySQL port (default 3306) |
| `user` | `DB_USER` env or `'root'` | Database user |
| `password` | `DB_PASSWORD` env or `''` | Database password |
| `database` | `DB_NAME` env or `'eduverse_db'` | Target database name |
| `waitForConnections` | `true` | Queue requests when all connections are busy instead of throwing |
| `connectionLimit` | `20` | Maximum simultaneous connections in the pool |
| `queueLimit` | `0` | Unlimited queue length (0 = no cap) |
| `timezone` | `'+05:30'` | IST (Indian Standard Time) for `DATETIME` fields |
| `charset` | `'utf8mb4'` | Full Unicode support including emojis |

### Step 2 — Startup Connection Test
```js
async function testConnection() { ... }
testConnection();
```
Immediately after pool creation, `testConnection()` is called (without `await` — it runs fire-and-forget on startup). It:
1. Attempts to acquire a connection from the pool using `pool.getConnection()`.
2. Logs a success message with the database name if connected.
3. Releases the connection back to the pool immediately.
4. Calls `process.exit(1)` if connection fails — intentionally crashing the server so broken DB config is discovered at startup, not mid-request.

### Step 3 — Export
```js
module.exports = pool;
```
The pool object is exported directly. Consumers call `pool.query(sql, params)` or `pool.getConnection()`.

---

## 5. Functions / Methods

### `testConnection()`

| Property | Details |
|---|---|
| **Type** | `async function` |
| **Visibility** | Internal (not exported) |
| **Parameters** | None |
| **Returns** | `void` (side effects only) |

**Logic:**
- Calls `pool.getConnection()` to borrow a connection.
- On success: logs `✅ MySQL connected — database: <DB_NAME>` and calls `conn.release()`.
- On failure: logs `❌ MySQL connection failed: <error>` and exits the process with code `1`.

**Edge case:** If `DB_NAME` environment variable is undefined, the log will show `undefined` as the database name (minor cosmetic issue — the fallback `'eduverse_db'` in the pool config is still used for actual connectivity).

---

## 6. API Role

This is not a route file. It is a shared configuration module consumed by all service files that perform database queries.

---

## 8. Data Flow

```
Environment Variables (.env)
        │
        ▼
   mysql2.createPool()  ──→  pool (connection pool object)
        │
        ▼
  testConnection()  ──→  success log OR process.exit(1)
        │
        ▼
  module.exports = pool  ──→  imported by all service files
```

---

## 9. Connections

### Files That Depend On This File
| File | Usage |
|---|---|
| `modules/auth/auth.service.js` | All auth DB queries |
| `modules/auth/auth.middleware.js` | User lookup on every protected request |
| `modules/student/student.service.js` | All student DB queries |
| `modules/materials/materials.service.js` | All materials DB queries |

### Files This File Depends On
- Only `mysql2/promise` (npm package) and `process.env` (Node.js built-in).

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| DB unreachable at startup | `testConnection` logs the error and calls `process.exit(1)` — server does not start. |
| DB goes down mid-runtime | `mysql2` pool will queue/reject queries; errors bubble up to individual service callers. |
| Wrong credentials | Caught in `testConnection`, triggers process exit. |

---

## 12. Example Usage

```js
// In any service file:
const db = require('../../config/db');

async function getUser(id) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
}
```

The destructured `[rows]` pattern is used because `mysql2/promise` returns `[rows, fields]` — most service code only needs `rows`.

---

## 13. Edge Cases / Notes

- **Timezone is hardcoded to IST (`+05:30`).** If the app is deployed in a different timezone, this will cause `DATETIME` values to be stored/read with IST offset. This should be moved to an environment variable for flexibility.
- **`connectionLimit: 20`** is fixed. For high-traffic production, this may need tuning.
- **`queueLimit: 0`** means the queue is unbounded — in an overload scenario, memory could grow. A positive limit would reject excess requests with an error instead.
- **Environment variable fallbacks** (e.g., `'root'`, `''`) are suitable for local development only and should never reach production.

---

## 14. Summary

`db.js` creates a singleton MySQL connection pool using `mysql2/promise`, configured via environment variables with sensible local defaults. It immediately tests the connection at startup and kills the process if the database is unreachable. The pool object is exported and shared by every service module in the EduVerse backend that needs database access.
