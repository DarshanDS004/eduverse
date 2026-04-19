/**
 * EduVerse — Messages Service
 * modules/messages/messages.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');

/* ============================================================
   GET ROOMS for a user
============================================================ */

async function getRooms(userId) {
  const [rows] = await db.query(
    `SELECT
       mr.id,
       CASE WHEN mr.user_one_id = ? THEN mr.user_two_id ELSE mr.user_one_id END AS other_user_id,
       CASE WHEN mr.user_one_id = ? THEN up2.full_name ELSE up1.full_name END AS other_user_name,
       CASE WHEN mr.user_one_id = ? THEN up2.photo_url ELSE up1.photo_url END AS other_user_avatar,
       (SELECT content FROM messages WHERE room_id = mr.id ORDER BY created_at DESC LIMIT 1) AS last_message_content,
       (SELECT created_at FROM messages WHERE room_id = mr.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
       (SELECT COUNT(*) FROM messages WHERE room_id = mr.id AND sender_id != ? AND is_read = 0) AS unread_count
     FROM message_rooms mr
     JOIN user_profiles up1 ON up1.user_id = mr.user_one_id
     JOIN user_profiles up2 ON up2.user_id = mr.user_two_id
     WHERE mr.user_one_id = ? OR mr.user_two_id = ?
     ORDER BY COALESCE(last_message_at, mr.created_at) DESC`,
    [userId, userId, userId, userId, userId, userId]
  );

  return rows.map(r => ({
    id:               r.id,
    other_user_id:    r.other_user_id,
    other_user_name:  r.other_user_name,
    other_user_avatar:r.other_user_avatar,
    unread_count:     r.unread_count || 0,
    last_message:     r.last_message_content
      ? { content: r.last_message_content, created_at: r.last_message_at }
      : null,
  }));
}

/* ============================================================
   GET or CREATE ROOM between two users
============================================================ */

async function getOrCreateRoom(userId, otherUserId) {
  if (userId === otherUserId) {
    throw new AppError('Cannot message yourself.', 400, 'INVALID_REQUEST');
  }

  // Canonical order so uq_room constraint works
  const u1 = Math.min(userId, otherUserId);
  const u2 = Math.max(userId, otherUserId);

  const [[existing]] = await db.query(
    'SELECT id FROM message_rooms WHERE user_one_id = ? AND user_two_id = ?',
    [u1, u2]
  );

  if (existing) return { id: existing.id };

  const [result] = await db.query(
    'INSERT INTO message_rooms (user_one_id, user_two_id) VALUES (?, ?)',
    [u1, u2]
  );

  return { id: result.insertId };
}

/* ============================================================
   GET MESSAGES in a room
============================================================ */

async function getMessages(roomId, userId, limit) {
  // Verify user is in the room
  const [[room]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [roomId, userId, userId]
  );
  if (!room) throw new AppError('Room not found.', 404, 'NOT_FOUND');

  const [msgs] = await db.query(
    `SELECT
       m.id, m.content, m.is_read, m.created_at,
       m.sender_id,
       up.full_name AS sender_name,
       up.photo_url AS sender_avatar,
       (m.sender_id = ?) AS is_mine
     FROM messages m
     JOIN user_profiles up ON up.user_id = m.sender_id
     WHERE m.room_id = ?
     ORDER BY m.created_at ASC
     LIMIT ?`,
    [userId, roomId, parseInt(limit) || 50]
  );

  return { messages: msgs };
}

/* ============================================================
   SEND MESSAGE
============================================================ */

async function sendMessage(roomId, senderId, content) {
  if (!content || !content.trim()) {
    throw new AppError('Message content is required.', 400, 'EMPTY_MESSAGE');
  }

  // Verify sender is in the room
  const [[room]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [roomId, senderId, senderId]
  );
  if (!room) throw new AppError('Room not found.', 404, 'NOT_FOUND');

  const [result] = await db.query(
    'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
    [roomId, senderId, content.trim()]
  );

  // Touch updated_at on room
  await db.query(
    'UPDATE message_rooms SET updated_at = NOW() WHERE id = ?',
    [roomId]
  );

  const [[msg]] = await db.query(
    `SELECT m.id, m.content, m.is_read, m.created_at,
            m.sender_id, up.full_name AS sender_name, 1 AS is_mine
     FROM messages m
     JOIN user_profiles up ON up.user_id = m.sender_id
     WHERE m.id = ?`,
    [result.insertId]
  );

  return msg;
}

/* ============================================================
   MARK ROOM AS READ
============================================================ */

async function markRoomRead(roomId, userId) {
  await db.query(
    `UPDATE messages SET is_read = 1
     WHERE room_id = ? AND sender_id != ?`,
    [roomId, userId]
  );
  return { message: 'Messages marked as read.' };
}

module.exports = { getRooms, getOrCreateRoom, getMessages, sendMessage, markRoomRead };