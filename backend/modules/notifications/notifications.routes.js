/**
 * EduVerse — Notifications Routes (standalone)
 * modules/notifications/notifications.routes.js
 *
 * Mirrors the student notification routes at /api/v1/notifications
 * so frontend api.js calls like Api.notifications.list() work correctly.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const { protect } = require('../auth/auth.middleware');
const db         = require('../../config/db');
const { sendSuccess } = require('../../shared/errorHandler');

router.use(protect);

// GET /api/v1/notifications
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const [rows] = await db.query(
      `SELECT id, title, body, type, is_read, created_at
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [req.user.id, limit]
    );
    return sendSuccess(res, 200, 'Notifications fetched.', rows);
  } catch (err) { next(err); }
});

// PATCH /api/v1/notifications/mark-all-read
router.patch('/mark-all-read', async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    return sendSuccess(res, 200, 'All notifications marked as read.');
  } catch (err) { next(err); }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return sendSuccess(res, 200, 'Notification marked as read.');
  } catch (err) { next(err); }
});

// DELETE /api/v1/notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return sendSuccess(res, 200, 'Notification deleted.');
  } catch (err) { next(err); }
});

module.exports = router;