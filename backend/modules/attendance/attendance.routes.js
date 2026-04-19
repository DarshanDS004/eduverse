/**
 * EduVerse — Attendance Module
 * modules/attendance/attendance.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { protect, restrictTo } = require('../auth/auth.middleware');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

router.use(protect);

/* ── Create attendance session (instructor/institute) ── */
router.post('/sessions', restrictTo('instructor', 'institute'), async (req, res, next) => {
  try {
    const { class_id, subject, date, live_session_id } = req.body;
    if (!class_id || !date) return sendError(res, 400, 'class_id and date are required.', 'MISSING_FIELDS');

    const [result] = await db.query(
      'INSERT INTO attendance_sessions (class_id, instructor_id, subject, date, live_session_id) VALUES (?, ?, ?, ?, ?)',
      [class_id, req.user.id, subject || null, date, live_session_id || null]
    );
    return sendSuccess(res, 201, 'Session created.', { id: result.insertId });
  } catch (e) { next(e); }
});

/* ── Mark attendance ── */
router.post('/sessions/:id/mark', restrictTo('instructor', 'institute'), async (req, res, next) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) return sendError(res, 400, 'records must be an array.', 'INVALID_INPUT');

    for (const rec of records) {
      await db.query(
        'INSERT INTO attendance_records (attendance_session_id, student_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
        [req.params.id, rec.student_id, rec.status || 'present', rec.status || 'present']
      );
    }

    return sendSuccess(res, 200, 'Attendance marked.', { count: records.length });
  } catch (e) { next(e); }
});

/* ── Get student's own attendance ── */
router.get('/my', restrictTo('student'), async (req, res, next) => {
  try {
    const [records] = await db.query(`
      SELECT ats.date, ats.subject, ar.status, c.name AS class_name
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
      JOIN classes c ON c.id = ats.class_id
      WHERE ar.student_id = ?
      ORDER BY ats.date DESC
    `, [req.user.id]);

    const total      = records.length;
    const present    = records.filter(r => r.status === 'present').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return sendSuccess(res, 200, 'Attendance loaded.', {
      records,
      summary: { total, present, percentage },
    });
  } catch (e) { next(e); }
});

/* ── Get class attendance (instructor) ── */
router.get('/class/:classId', restrictTo('instructor', 'institute'), async (req, res, next) => {
  try {
    const { date } = req.query;
    const where  = ['ats.class_id = ?'];
    const params = [req.params.classId];
    if (date) { where.push('ats.date = ?'); params.push(date); }

    const [rows] = await db.query(`
      SELECT up.full_name AS student_name, ar.status, ats.date, ats.subject
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
      JOIN user_profiles up ON up.user_id = ar.student_id
      WHERE ${where.join(' AND ')}
      ORDER BY ats.date DESC
    `, params);

    return sendSuccess(res, 200, 'Class attendance loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Get student attendance (instructor view) ── */
router.get('/student/:studentId', restrictTo('instructor', 'institute'), async (req, res, next) => {
  try {
    const [records] = await db.query(`
      SELECT ats.date, ats.subject, ar.status, c.name AS class_name
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
      JOIN classes c ON c.id = ats.class_id
      WHERE ar.student_id = ?
      ORDER BY ats.date DESC
    `, [req.params.studentId]);

    const total   = records.length;
    const present = records.filter(r => r.status === 'present').length;

    return sendSuccess(res, 200, 'Student attendance loaded.', {
      records,
      summary: { total, present, percentage: total ? Math.round((present / total) * 100) : 0 },
    });
  } catch (e) { next(e); }
});

module.exports = router;