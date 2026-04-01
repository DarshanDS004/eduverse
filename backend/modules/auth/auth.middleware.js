/**
 * EduVerse — Auth Middleware
 * modules/auth/auth.middleware.js
 */

'use strict';

const jwt                            = require('jsonwebtoken');
const { AppError, sendError }        = require('../../shared/errorHandler');

/**
 * Verify JWT token on protected routes
 */
async function protect(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, 'Access denied. Please log in.', 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request
    req.user = {
      id:   decoded.id,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Session expired. Please log in again.', 'TOKEN_EXPIRED');
    }
    return sendError(res, 401, 'Invalid token. Please log in again.', 'INVALID_TOKEN');
  }
}

/**
 * Restrict access to specific roles
 * Usage: restrictTo('superadmin', 'institute')
 */
function restrictTo(...roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        'You do not have permission to perform this action.',
        'FORBIDDEN'
      );
    }
    next();
  };
}

module.exports = { protect, restrictTo };