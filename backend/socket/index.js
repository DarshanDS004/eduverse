/**
 * EduVerse — Socket.io Server
 * socket/index.js
 *
 * Handles real-time:
 * - Chat messages
 * - Notifications
 * - Live session events
 * - Exam monitoring
 * - Video progress
 */

'use strict';

const jwt      = require('jsonwebtoken');
const db       = require('../config/db');

const chatHandler         = require('./chat.socket');
const notifHandler        = require('./notification.socket');
const liveSessionHandler  = require('./live-session.socket');
const examHandler         = require('./exam.socket');

/* ── Connected users map: userId → Set of socket IDs ── */
const onlineUsers = new Map();

function initSocket(io) {

  /* ══════════════════════════════════════
     AUTHENTICATION MIDDLEWARE
  ══════════════════════════════════════ */
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication required.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id, role: decoded.role, email: decoded.email };
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  /* ══════════════════════════════════════
     CONNECTION
  ══════════════════════════════════════ */
  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;

    console.log(`[Socket] Connected: user=${userId} role=${role} socket=${socket.id}`);

    /* ── Track online users ── */
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    /* ── Join personal room for targeted notifications ── */
    socket.join(`user:${userId}`);

    /* ── Join role room for broadcasts ── */
    socket.join(`role:${role}`);

    /* ── Update last_login_at ── */
    db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]).catch(() => {});

    /* ══ Register handlers ══ */
    chatHandler(io, socket, onlineUsers);
    notifHandler(io, socket);
    liveSessionHandler(io, socket);
    examHandler(io, socket);

    /* ══ Emit online status ══ */
    socket.broadcast.emit('user:online', { user_id: userId });

    /* ══ Send unread notification count on connect ══ */
    db.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    ).then(([[row]]) => {
      socket.emit('notification:count', { unread: row.count });
    }).catch(() => {});

    /* ══════════════════════════════════════
       DISCONNECT
    ══════════════════════════════════════ */
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: user=${userId} reason=${reason}`);

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit('user:offline', { user_id: userId });
        }
      }
    });

    /* ══════════════════════════════════════
       PING / KEEP-ALIVE
    ══════════════════════════════════════ */
    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
    });
  });

  /* ══════════════════════════════════════
     EXPOSE HELPER: send to specific user
  ══════════════════════════════════════ */
  io.sendToUser = function (userId, event, data) {
    io.to(`user:${userId}`).emit(event, data);
  };

  io.sendToRole = function (role, event, data) {
    io.to(`role:${role}`).emit(event, data);
  };

  io.isOnline = function (userId) {
    return onlineUsers.has(userId);
  };

  console.log('[Socket] Socket.io server initialized.');
  return io;
}

module.exports = { initSocket, onlineUsers };