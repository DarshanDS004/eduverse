/**
 * EduVerse — Chat Socket Handler
 * socket/chat.socket.js
 */

'use strict';

const db = require('../config/db');

module.exports = function chatHandler(io, socket, onlineUsers) {
  const userId = socket.user.id;

  /* ══════════════════════════════════════
     JOIN A CHAT ROOM
  ══════════════════════════════════════ */
  socket.on('chat:join', async ({ room_id }) => {
    try {
      // Verify user belongs to this room
      const [[room]] = await db.query(
        'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
        [room_id, userId, userId]
      );
      if (!room) return;

      socket.join(`room:${room_id}`);

      // Mark messages as read
      await db.query(
        'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?',
        [room_id, userId]
      );
    } catch (err) {
      console.error('[Socket] chat:join error:', err.message);
    }
  });

  /* ══════════════════════════════════════
     SEND MESSAGE
  ══════════════════════════════════════ */
  socket.on('chat:send', async ({ room_id, content }) => {
    try {
      if (!content?.trim()) return;

      // Verify room membership
      const [[room]] = await db.query(
        'SELECT id, user_one_id, user_two_id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
        [room_id, userId, userId]
      );
      if (!room) return;

      // Save message to DB
      const [result] = await db.query(
        'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
        [room_id, userId, content.trim()]
      );

      await db.query(
        'UPDATE message_rooms SET updated_at = NOW() WHERE id = ?',
        [room_id]
      );

      // Get sender info
      const [[sender]] = await db.query(
        'SELECT full_name, photo_url FROM user_profiles WHERE user_id = ?',
        [userId]
      );

      const message = {
        id:           result.insertId,
        room_id,
        sender_id:    userId,
        sender_name:  sender?.full_name,
        sender_avatar:sender?.photo_url,
        content:      content.trim(),
        is_read:      false,
        created_at:   new Date().toISOString(),
      };

      // Broadcast to room
      io.to(`room:${room_id}`).emit('chat:receive', message);

      // Send notification to receiver if offline
      const receiverId = room.user_one_id === userId ? room.user_two_id : room.user_one_id;
      const isOnline   = onlineUsers.has(receiverId);

      if (!isOnline) {
        // Save in-app notification
        await db.query(
          "INSERT INTO notifications (user_id, title, body, type) VALUES (?, ?, ?, 'message')",
          [receiverId, `New message from ${sender?.full_name}`, content.trim().slice(0, 100)]
        );
      }

      // Push notification count update to receiver
      const [[countRow]] = await db.query(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
        [receiverId]
      );
      io.to(`user:${receiverId}`).emit('notification:count', { unread: countRow.count });

    } catch (err) {
      console.error('[Socket] chat:send error:', err.message);
    }
  });

  /* ══════════════════════════════════════
     TYPING INDICATOR
  ══════════════════════════════════════ */
  socket.on('chat:typing', ({ room_id }) => {
    socket.to(`room:${room_id}`).emit('chat:typing', { from: userId, room_id });
  });

  socket.on('chat:stop-typing', ({ room_id }) => {
    socket.to(`room:${room_id}`).emit('chat:stop-typing', { from: userId, room_id });
  });

  /* ══════════════════════════════════════
     MARK MESSAGES READ
  ══════════════════════════════════════ */
  socket.on('chat:read', async ({ room_id }) => {
    try {
      await db.query(
        'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?',
        [room_id, userId]
      );
      socket.to(`room:${room_id}`).emit('chat:read', { room_id, read_by: userId });
    } catch (err) {
      console.error('[Socket] chat:read error:', err.message);
    }
  });
};