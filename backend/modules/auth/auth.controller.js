/**
 * EduVerse — Auth Controller
 * modules/auth/auth.controller.js
 */

'use strict';

const authService                = require('./auth.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return sendSuccess(res, 201, result.message, result);
  } catch (err) { next(err); }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) return sendError(res, 400, 'Verification token is required.', 'MISSING_TOKEN');
    const result = await authService.verifyEmail(token);
    return sendSuccess(res, 200, result.message, result);
  } catch (err) { next(err); }
}

async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'Email is required.', 'MISSING_EMAIL');
    const result = await authService.resendVerification(email);
    return sendSuccess(res, 200, result.message, result);
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password are required.', 'MISSING_FIELDS');
    const result = await authService.login(email, password);
    return sendSuccess(res, 200, 'Login successful.', result);
  } catch (err) { next(err); }
}

async function refreshToken(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return sendError(res, 400, 'Refresh token is required.', 'MISSING_TOKEN');
    const result = await authService.refreshToken(refresh_token);
    return sendSuccess(res, 200, 'Token refreshed.', result);
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const { refresh_token } = req.body;
    const userId = req.user ? req.user.id : null;
    const result = await authService.logout(userId, refresh_token);
    return sendSuccess(res, 200, result.message);
  } catch (err) { next(err); }
}

async function getMe(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id);
    return sendSuccess(res, 200, 'User fetched successfully.', result);
  } catch (err) { next(err); }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 400, 'Email is required.', 'MISSING_EMAIL');
    const result = await authService.forgotPassword(email);
    return sendSuccess(res, 200, result.message);
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return sendError(res, 400, 'Token and password are required.', 'MISSING_FIELDS');
    const result = await authService.resetPassword(token, password);
    return sendSuccess(res, 200, result.message);
  } catch (err) { next(err); }
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};