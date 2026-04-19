/**
 * EduVerse — Payments Controller
 * modules/payments/payments.controller.js
 */

'use strict';

const svc = require('./payments.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

exports.createOrder = async (req, res, next) => {
  try {
    const { type, reference_id, coupon_code } = req.body;
    if (!type || !reference_id)
      return sendError(res, 400, 'type and reference_id are required.', 'MISSING_FIELDS');
    return sendSuccess(res, 200, 'Order created.', await svc.createOrder(req.user.id, type, reference_id, coupon_code));
  } catch (e) { next(e); }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_db_id } = req.body;
    return sendSuccess(res, 200, 'Payment verified.', await svc.verifyPayment(req.user.id, { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_db_id }));
  } catch (e) { next(e); }
};

exports.getHistory = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'History loaded.', await svc.getHistory(req.user.id, req.query)); }
  catch (e) { next(e); }
};

exports.requestRefund = async (req, res, next) => {
  try {
    const { payment_id, reason } = req.body;
    if (!payment_id || !reason)
      return sendError(res, 400, 'payment_id and reason are required.', 'MISSING_FIELDS');
    return sendSuccess(res, 200, 'Refund requested.', await svc.requestRefund(req.user.id, payment_id, reason));
  } catch (e) { next(e); }
};

exports.getRefundStatus = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Refund status loaded.', await svc.getRefundStatus(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

exports.razorpayWebhook = async (req, res, next) => {
  try {
    await svc.handleWebhook(req.body, req.headers['x-razorpay-signature']);
    return res.json({ success: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    return res.status(400).json({ success: false });
  }
};