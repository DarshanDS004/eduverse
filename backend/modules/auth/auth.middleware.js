/**
 * EduVerse — Auth Middleware (COMBINED)
 * modules/auth/auth.middleware.js
 *
 * Merges all features from both middleware versions:
 *  - AppError / sendError abstraction (v1) with inline JSON fallback (v2)
 *  - DB verification of user existence + is_active check (v2)
 *  - Token string sanity check ('null' / 'undefined') (v2)
 *  - Nested try/catch so every path always returns JSON, never an empty body (v2)
 *  - restrictTo() with required-role hint in error message (v2)
 *  - optionalAuth() with DB-backed role lookup (v1 pattern applied to v2)
 */

'use strict';

const jwt                     = require('jsonwebtoken');
const { AppError, sendError } = require('../../shared/errorHandler');
const db                      = require('../../config/db');

/* ─────────────────────────────────────────────
 * Helper — unified error responder
 * Tries the shared sendError helper first (v1).
 * Falls back to inline res.status().json() so the
 * response body is NEVER empty even if errorHandler
 * is misconfigured (v2 guarantee).
 * ───────────────────────────────────────────── */
function _sendAuthError(res, status, message, code) {
  try {
    return sendError(res, status, message, code);
  } catch (_) {
    return res.status(status).json({ success: false, message, code });
  }
}

/* ─────────────────────────────────────────────
 * protect — verifies JWT and attaches req.user
 *
 * Flow:
 *  1. Extract + sanity-check Bearer token
 *  2. Verify signature (inner try/catch for JWT errors)
 *  3. Confirm user still exists in DB
 *  4. Confirm account is active
 *  5. Attach { id, role, email } to req.user
 *
 * Never returns an empty body — every failure path
 * calls _sendAuthError() which guarantees JSON output.
 * ───────────────────────────────────────────── */
async function protect(req, res, next) {
  try {
    // ── 1. Token extraction ──────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return _sendAuthError(res, 401, 'Authentication required. Please log in.', 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];

    // Guard against frontend bugs that send the literal string "null"/"undefined"
    if (!token || token === 'null' || token === 'undefined') {
      return _sendAuthError(res, 401, 'Invalid token. Please log in again.', 'INVALID_TOKEN');
    }

    // ── 2. JWT verification (isolated so only JWT errors land here) ──
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return _sendAuthError(res, 401, 'Session expired. Please log in again.', 'TOKEN_EXPIRED');
      }
      return _sendAuthError(res, 401, 'Invalid token. Please log in again.', 'INVALID_TOKEN');
    }

    // ── 3. DB verification — user must still exist ───────
    const [[user]] = await db.query(
      'SELECT id, role, email, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return _sendAuthError(res, 401, 'User no longer exists.', 'USER_NOT_FOUND');
    }

    // ── 4. Account must be active ────────────────────────
    if (!user.is_active) {
      return _sendAuthError(res, 403, 'Your account has been deactivated.', 'ACCOUNT_INACTIVE');
    }

    // ── 5. Attach fresh user info from DB ────────────────
    req.user = {
      id:    user.id,
      role:  user.role,
      email: user.email,   // retained from v1; sourced from DB not JWT payload
    };

    next();
  } catch (err) {
    // DB errors or any unexpected failure — always return JSON, never an empty body
    console.error('[Auth Middleware Error]', err.message);
    return _sendAuthError(
      res, 500,
      'Authentication check failed. Please try again.',
      'AUTH_ERROR'
    );
  }
}

/* ─────────────────────────────────────────────
 * restrictTo — role-based access control
 *
 * Must be used AFTER protect().
 * Usage: restrictTo('superadmin', 'institute')
 *
 * Error message tells the client which roles are
 * accepted (v2 improvement over silent 403).
 * ───────────────────────────────────────────── */
function restrictTo(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return _sendAuthError(res, 401, 'Not authenticated.', 'NOT_AUTHENTICATED');
    }

    if (!roles.includes(req.user.role)) {
      return _sendAuthError(
        res, 403,
        `Access denied. Required role: ${roles.join(' or ')}.`,
        'FORBIDDEN'
      );
    }

    next();
  };
}

/* ─────────────────────────────────────────────
 * optionalAuth — decodes JWT if present, never rejects
 *
 * Used on public routes where logged-in users get
 * extra data (e.g. "is this course saved?").
 *
 * Improvement over v2: role is fetched from DB
 * (not trusted from JWT payload) so role changes
 * are reflected immediately even on optional routes.
 * ───────────────────────────────────────────── */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') return next();

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      // Invalid or expired token on an optional route — continue as guest
      return next();
    }

    // DB lookup — same as protect() so role is always fresh
    const [[user]] = await db.query(
      'SELECT id, role, email, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    // Only attach if user exists and is active; otherwise treat as guest
    if (user && user.is_active) {
      req.user = {
        id:    user.id,
        role:  user.role,
        email: user.email,
      };
    }
  } catch (err) {
    // Any DB or unexpected error — log and continue as guest, never reject
    console.error('[optionalAuth Error]', err.message);
  }

  next();
}

module.exports = { protect, restrictTo, optionalAuth };