/**
 * EduVerse — Messages Controller
 * modules/messages/messages.controller.js
 */

'use strict';

const service                    = require('./messages.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

async function getRooms(req, res, next) {
  try {
    const data = await service.getRooms(req.user.id);
    return sendSuccess(res, 200, 'Rooms loaded.', data);
  } catch (err) { next(err); }
}

async function createRoom(req, res, next) {
  try {
    const { other_user_id } = req.body;
    if (!other_user_id) return sendError(res, 400, 'other_user_id is required.', 'MISSING_FIELDS');
    const data = await service.getOrCreateRoom(req.user.id, other_user_id);
    return sendSuccess(res, 200, 'Room ready.', data);
  } catch (err) { next(err); }
}

async function getMessages(req, res, next) {
  try {
    const data = await service.getMessages(req.params.id, req.user.id, req.query.limit);
    return sendSuccess(res, 200, 'Messages loaded.', data);
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  try {
    const { content } = req.body;
    if (!content) return sendError(res, 400, 'Content is required.', 'MISSING_FIELDS');
    const data = await service.sendMessage(req.params.id, req.user.id, content);
    return sendSuccess(res, 201, 'Message sent.', data);
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    const data = await service.markRoomRead(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (err) { next(err); }
}

module.exports = { getRooms, createRoom, getMessages, sendMessage, markRead };