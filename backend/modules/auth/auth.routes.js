/**
 * EduVerse — Auth Routes
 * modules/auth/auth.routes.js
 */

'use strict';

const express        = require('express');
const router         = express.Router();
const authController = require('./auth.controller');
const { protect }    = require('./auth.middleware');

/* ── Public Routes ── */
router.post('/register',             authController.register);
router.post('/verify-email',         authController.verifyEmail);
router.post('/resend-verification',  authController.resendVerification);
router.post('/login',                authController.login);
router.post('/refresh-token',        authController.refreshToken);
router.post('/forgot-password',      authController.forgotPassword);
router.post('/reset-password',       authController.resetPassword);

/* ── Protected Routes ── */
router.post('/logout',   protect, authController.logout);
router.get('/me',        protect, authController.getMe);

module.exports = router;