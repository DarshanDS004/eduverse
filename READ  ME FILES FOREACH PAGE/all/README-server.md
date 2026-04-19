# server.js — HTTP Server Bootstrap

## Overview

`server.js` is the **entry point** of the EduVerse backend. It creates the HTTP server, configures Socket.io for real-time communication, connects to the database, tunes the server for large video uploads, and registers graceful shutdown and process-level error handlers.

**File path:** `backend/server.js`

---

## What It Does (Step by Step)

1. Loads environment variables via `dotenv`
2. Bootstraps the database connection (`config/db`)
3. Wraps the Express `app` in a native `http.Server`
4. Attaches a Socket.io server to the HTTP server
5. Calls `initSocket(io)` to register all real-time event handlers
6. Exposes `io` to all Express routes via `app.locals.io`
7. Starts listening on the configured `PORT`
8. Registers SIGTERM / SIGINT handlers for graceful shutdown
9. Registers `unhandledRejection` and `uncaughtException` handlers

---

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | HTTP listen port |
| `NODE_ENV` | `development` | Controls crash-on-rejection behavior |
| `CORS_ORIGINS` | _(none)_ | Comma-separated extra allowed origins |

---

## HTTP Timeout Settings

These are critical for large video file uploads:

| Setting | Value | Reason |
|---|---|---|
| `server.timeout` | 6 hours (21,600,000 ms) | Supports multi-GB uploads on slow connections |
| `server.keepAliveTimeout` | 65,000 ms | Outlasts AWS ELB / Nginx default idle timeout (60 s) |
| `server.headersTimeout` | 66,000 ms | Must be strictly greater than `keepAliveTimeout` |

---

## Socket.io Configuration

Socket.io is attached to the same HTTP server as Express (no separate port).

| Option | Value | Purpose |
|---|---|---|
| `transports` | `['websocket', 'polling']` | Prefers WebSocket, falls back to long-polling |
| `pingTimeout` | 60,000 ms | Time before declaring a client disconnected |
| `pingInterval` | 25,000 ms | Heartbeat frequency |
| `maxHttpBufferSize` | 1 MB | Max WebSocket frame size (prevents oversized payloads) |
| CORS | Same whitelist as Express | Allows browser connections from dev/prod origins |

Socket event handlers are registered in `./socket/index.js` via `initSocket(io)`.

The `io` instance is available in any Express route or middleware via `req.app.locals.io`.

---

## CORS Whitelist

Default allowed origins (hard-coded + extensible via `CORS_ORIGINS` env var):

```
http://localhost:5500
http://127.0.0.1:5500
http://localhost:3000
http://127.0.0.1:3000
```

Add production domains via:

```
CORS_ORIGINS=https://eduverse.com,https://app.eduverse.com
```

---

## Startup Log Output

On successful start, the server prints a formatted summary:

```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀  EduVerse API Server — Started
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📡  Port       : 5000
  🌍  Env        : development
  🔗  HTTP       : http://localhost:5000
  ❤️   Health     : http://localhost:5000/health
  🔌  Socket.io  : enabled
  📦  Uploads    : /uploads/
  ⏱️   Timeout    : 6 h
```

---

## Graceful Shutdown

When `SIGTERM` (Docker/Kubernetes stop) or `SIGINT` (Ctrl-C) is received:

1. `server.close()` is called — no new connections are accepted
2. Existing connections are drained
3. Process exits with code `0`
4. If connections don't drain within **15 seconds**, a forced exit (`process.exit(1)`) fires

---

## Process-Level Error Handlers

### `unhandledRejection`
- Logs the rejected promise and the reason
- In **development**: crashes the process (loud failure, forces the bug to be fixed)
- In **production**: logs only (a single bad async operation doesn't kill all sessions)

### `uncaughtException`
- Logs the error and stack trace
- Always calls `process.exit(1)` — the process manager (PM2/Docker) restarts it

---

## Dependencies

| Package | Purpose |
|---|---|
| `dotenv` | Load `.env` file |
| `http` (built-in) | Create HTTP server |
| `socket.io` | Real-time WebSocket/polling server |
| `./app` | Express application |
| `./config/db` | Database connection bootstrap |
| `./socket/index` | Socket event handler registration |

---

## Related Files

- `app.js` — Express middleware and route configuration
- `config/db.js` — MySQL connection pool
- `socket/index.js` — Socket.io event handlers
- `.env` — Environment variables
