'use strict';

/**
 * EduVerse — server.js
 *
 * Production-grade HTTP server bootstrap.
 * Combines:
 *  • Socket.io (real-time features)
 *  • Dynamic CORS (env-configurable)
 *  • Database bootstrap
 *  • Large-file / video upload timeouts (6 h)
 *  • Graceful SIGTERM / SIGINT shutdown
 *  • Cluster-aware keep-alive tuning
 *  • Hardened error handlers (no silent crashes)
 */

require('dotenv').config();
require('./config/db');

const http    = require('http');
const { Server } = require('socket.io');
const app     = require('./app');
const { initSocket } = require('./socket/index');

/* ─────────────────────────────────────────
   CONFIG
───────────────────────────────────────── */
const PORT = process.env.PORT || 5000;

const CORS_DEFAULTS = [
  'http://localhost:5500', 'http://127.0.0.1:5500',
  'http://localhost:3000', 'http://127.0.0.1:3000',
];

const CORS_ALLOWED = [
  ...new Set([
    ...CORS_DEFAULTS,
    ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  ]),
];

/* ─────────────────────────────────────────
   HTTP SERVER
───────────────────────────────────────── */
const server = http.createServer(app);

/*
 * TIMEOUT SETTINGS — critical for large video uploads.
 *
 * Default Node.js HTTP timeout is 2 minutes.
 * For a 5 GB file at 10 MB/s that's ~500 s (≈ 8 min).
 * We set 6 hours to accommodate very slow connections.
 *
 * keepAliveTimeout must be > any upstream proxy idle timeout (e.g. AWS ELB = 60 s).
 * headersTimeout must be strictly > keepAliveTimeout.
 */
server.timeout          = 6 * 60 * 60 * 1000;  // 6 hours  — large uploads
server.keepAliveTimeout = 65_000;               // 65 s     — outlast AWS ELB / nginx defaults
server.headersTimeout   = 66_000;               // 66 s     — must be > keepAliveTimeout

/* ─────────────────────────────────────────
   SOCKET.IO
───────────────────────────────────────── */
const io = new Server(server, {
  cors: {
    origin (origin, cb) {
      if (!origin || CORS_ALLOWED.includes(origin)) cb(null, true);
      else cb(new Error(`CORS: origin "${origin}" not allowed`));
    },
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  transports:   ['websocket', 'polling'],
  pingTimeout:  60_000,
  pingInterval: 25_000,

  /* Per-socket upload size limit — protects against oversized WS frames */
  maxHttpBufferSize: 1e6,   // 1 MB (default 1 MB; tune if needed)
});

/* Register application socket handlers */
initSocket(io);

/* Expose io to Express routes via app.locals */
app.locals.io = io;

/* ─────────────────────────────────────────
   START
───────────────────────────────────────── */
server.listen(PORT, () => {
  const line = '━'.repeat(44);
  console.log('');
  console.log(`  ${line}`);
  console.log('  🚀  EduVerse API Server — Started');
  console.log(`  ${line}`);
  console.log(`  📡  Port       : ${PORT}`);
  console.log(`  🌍  Env        : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🔗  HTTP       : http://localhost:${PORT}`);
  console.log(`  ❤️   Health     : http://localhost:${PORT}/health`);
  console.log(`  🔌  Socket.io  : enabled`);
  console.log(`  📦  Uploads    : /uploads/`);
  console.log(`  ⏱️   Timeout    : ${server.timeout / 3_600_000} h`);
  console.log(`  ${line}`);
  console.log('');
});

/* ─────────────────────────────────────────
   GRACEFUL SHUTDOWN
   Handles SIGTERM (Docker / Kubernetes stop)
   and SIGINT  (Ctrl-C during development).
───────────────────────────────────────── */
function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown initiated…`);

  server.close(err => {
    if (err) {
      console.error('[Shutdown] Error closing HTTP server:', err.message);
      process.exit(1);
    }
    console.log('[Shutdown] HTTP server closed. Bye! 👋');
    process.exit(0);
  });

  /* Force-kill after 15 s if connections are still hanging */
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after 15 s timeout.');
    process.exit(1);
  }, 15_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

/* ─────────────────────────────────────────
   PROCESS-LEVEL ERROR HANDLERS
───────────────────────────────────────── */

/*
 * unhandledRejection — a rejected promise that nobody caught.
 * Log it in full but do NOT crash in production; a single bad
 * async operation should not kill every user's session.
 * In development, crash loudly so the bug is impossible to miss.
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] Promise:', promise);
  console.error('[Unhandled Rejection] Reason :', reason);

  if (process.env.NODE_ENV !== 'production') {
    server.close(() => process.exit(1));
  }
});

/*
 * uncaughtException — truly unexpected synchronous throw.
 * The process is in an unknown state; always exit and let
 * the process manager (PM2 / Docker) restart it.
 */
process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]', err.message);
  console.error(err.stack);
  process.exit(1);
});

module.exports = server;