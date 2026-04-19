/**
 * EduVerse — Exam Socket Handler
 * socket/exam.socket.js
 *
 * Real-time exam monitoring:
 * - Student joins exam → instructor sees it
 * - Tab switch detected → logged + instructor alerted
 * - Student submits → instructor sees it in real time
 */

'use strict';

const db = require('../config/db');

module.exports = function examHandler(io, socket) {
  const userId = socket.user.id;
  const role   = socket.user.role;

  /* ══════════════════════════════════════
     STUDENT: JOIN EXAM
  ══════════════════════════════════════ */
  socket.on('exam:join', async ({ quiz_id }) => {
    try {
      const room = `exam:${quiz_id}`;
      socket.join(room);

      // Get student name
      const [[student]] = await db.query(
        'SELECT full_name FROM user_profiles WHERE user_id = ?', [userId]
      );

      // Notify instructor room
      io.to(`exam-monitor:${quiz_id}`).emit('exam:student-joined', {
        student_id:   userId,
        student_name: student?.full_name,
        time:         new Date().toISOString(),
      });

      console.log(`[Socket] Student ${userId} joined exam:${quiz_id}`);
    } catch (err) {
      console.error('[Socket] exam:join error:', err.message);
    }
  });

  /* ══════════════════════════════════════
     INSTRUCTOR: MONITOR EXAM
  ══════════════════════════════════════ */
  socket.on('exam:monitor', ({ quiz_id }) => {
    if (role !== 'instructor' && role !== 'institute' && role !== 'superadmin') return;
    socket.join(`exam-monitor:${quiz_id}`);
    console.log(`[Socket] Instructor ${userId} monitoring exam:${quiz_id}`);
  });

  /* ══════════════════════════════════════
     STUDENT: TAB SWITCH DETECTED
  ══════════════════════════════════════ */
  socket.on('exam:tab-switch', async ({ quiz_id, attempt_id }) => {
    try {
      // Log to audit
      await db.query(
        "INSERT INTO audit_logs (user_id, action, reference_type, reference_id) VALUES (?, 'exam_tab_switch', 'quiz_attempt', ?)",
        [userId, attempt_id]
      );

      // Get student name
      const [[student]] = await db.query(
        'SELECT full_name FROM user_profiles WHERE user_id = ?', [userId]
      );

      // Alert instructor monitor
      io.to(`exam-monitor:${quiz_id}`).emit('exam:tab-switch-alert', {
        student_id:   userId,
        student_name: student?.full_name,
        attempt_id,
        time:         new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Socket] exam:tab-switch error:', err.message);
    }
  });

  /* ══════════════════════════════════════
     STUDENT: SUBMIT EXAM
  ══════════════════════════════════════ */
  socket.on('exam:submit', async ({ quiz_id, attempt_id, score, total }) => {
    try {
      const [[student]] = await db.query(
        'SELECT full_name FROM user_profiles WHERE user_id = ?', [userId]
      );

      io.to(`exam-monitor:${quiz_id}`).emit('exam:student-submitted', {
        student_id:   userId,
        student_name: student?.full_name,
        attempt_id,
        score,
        total,
        time:         new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Socket] exam:submit error:', err.message);
    }
  });

  /* ══════════════════════════════════════
     VIDEO PROGRESS (real-time)
  ══════════════════════════════════════ */
  socket.on('progress:video-update', async ({ video_id, course_id, watched_seconds, completed }) => {
    try {
      // Upsert video progress
      await db.query(`
        INSERT INTO video_progress (student_id, video_id, watched_seconds, completed, last_watched_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          watched_seconds = GREATEST(watched_seconds, ?),
          completed       = GREATEST(completed, ?),
          last_watched_at = NOW()
      `, [userId, video_id, watched_seconds, completed ? 1 : 0, watched_seconds, completed ? 1 : 0]);

      // Recalculate course completion
      if (course_id) {
        const [[total]]     = await db.query(
          `SELECT COUNT(*) AS cnt FROM videos v
           JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = ?`,
          [course_id]
        );
        const [[completed_]] = await db.query(
          `SELECT COUNT(*) AS cnt FROM video_progress vp
           JOIN videos v ON v.id = vp.video_id
           JOIN course_modules cm ON cm.id = v.module_id
           WHERE cm.course_id = ? AND vp.student_id = ? AND vp.completed = 1`,
          [course_id, userId]
        );

        const pct = total.cnt > 0
          ? Math.round((completed_.cnt / total.cnt) * 100)
          : 0;

        await db.query(`
          INSERT INTO course_progress (student_id, course_id, completion_percentage, last_activity_at)
          VALUES (?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            completion_percentage = ?,
            last_activity_at = NOW(),
            completed_at = IF(? = 100 AND completed_at IS NULL, NOW(), completed_at)
        `, [userId, course_id, pct, pct, pct]);

        // Emit progress update to student
        socket.emit('progress:updated', { course_id, percentage: pct });

        // Auto-issue certificate if 100%
        if (pct === 100) {
          const [[existing]] = await db.query(
            'SELECT id FROM certificates WHERE student_id = ? AND course_id = ?',
            [userId, course_id]
          );
          if (!existing) {
            const { v4: uuidv4 } = require('uuid');
            const [[course]] = await db.query('SELECT title FROM courses WHERE id = ?', [course_id]);
            const code = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16);
            await db.query(
              "INSERT INTO certificates (student_id, course_id, title, certificate_code, type) VALUES (?, ?, ?, ?, 'course_completion')",
              [userId, course_id, `${course?.title} — Certificate of Completion`, code]
            );
            socket.emit('notification:new', {
              title: '🎉 Certificate Earned!',
              body:  `You completed "${course?.title}" and earned a certificate!`,
              type:  'certificate',
            });
          }
        }
      }
    } catch (err) {
      console.error('[Socket] progress:video-update error:', err.message);
    }
  });
};