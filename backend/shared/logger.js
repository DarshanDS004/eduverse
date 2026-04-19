/**
 * EduVerse — Logger
 * shared/logger.js
 *
 * Winston-based structured logger.
 * Outputs JSON in production, pretty-printed in development.
 *
 * Log levels:
 *   error   — unhandled errors, crashes
 *   warn    — recoverable issues (missing config, deprecated calls)
 *   info    — normal operations (server start, user login, payment)
 *   http    — HTTP request/response logs
 *   debug   — detailed debugging (DB queries, socket events)
 *
 * Usage:
 *   const logger = require('./shared/logger');
 *   logger.info('User logged in', { userId: 5, role: 'student' });
 *   logger.error('DB query failed', { error: err.message, query });
 */

'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const NODE_ENV  = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_DIR   = path.join(__dirname, '../../logs');

/* ============================================================
   FORMATS
============================================================ */

// Pretty format for development terminal
const devFormat = format.combine(
  format.timestamp({ format: 'HH:mm:ss' }),
  format.colorize(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// JSON format for production (works with log aggregators like DataDog, CloudWatch)
const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

/* ============================================================
   TRANSPORTS
============================================================ */

const logTransports = [
  // Console — always on
  new transports.Console({
    format: NODE_ENV === 'production' ? prodFormat : devFormat,
  }),
];

// File transports — production only
if (NODE_ENV === 'production') {
  const { mkdirSync, existsSync } = require('fs');
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

  // All logs
  logTransports.push(
    new transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      format:   prodFormat,
      maxsize:  10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  );

  // Error-only log
  logTransports.push(
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level:    'error',
      format:   prodFormat,
      maxsize:  10 * 1024 * 1024,
      maxFiles: 5,
    })
  );
}

/* ============================================================
   LOGGER INSTANCE
============================================================ */

const logger = createLogger({
  level:      LOG_LEVEL,
  transports: logTransports,
  // Do not crash on unhandled exceptions — let the error handler deal with it
  exitOnError: false,
});

/* ============================================================
   HTTP REQUEST LOGGER
   Returns a middleware function for Express
============================================================ */

logger.httpMiddleware = function () {
  return function (req, res, next) {
    const start = Date.now();

    res.on('finish', function () {
      const duration = Date.now() - start;
      const level    = res.statusCode >= 500 ? 'error'
                     : res.statusCode >= 400 ? 'warn'
                     : 'http';

      logger.log(level, `${req.method} ${req.originalUrl}`, {
        status:     res.statusCode,
        duration_ms: duration,
        ip:         req.ip,
        user_agent: req.get('User-Agent')?.slice(0, 100),
        user_id:    req.user?.id || null,
      });
    });

    next();
  };
};

/* ============================================================
   AUDIT LOG HELPER
   Logs sensitive admin actions to both logger and DB
============================================================ */

logger.audit = async function (action, userId, details, ip) {
  logger.info(`[AUDIT] ${action}`, {
    user_id: userId,
    ip,
    ...details,
  });

  // Also write to DB audit_logs table if db available
  try {
    const db = require('../config/db');
    await db.query(
      'INSERT INTO audit_logs (user_id, action, reference_type, reference_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [
        userId || null,
        action,
        details?.reference_type || null,
        details?.reference_id   || null,
        ip || null,
      ]
    );
  } catch (e) {
    // Non-blocking — don't fail the request if audit log write fails
    logger.warn('[AUDIT] Failed to write to DB:', { error: e.message });
  }
};

module.exports = logger;