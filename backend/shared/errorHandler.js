/**
 * EduVerse — Global Error Handler
 * shared/errorHandler.js
 */

'use strict';

/**
 * Custom API Error class
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode || 500;
    this.code       = code       || 'SERVER_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Send error response in consistent format
 */
function sendError(res, statusCode, message, code, data) {
  return res.status(statusCode).json({
    success: false,
    message: message || 'An error occurred.',
    code:    code    || 'ERROR',
    data:    data    || null,
  });
}

/**
 * Send success response in consistent format
 */
function sendSuccess(res, statusCode, message, data) {
  return res.status(statusCode).json({
    success: true,
    message: message || 'Success.',
    data:    data    || null,
  });
}

/**
 * Global Express error middleware
 * Must be registered last in app.js
 */
function globalErrorHandler(err, req, res, next) {
  console.error('[Error]', err.message);

  // Known operational errors
  if (err.isOperational) {
    return sendError(res, err.statusCode, err.message, err.code);
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 409, 'This email is already registered.', 'DUPLICATE_ENTRY');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid token.', 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Token expired.', 'TOKEN_EXPIRED');
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return sendError(res, 422, 'Validation failed.', 'VALIDATION_ERROR', err.errors);
  }

  // Unknown errors — don't leak details in production
  const message = process.env.NODE_ENV === 'development'
    ? err.message
    : 'Something went wrong. Please try again.';

  return sendError(res, 500, message, 'SERVER_ERROR');
}

module.exports = { AppError, sendError, sendSuccess, globalErrorHandler };