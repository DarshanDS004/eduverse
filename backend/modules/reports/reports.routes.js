/**
 * EduVerse — Reports Module
 * modules/reports/reports.routes.js
 *
 * Generates data reports for all roles.
 * Student, Course, Institute, Platform reports.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { protect, restrictTo } = require('../auth/auth.middleware');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

router.use(protect);

/* ── Student performance report ── */
router.get('/student/:id', async (req, res, next) => {
  try {
    const [[student]] = await db.query(
      'SELECT up.full_name, u.email, up.grade FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?',
      [req.params.id]
    );
    if (!student) return sendError(res, 404, 'Student not found.', 'NOT_FOUND');

    const [quizzes] = await db.query(
      'SELECT q.title, qa.score, qa.total_marks, qa.percentage, qa.passed, qa.submitted_at FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL ORDER BY qa.submitted_at DESC',
      [req.params.id]
    );

    const [assignments] = await db.query(
      'SELECT a.title, s.score, a.max_marks, s.status FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.student_id = ? ORDER BY s.submitted_at DESC',
      [req.params.id]
    );

    const [[attendance]] = await db.query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN status="present" THEN 1 ELSE 0 END) AS present FROM attendance_records WHERE student_id = ?',
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Report loaded.', {
      student,
      quizzes,
      assignments,
      attendance: {
        ...attendance,
        percentage: attendance.total
          ? Math.round((attendance.present / attendance.total) * 100)
          : 0,
      },
    });
  } catch (e) { next(e); }
});

/* ── Course report (instructor/institute/superadmin) ── */
router.get('/course/:id', restrictTo('instructor', 'institute', 'superadmin'), async (req, res, next) => {
  try {
    const [[course]] = await db.query(
      'SELECT id, title, enrolled_count, avg_rating FROM courses WHERE id = ?',
      [req.params.id]
    );
    if (!course) return sendError(res, 404, 'Course not found.', 'NOT_FOUND');

    const [[quizStats]] = await db.query(
      'SELECT COUNT(*) AS attempts, ROUND(AVG(percentage),1) AS avg_score, SUM(passed) AS passed FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE q.course_id = ? AND qa.submitted_at IS NOT NULL',
      [req.params.id]
    );

    const [[assignStats]] = await db.query(
      'SELECT COUNT(*) AS submissions, SUM(CASE WHEN status="graded" THEN 1 ELSE 0 END) AS graded FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ?',
      [req.params.id]
    );

    const [[videoStats]] = await db.query(
      'SELECT COUNT(DISTINCT vp.student_id) AS watchers, ROUND(AVG(CASE WHEN vp.completed=1 THEN 100 ELSE (vp.watched_seconds/NULLIF(v.duration*60,0))*100 END),1) AS avg_completion FROM video_progress vp JOIN videos v ON v.id = vp.video_id JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = ?',
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Course report loaded.', {
      course,
      quiz_stats:   quizStats,
      assign_stats: assignStats,
      video_stats:  videoStats,
    });
  } catch (e) { next(e); }
});

/* ── Institute report (institute/superadmin) ── */
router.get('/institute/:id', restrictTo('institute', 'superadmin'), async (req, res, next) => {
  try {
    const [[inst]] = await db.query(
      'SELECT id, name, type FROM institutes WHERE id = ?',
      [req.params.id]
    );
    if (!inst) return sendError(res, 404, 'Institute not found.', 'NOT_FOUND');

    const [[members]] = await db.query(
      'SELECT SUM(CASE WHEN role="student" THEN 1 ELSE 0 END) AS students, SUM(CASE WHEN role="teacher" THEN 1 ELSE 0 END) AS teachers FROM institute_members WHERE institute_id = ?',
      [req.params.id]
    );

    const [[fees]] = await db.query(
      'SELECT COALESCE(SUM(CASE WHEN status="paid" THEN amount ELSE 0 END),0) AS collected, COALESCE(SUM(CASE WHEN status!="paid" THEN amount ELSE 0 END),0) AS pending FROM student_fees WHERE institute_id = ?',
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Institute report loaded.', {
      institute: inst,
      members,
      fees,
    });
  } catch (e) { next(e); }
});

/* ── Platform report (superadmin only) ── */
router.get('/platform', restrictTo('superadmin'), async (req, res, next) => {
  try {
    const [[users]]      = await db.query("SELECT COUNT(*) AS total FROM users WHERE role != 'superadmin'");
    const [[courses]]    = await db.query("SELECT COUNT(*) AS total FROM courses WHERE status = 'published'");
    const [[enrolls]]    = await db.query('SELECT COUNT(*) AS total FROM enrollments');
    const [[revenue]]    = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status='success'");
    const [[institutes]] = await db.query("SELECT COUNT(*) AS total FROM institutes WHERE status='active'");

    return sendSuccess(res, 200, 'Platform report loaded.', {
      users:             users.total,
      courses:           courses.total,
      enrollments:       enrolls.total,
      revenue:           parseFloat(revenue.total),
      active_institutes: institutes.total,
    });
  } catch (e) { next(e); }
});

module.exports = router;