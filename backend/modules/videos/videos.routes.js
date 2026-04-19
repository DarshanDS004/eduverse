/**
 * EduVerse — Videos Module
 * modules/videos/videos.routes.js
 *
 * Handles video progress tracking, personal notes,
 * and bookmarks for students.
 */

'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { protect, restrictTo } = require('../auth/auth.middleware');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

router.use(protect);

/* ══════════════════════════════════════
   PROGRESS
══════════════════════════════════════ */

/* ── Update video progress ── */
router.post('/:id/progress', restrictTo('student'), async (req, res, next) => {
  try {
    const { watched_seconds, completed, course_id } = req.body;

    await db.query(`
      INSERT INTO video_progress (student_id, video_id, watched_seconds, completed, last_watched_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        watched_seconds = GREATEST(watched_seconds, ?),
        completed       = GREATEST(completed, ?),
        last_watched_at = NOW()
    `, [
      req.user.id, req.params.id,
      watched_seconds || 0, completed ? 1 : 0,
      watched_seconds || 0, completed ? 1 : 0,
    ]);

    // Recalculate course completion percentage if course_id provided
    if (course_id) {
      const [[totalVids]] = await db.query(
        'SELECT COUNT(*) AS cnt FROM videos v JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = ?',
        [course_id]
      );
      const [[doneVids]] = await db.query(
        'SELECT COUNT(*) AS cnt FROM video_progress vp JOIN videos v ON v.id = vp.video_id JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = ? AND vp.student_id = ? AND vp.completed = 1',
        [course_id, req.user.id]
      );

      const pct = totalVids.cnt > 0
        ? Math.round((doneVids.cnt / totalVids.cnt) * 100)
        : 0;

      await db.query(`
        INSERT INTO course_progress (student_id, course_id, completion_percentage, last_activity_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          completion_percentage = ?,
          last_activity_at = NOW(),
          completed_at = IF(? = 100 AND completed_at IS NULL, NOW(), completed_at)
      `, [req.user.id, course_id, pct, pct, pct]);

      return sendSuccess(res, 200, 'Progress updated.', { percentage: pct });
    }

    return sendSuccess(res, 200, 'Progress updated.');
  } catch (e) { next(e); }
});

/* ── Get video progress ── */
router.get('/:id/progress', restrictTo('student'), async (req, res, next) => {
  try {
    const [[row]] = await db.query(
      'SELECT watched_seconds, completed FROM video_progress WHERE student_id = ? AND video_id = ?',
      [req.user.id, req.params.id]
    );
    return sendSuccess(res, 200, 'Progress loaded.', row || { watched_seconds: 0, completed: false });
  } catch (e) { next(e); }
});

/* ══════════════════════════════════════
   NOTES
══════════════════════════════════════ */

/* ── Get notes for a video ── */
router.get('/:id/notes', restrictTo('student'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, timestamp_seconds, note_text, created_at FROM video_notes WHERE student_id = ? AND video_id = ? ORDER BY timestamp_seconds ASC',
      [req.user.id, req.params.id]
    );
    return sendSuccess(res, 200, 'Notes loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Add a note ── */
router.post('/:id/notes', restrictTo('student'), async (req, res, next) => {
  try {
    const { timestamp_seconds, note_text } = req.body;
    if (!note_text) return sendError(res, 400, 'note_text is required.', 'MISSING_FIELDS');

    const [result] = await db.query(
      'INSERT INTO video_notes (student_id, video_id, timestamp_seconds, note_text) VALUES (?, ?, ?, ?)',
      [req.user.id, req.params.id, timestamp_seconds || 0, note_text]
    );
    return sendSuccess(res, 201, 'Note saved.', { id: result.insertId });
  } catch (e) { next(e); }
});

/* ── Delete a note ── */
router.delete('/:videoId/notes/:noteId', restrictTo('student'), async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM video_notes WHERE id = ? AND student_id = ?',
      [req.params.noteId, req.user.id]
    );
    return sendSuccess(res, 200, 'Note deleted.');
  } catch (e) { next(e); }
});

/* ══════════════════════════════════════
   BOOKMARKS
══════════════════════════════════════ */

/* ── Get bookmarks for a video ── */
router.get('/:id/bookmarks', restrictTo('student'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, timestamp_seconds, label, created_at FROM video_bookmarks WHERE student_id = ? AND video_id = ? ORDER BY timestamp_seconds ASC',
      [req.user.id, req.params.id]
    );
    return sendSuccess(res, 200, 'Bookmarks loaded.', rows);
  } catch (e) { next(e); }
});

/* ── Add a bookmark ── */
router.post('/:id/bookmarks', restrictTo('student'), async (req, res, next) => {
  try {
    const { timestamp_seconds, label } = req.body;
    const [result] = await db.query(
      'INSERT INTO video_bookmarks (student_id, video_id, timestamp_seconds, label) VALUES (?, ?, ?, ?)',
      [req.user.id, req.params.id, timestamp_seconds || 0, label || null]
    );
    return sendSuccess(res, 201, 'Bookmark saved.', { id: result.insertId });
  } catch (e) { next(e); }
});

/* ── Delete a bookmark ── */
router.delete('/:videoId/bookmarks/:bookmarkId', restrictTo('student'), async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM video_bookmarks WHERE id = ? AND student_id = ?',
      [req.params.bookmarkId, req.user.id]
    );
    return sendSuccess(res, 200, 'Bookmark deleted.');
  } catch (e) { next(e); }
});

module.exports = router;