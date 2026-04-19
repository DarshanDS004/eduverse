/**
 * EduVerse — Payments Routes
 * modules/payments/payments.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('./payments.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

/* Public webhook — no auth (verified by signature) */
router.post('/webhook/razorpay', ctrl.razorpayWebhook);

/* Protected routes */
router.use(protect);

router.post('/create-order',     ctrl.createOrder);
router.post('/verify',           ctrl.verifyPayment);
router.get('/history',           ctrl.getHistory);
router.post('/refund-request',   ctrl.requestRefund);
router.get('/refund-status/:id', ctrl.getRefundStatus);

module.exports = router;