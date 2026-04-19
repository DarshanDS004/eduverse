/**
 * EduVerse — Discussion Forum Module
 * modules/discussions/discussions.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { protect, restrictTo } = require('../auth/auth.middleware');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

router.use(protect);

/* ── Get all posts for a course ── */
router.get('/course/:courseId', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT dp.id, dp.title, dp.body, dp.video_timestamp,
             dp.is_resolved, dp.is_pinned, dp.upvotes, dp.created_at,
             v.title AS video_title,
             up.full_name AS author_name, up.photo_url AS author_avatar,
             u.role AS author_role,
             (SELECT COUNT(*) FROM discussion_replies WHERE post_id = dp.id) AS reply_count
      FROM discussion_posts dp
      JOIN users u ON u.id = dp.student_id
      JOIN user_profiles up ON up.user_id = dp.student_id
      LEFT JOIN videos v ON v.id = dp.video_id
      WHERE dp.course_id = ?
      ORDER BY dp.is_pinned DESC, dp.created_at DESC
    `, [req.params.courseId]);

    return sendSuccess(res, 200, 'Posts loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Create a post ── */
router.post('/course/:courseId', async (req, res, next) => {
  try {
    const { title, body, video_id, video_timestamp } = req.body;
    if (!title || !body) return sendError(res, 400, 'Title and body are required.', 'MISSING_FIELDS');

    const [result] = await db.query(
      'INSERT INTO discussion_posts (course_id, video_id, student_id, title, body, video_timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.courseId, video_id || null, req.user.id, title, body, video_timestamp || null]
    );

    return sendSuccess(res, 201, 'Post created.', { id: result.insertId });
  } catch (e) { next(e); }
});

/* ── Get replies for a post ── */
router.get('/posts/:postId/replies', async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT dr.id, dr.body, dr.upvotes, dr.created_at,
             up.full_name AS author_name, up.photo_url AS author_avatar, u.role
      FROM discussion_replies dr
      JOIN users u ON u.id = dr.user_id
      JOIN user_profiles up ON up.user_id = dr.user_id
      WHERE dr.post_id = ?
      ORDER BY dr.created_at ASC
    `, [req.params.postId]);

    return sendSuccess(res, 200, 'Replies loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Create a reply ── */
router.post('/posts/:postId/replies', async (req, res, next) => {
  try {
    const { body } = req.body;
    if (!body) return sendError(res, 400, 'Body is required.', 'MISSING_FIELDS');

    const [result] = await db.query(
      'INSERT INTO discussion_replies (post_id, user_id, body) VALUES (?, ?, ?)',
      [req.params.postId, req.user.id, body]
    );

    // Notify post author
    const [[post]] = await db.query(
      'SELECT student_id, title FROM discussion_posts WHERE id = ?',
      [req.params.postId]
    );
    if (post && post.student_id !== req.user.id) {
      const [[replier]] = await db.query(
        'SELECT full_name FROM user_profiles WHERE user_id = ?',
        [req.user.id]
      );
      await db.query(
        "INSERT INTO notifications (user_id, title, body, type) VALUES (?, 'New Reply on Your Post', ?, 'discussion')",
        [post.student_id, `${replier?.full_name} replied to your post: "${post.title}"`]
      );
    }

    return sendSuccess(res, 201, 'Reply added.', { id: result.insertId });
  } catch (e) { next(e); }
});

/* ── Upvote a post ── */
router.post('/posts/:postId/upvote', async (req, res, next) => {
  try {
    await db.query(
      'INSERT IGNORE INTO post_upvotes (post_id, user_id) VALUES (?, ?)',
      [req.params.postId, req.user.id]
    );
    await db.query(
      'UPDATE discussion_posts SET upvotes = (SELECT COUNT(*) FROM post_upvotes WHERE post_id = ?) WHERE id = ?',
      [req.params.postId, req.params.postId]
    );
    return sendSuccess(res, 200, 'Upvoted.');
  } catch (e) { next(e); }
});

/* ── Mark post as resolved (author only) ── */
router.patch('/posts/:postId/resolve', async (req, res, next) => {
  try {
    await db.query(
      'UPDATE discussion_posts SET is_resolved = 1 WHERE id = ? AND student_id = ?',
      [req.params.postId, req.user.id]
    );
    return sendSuccess(res, 200, 'Post marked as resolved.');
  } catch (e) { next(e); }
});

/* ── Pin post (instructor/institute only) ── */
router.patch('/posts/:postId/pin', restrictTo('instructor', 'institute'), async (req, res, next) => {
  try {
    await db.query(
      'UPDATE discussion_posts SET is_pinned = 1 WHERE id = ?',
      [req.params.postId]
    );
    return sendSuccess(res, 200, 'Post pinned.');
  } catch (e) { next(e); }
});

/* ── Delete post (instructor/institute/superadmin) ── */
router.delete('/posts/:postId', restrictTo('instructor', 'institute', 'superadmin'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM discussion_posts WHERE id = ?', [req.params.postId]);
    return sendSuccess(res, 200, 'Post deleted.');
  } catch (e) { next(e); }
});

module.exports = router;