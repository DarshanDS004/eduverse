/**
 * EduVerse — Notification Socket Handler
 * socket/notification.socket.js
 */

'use strict';

const db = require('../config/db');

module.exports = function notifHandler(io, socket) {
  const userId = socket.user.id;

  /* Get unread count */
  socket.on('notification:get-count', async () => {
    try {
      const [[row]] = await db.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      socket.emit('notification:count', { unread: row.count });
    } catch (err) {
      console.error('[Socket] notification:get-count error:', err.message);
    }
  });

  /* Mark all read */
  socket.on('notification:mark-all-read', async () => {
    try {
      await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
      socket.emit('notification:count', { unread: 0 });
    } catch (err) {
      console.error('[Socket] notification:mark-all-read error:', err.message);
    }
  });

  /* Mark one read */
  socket.on('notification:mark-read', async ({ notification_id }) => {
    try {
      await db.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [notification_id, userId]
      );
      const [[row]] = await db.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      socket.emit('notification:count', { unread: row.count });
    } catch (err) {
      console.error('[Socket] notification:mark-read error:', err.message);
    }
  });
};


/**
 * EduVerse — Live Session Socket Handler
 * socket/live-session.socket.js
 */

module.exports = function liveSessionHandler(io, socket) {
  const userId = socket.user.id;
  const role   = socket.user.role;

  /* ── Join session room ── */
  socket.on('session:join', ({ session_id }) => {
    const room = `session:${session_id}`;
    socket.join(room);

    // Notify room that user joined
    socket.to(room).emit('session:participant-joined', {
      user_id: userId,
      role,
      time:    new Date().toISOString(),
    });

    console.log(`[Socket] User ${userId} joined session:${session_id}`);
  });

  /* ── Leave session room ── */
  socket.on('session:leave', ({ session_id }) => {
    const room = `session:${session_id}`;
    socket.leave(room);
    socket.to(room).emit('session:participant-left', {
      user_id: userId,
      time:    new Date().toISOString(),
    });
  });

  /* ── Send chat message in session ── */
  socket.on('session:send-message', ({ session_id, text }) => {
    if (!text?.trim()) return;
    io.to(`session:${session_id}`).emit('session:message', {
      from:    userId,
      role,
      text:    text.trim(),
      time:    new Date().toISOString(),
    });
  });

  /* ── Raise hand ── */
  socket.on('session:raise-hand', ({ session_id }) => {
    io.to(`session:${session_id}`).emit('session:hand-raised', {
      user_id: userId,
      time:    new Date().toISOString(),
    });
  });

  /* ── Lower hand ── */
  socket.on('session:lower-hand', ({ session_id }) => {
    io.to(`session:${session_id}`).emit('session:hand-lowered', {
      user_id: userId,
    });
  });

  /* ── Poll question (instructor only) ── */
  socket.on('session:send-poll', ({ session_id, question, options }) => {
    if (role !== 'instructor' && role !== 'institute') return;
    io.to(`session:${session_id}`).emit('session:poll', {
      question,
      options,
      time: new Date().toISOString(),
    });
  });

  /* ── Poll answer (student) ── */
  socket.on('session:poll-answer', ({ session_id, option_index }) => {
    io.to(`session:${session_id}`).emit('session:poll-result', {
      user_id:      userId,
      option_index,
    });
  });

  /* ── End session (instructor only) ── */
  socket.on('session:end', ({ session_id }) => {
    if (role !== 'instructor' && role !== 'institute') return;
    io.to(`session:${session_id}`).emit('session:ended', {
      ended_by: userId,
      time:     new Date().toISOString(),
    });
  });
};