/**
 * EduVerse — Shared Error Handler  (COMPLETE + BULLETPROOF)
 * shared/errorHandler.js
 *
 * Root cause of "Unexpected end of JSON input":
 *   - res.json() was never called (handler threw before sending response)
 *   - globalErrorHandler called next(err) without sending JSON
 *   - Express sent an empty 500 body with no Content-Type
 *
 * This file fixes ALL of those cases.
 */

'use strict';

/* ============================================================
   AppError — structured error with HTTP status + error code
============================================================ */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode || 500;
    this.code       = code       || 'SERVER_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/* ============================================================
   sendSuccess — always sends a well-formed JSON success response
============================================================ */
function sendSuccess(res, statusCode, message, data) {
  // Guard: if response already sent (shouldn't happen but just in case)
  if (res.headersSent) return;

  const payload = {
    success: true,
    message: message || 'OK',
  };

  if (data !== undefined && data !== null) {
    payload.data = data;
  }

  return res.status(statusCode || 200).json(payload);
}

/* ============================================================
   sendError — always sends a well-formed JSON error response
============================================================ */
function sendError(res, statusCode, message, code) {
  if (res.headersSent) return;

  return res.status(statusCode || 400).json({
    success: false,
    message: message || 'An error occurred.',
    code:    code    || 'ERROR',
  });
}

/* ============================================================
   globalErrorHandler — Express error middleware (4 args)
   Catches ALL unhandled errors thrown inside route handlers.
   ALWAYS sends JSON — never an empty body.
============================================================ */
function globalErrorHandler(err, req, res, next) {  // eslint-disable-line no-unused-vars
  // If headers already sent (streaming scenario), just end the response
  if (res.headersSent) {
    return res.end();
  }

  // Log the error for debugging
  console.error('[EduVerse Error]', {
    method:  req.method,
    url:     req.originalUrl,
    message: err.message,
    code:    err.code,
    stack:   process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Multer errors (file upload issues)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Please upload a smaller file.',
      code:    'FILE_TOO_LARGE',
    });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field. Check your upload form.',
      code:    'UNEXPECTED_FILE',
    });
  }

  // MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      code:    'DUPLICATE_ENTRY',
    });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
      code:    'FOREIGN_KEY_ERROR',
    });
  }
  if (err.code && err.code.startsWith('ER_')) {
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development'
        ? 'Database error: ' + err.message
        : 'A database error occurred. Please try again.',
      code: 'DB_ERROR',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.',
      code:    'INVALID_TOKEN',
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Your session has expired. Please log in again.',
      code:    'TOKEN_EXPIRED',
    });
  }

  // SyntaxError from JSON.parse / bad request body
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body.',
      code:    'INVALID_JSON',
    });
  }

  // Operational errors (AppError instances thrown intentionally)
  if (err.isOperational) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      code:    err.code || 'ERROR',
    });
  }

  // Unknown / unexpected errors — never expose stack in production
  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? err.message || 'Internal server error.'
      : 'Something went wrong. Please try again.',
    code: 'SERVER_ERROR',
  });
}

/* ============================================================
   notFoundHandler — catches requests to undefined routes
   Put this BEFORE globalErrorHandler in app.js
============================================================ */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code:    'NOT_FOUND',
  });
}

module.exports = {
  AppError,
  sendSuccess,
  sendError,
  globalErrorHandler,
  notFoundHandler,
};