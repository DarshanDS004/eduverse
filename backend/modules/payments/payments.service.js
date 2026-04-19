/**
 * EduVerse — Payments Service
 * modules/payments/payments.service.js
 *
 * Razorpay integration for:
 * - Course purchases
 * - Study material purchases
 * - Institute fee payments
 * - Institute subscriptions
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const crypto       = require('crypto');

/* ── Razorpay instance (lazy load) ── */
function getRazorpay() {
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/* ============================================================
   CREATE ORDER
   type: course_purchase | material | fee | subscription
   reference_id: course_id | material_id | student_fee_id | institute_id
============================================================ */

async function createOrder(userId, type, referenceId, couponCode) {
  let amount    = 0;
  let currency  = 'INR';
  let courseId  = null;
  let instId    = null;

  switch (type) {
    case 'course_purchase': {
      const [[course]] = await db.query(
        "SELECT id, title, price, is_free, status FROM courses WHERE id = ? AND status = 'published'",
        [referenceId]
      );
      if (!course)          throw new AppError('Course not found.', 404, 'NOT_FOUND');
      if (course.is_free)   throw new AppError('This course is free. Enroll directly.', 400, 'FREE_COURSE');

      // Check already enrolled
      const [[enrolled]] = await db.query(
        'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
        [referenceId, userId]
      );
      if (enrolled) throw new AppError('You are already enrolled in this course.', 409, 'ALREADY_ENROLLED');

      amount   = course.price;
      courseId = course.id;

      // Apply coupon if provided
      if (couponCode) {
        const [[coupon]] = await db.query(
          "SELECT * FROM coupons WHERE code = ? AND (course_id = ? OR course_id IS NULL) AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)",
          [couponCode, referenceId]
        );
        if (coupon) {
          if (coupon.discount_type === 'percentage') {
            amount = amount - (amount * coupon.discount_value / 100);
          } else {
            amount = Math.max(0, amount - coupon.discount_value);
          }
        }
      }
      break;
    }

    case 'material': {
      const [[mat]] = await db.query(
        "SELECT id, price, is_free, status FROM study_materials WHERE id = ? AND status = 'published'",
        [referenceId]
      );
      if (!mat)          throw new AppError('Material not found.', 404, 'NOT_FOUND');
      if (mat.is_free)   throw new AppError('This material is free.', 400, 'FREE_MATERIAL');
      amount = mat.price;
      break;
    }

    case 'fee': {
      const [[fee]] = await db.query(
        "SELECT * FROM student_fees WHERE id = ? AND student_id = ? AND status IN ('pending','overdue')",
        [referenceId, userId]
      );
      if (!fee) throw new AppError('Fee record not found.', 404, 'NOT_FOUND');
      amount = fee.amount;
      instId = fee.institute_id;
      break;
    }

    case 'subscription': {
      // Institute subscription
      const [[inst]] = await db.query('SELECT * FROM institutes WHERE id = ?', [referenceId]);
      if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');
      // Get plan price from settings
      const [[planSetting]] = await db.query(
        "SELECT value FROM platform_settings WHERE `key` = ?",
        [`plan_price_${inst.subscription_plan}`]
      );
      amount = parseFloat(planSetting?.value || '999');
      instId = inst.id;
      break;
    }

    default:
      throw new AppError('Invalid payment type.', 400, 'INVALID_TYPE');
  }

  // Amount in paise (Razorpay uses smallest currency unit)
  const amountPaise = Math.round(amount * 100);

  if (amountPaise <= 0) throw new AppError('Invalid amount.', 400, 'INVALID_AMOUNT');

  // Create Razorpay order
  const razorpay = getRazorpay();
  const rzpOrder = await razorpay.orders.create({
    amount:   amountPaise,
    currency: currency,
    receipt:  `ev_${type}_${userId}_${Date.now()}`,
    notes:    { user_id: userId, type, reference_id: referenceId },
  });

  // Save payment record as pending
  const [result] = await db.query(`
    INSERT INTO payments
      (user_id, course_id, institute_id, amount, currency, gateway,
       gateway_order_id, type, status)
    VALUES (?, ?, ?, ?, ?, 'razorpay', ?, ?, 'pending')
  `, [userId, courseId, instId, amount, currency, rzpOrder.id, type]);

  return {
    payment_id:       result.insertId,
    razorpay_order_id: rzpOrder.id,
    razorpay_key:     process.env.RAZORPAY_KEY_ID,
    amount:           amount,
    amount_paise:     amountPaise,
    currency:         currency,
  };
}

/* ============================================================
   VERIFY PAYMENT (after Razorpay callback)
============================================================ */

async function verifyPayment(userId, data) {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    payment_db_id,
  } = data;

  // Verify signature
  const secret    = process.env.RAZORPAY_KEY_SECRET;
  const body      = razorpay_order_id + '|' + razorpay_payment_id;
  const expected  = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (expected !== razorpay_signature) {
    // Mark payment as failed
    if (payment_db_id) {
      await db.query(
        "UPDATE payments SET status = 'failed', failure_reason = 'Signature mismatch' WHERE id = ?",
        [payment_db_id]
      );
    }
    throw new AppError('Payment verification failed. Invalid signature.', 400, 'INVALID_SIGNATURE');
  }

  // Update payment record
  const [[payment]] = await db.query(
    'SELECT * FROM payments WHERE id = ? AND user_id = ?',
    [payment_db_id, userId]
  );

  if (!payment) throw new AppError('Payment record not found.', 404, 'NOT_FOUND');

  await db.query(`
    UPDATE payments SET
      status = 'success',
      gateway_payment_id = ?,
      gateway_signature = ?
    WHERE id = ?
  `, [razorpay_payment_id, razorpay_signature, payment_db_id]);

  // Fulfill the purchase
  await _fulfillPayment(payment, userId);

  return { message: 'Payment successful.', payment_id: payment_db_id };
}

/* ============================================================
   FULFILL PAYMENT (grant access after successful payment)
============================================================ */

async function _fulfillPayment(payment, userId) {
  switch (payment.type) {
    case 'course_purchase': {
      // Enroll student
      await db.query(
        "INSERT IGNORE INTO enrollments (student_id, course_id, payment_id, amount_paid, source) VALUES (?, ?, ?, ?, 'purchased')",
        [userId, payment.course_id, payment.gateway_payment_id, payment.amount]
      );
      // Increment enrolled count
      await db.query(
        'UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?',
        [payment.course_id]
      );
      // Notify student
      const [[course]] = await db.query('SELECT title FROM courses WHERE id = ?', [payment.course_id]);
      await db.query(
        "INSERT INTO notifications (user_id, title, body, type) VALUES (?, 'Enrollment Confirmed', ?, 'payment')",
        [userId, `You are now enrolled in "${course?.title}". Start learning!`]
      );
      break;
    }

    case 'material': {
      await db.query(
        "INSERT IGNORE INTO material_purchases (material_id, student_id, amount_paid, payment_id, payment_status) VALUES (?, ?, ?, ?, 'success')",
        [payment.course_id || 0, userId, payment.amount, payment.gateway_payment_id]
      );
      break;
    }

    case 'fee': {
      // Mark student fee as paid
      await db.query(
        "UPDATE student_fees SET status = 'paid', paid_at = NOW(), payment_id = ? WHERE student_id = ? AND status IN ('pending','overdue')",
        [payment.gateway_payment_id, userId]
      );
      break;
    }

    case 'subscription': {
      // Activate/extend institute subscription
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);

      await db.query(
        "UPDATE institutes SET status = 'active', subscription_start = ?, subscription_end = ? WHERE id = ?",
        [now, end, payment.institute_id]
      );
      break;
    }
  }
}

/* ============================================================
   PAYMENT HISTORY
============================================================ */

async function getHistory(userId, filters) {
  const { type, status, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, parseInt(per_page) || 10);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ['p.user_id = ?'];
  const params = [userId];
  if (type)   { where.push('p.type = ?');   params.push(type); }
  if (status) { where.push('p.status = ?'); params.push(status); }

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(`
    SELECT p.id, p.amount, p.currency, p.type, p.status,
           p.gateway_payment_id, p.created_at,
           c.title AS course_title
    FROM payments p
    LEFT JOIN courses c ON c.id = p.course_id
    ${whereSQL}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM payments p ${whereSQL}`, params
  );

  return {
    payments: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

/* ============================================================
   REFUND REQUEST
============================================================ */

async function requestRefund(userId, paymentId, reason) {
  // Verify payment belongs to user and was successful
  const [[payment]] = await db.query(
    "SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = 'success'",
    [paymentId, userId]
  );
  if (!payment) throw new AppError('Payment not found or not eligible for refund.', 404, 'NOT_FOUND');

  // Check no existing refund request
  const [[existing]] = await db.query(
    'SELECT id FROM refund_requests WHERE payment_id = ? AND status = "pending"',
    [paymentId]
  );
  if (existing) throw new AppError('A refund request already exists for this payment.', 409, 'ALREADY_REQUESTED');

  const [result] = await db.query(
    'INSERT INTO refund_requests (payment_id, student_id, reason) VALUES (?, ?, ?)',
    [paymentId, userId, reason]
  );

  return { id: result.insertId, message: 'Refund request submitted. We will process it within 3-5 business days.' };
}

async function getRefundStatus(refundId, userId) {
  const [[refund]] = await db.query(`
    SELECT rr.id, rr.reason, rr.status, rr.admin_note, rr.created_at, rr.resolved_at,
           p.amount, p.type AS payment_type
    FROM refund_requests rr
    JOIN payments p ON p.id = rr.payment_id
    WHERE rr.id = ? AND rr.student_id = ?
  `, [refundId, userId]);

  if (!refund) throw new AppError('Refund request not found.', 404, 'NOT_FOUND');
  return refund;
}

/* ============================================================
   RAZORPAY WEBHOOK (server-to-server event)
============================================================ */

async function handleWebhook(body, signature) {
  const secret   = process.env.RAZORPAY_WEBHOOK_SECRET;
  const payload  = JSON.stringify(body);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (expected !== signature) {
    throw new Error('Invalid webhook signature.');
  }

  const event = body.event;

  if (event === 'payment.captured') {
    const payment = body.payload.payment.entity;
    const orderId = payment.order_id;

    // Find our payment record
    const [[dbPayment]] = await db.query(
      'SELECT * FROM payments WHERE gateway_order_id = ? AND status = "pending"',
      [orderId]
    );

    if (dbPayment) {
      await db.query(
        "UPDATE payments SET status = 'success', gateway_payment_id = ? WHERE id = ?",
        [payment.id, dbPayment.id]
      );
      await _fulfillPayment(dbPayment, dbPayment.user_id);
    }
  }

  if (event === 'payment.failed') {
    const payment = body.payload.payment.entity;
    await db.query(
      "UPDATE payments SET status = 'failed', failure_reason = ? WHERE gateway_order_id = ?",
      [payment.error_description || 'Payment failed', payment.order_id]
    );
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  getHistory,
  requestRefund,
  getRefundStatus,
  handleWebhook,
};