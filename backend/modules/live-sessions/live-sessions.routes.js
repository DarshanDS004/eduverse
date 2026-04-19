/**
 * EduVerse — Live Sessions Standalone Module
 * modules/live-sessions/live-sessions.routes.js
 *
 * Student-facing live session endpoints.
 * Instructor CRUD is handled in instructor.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { protect, restrictTo } = require('../auth/auth.middleware');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

router.use(protect);

/* ── Get upcoming sessions for student ── */
router.get('/upcoming', restrictTo('student'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT ls.id, ls.title, ls.description, ls.scheduled_at,
             ls.duration_minutes, ls.meeting_link, ls.platform, ls.status,
             c.title AS course_title,
             up.full_name AS instructor_name
      FROM live_sessions ls
      JOIN enrollments e ON e.course_id = ls.course_id AND e.student_id = ?
      JOIN courses c ON c.id = ls.course_id
      JOIN user_profiles up ON up.user_id = ls.instructor_id
      WHERE ls.scheduled_at >= NOW() AND ls.status = 'scheduled'
      ORDER BY ls.scheduled_at ASC
      LIMIT 10
    `, [req.user.id]);

    return sendSuccess(res, 200, 'Upcoming sessions loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Get past sessions with recordings ── */
router.get('/recordings/my', restrictTo('student'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT ls.id, ls.title, ls.scheduled_at, ls.recording_url,
             c.title AS course_title, up.full_name AS instructor_name
      FROM live_sessions ls
      JOIN enrollments e ON e.course_id = ls.course_id AND e.student_id = ?
      JOIN courses c ON c.id = ls.course_id
      JOIN user_profiles up ON up.user_id = ls.instructor_id
      WHERE ls.status = 'ended' AND ls.recording_url IS NOT NULL
      ORDER BY ls.scheduled_at DESC
    `, [req.user.id]);

    return sendSuccess(res, 200, 'Recordings loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Get session detail ── */
router.get('/:id', async (req, res, next) => {
  try {
    const [[session]] = await db.query(`
      SELECT ls.*, c.title AS course_title, up.full_name AS instructor_name
      FROM live_sessions ls
      LEFT JOIN courses c ON c.id = ls.course_id
      JOIN user_profiles up ON up.user_id = ls.instructor_id
      WHERE ls.id = ?
    `, [req.params.id]);

    if (!session) return sendError(res, 404, 'Session not found.', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Session loaded.', session);
  } catch (e) { next(e); }
});

module.exports = router;