/**
 * EduVerse — Assignments Standalone Module
 * modules/assignments/assignments.routes.js
 *
 * NOTE: Instructor assignment CRUD is in instructor.routes.js
 * This module handles: student-facing + submission viewing endpoints
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { protect, restrictTo } = require('../auth/auth.middleware');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

router.use(protect);

/* ── Get assignments for a course (student) ── */
router.get('/course/:courseId', restrictTo('student'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id, a.title, a.description, a.deadline, a.max_marks,
             s.status, s.score, s.feedback, s.submitted_at
      FROM assignments a
      JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
      LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
      WHERE a.course_id = ? AND a.status = 'published'
      ORDER BY a.deadline ASC
    `, [req.user.id, req.user.id, req.params.courseId]);

    return sendSuccess(res, 200, 'Assignments loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Get single assignment ── */
router.get('/:id', async (req, res, next) => {
  try {
    const [[assignment]] = await db.query(
      'SELECT id, title, description, deadline, max_marks, allowed_types, rubric FROM assignments WHERE id = ?',
      [req.params.id]
    );
    if (!assignment) return sendError(res, 404, 'Assignment not found.', 'NOT_FOUND');
    return sendSuccess(res, 200, 'Assignment loaded.', assignment);
  } catch (e) { next(e); }
});

/* ── Get all submissions for an assignment (instructor/institute) ── */
router.get('/:id/submissions', restrictTo('instructor', 'institute'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT s.id, s.text, s.file_url, s.file_name, s.status,
             s.score, s.feedback, s.submitted_at, s.graded_at,
             up.full_name AS student_name, u.email AS student_email
      FROM assignment_submissions s
      JOIN users u ON u.id = s.student_id
      JOIN user_profiles up ON up.user_id = s.student_id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `, [req.params.id]);

    return sendSuccess(res, 200, 'Submissions loaded.', rows);
  } catch (e) { next(e); }
});

module.exports = router;