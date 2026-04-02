/**
 * EduVerse — Student Controller
 * modules/student/student.controller.js
 */

'use strict';

const service                    = require('./student.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

async function getDashboard(req, res, next) {
  try {
    const data = await service.getDashboard(req.user.id);
    return sendSuccess(res, 200, 'Dashboard loaded.', data);
  } catch (err) { next(err); }
}

async function getActivity(req, res, next) {
  try {
    const data = await service.getActivity(req.user.id, req.query.limit);
    return sendSuccess(res, 200, 'Activity loaded.', data);
  } catch (err) { next(err); }
}

async function getNotifications(req, res, next) {
  try {
    const data = await service.getNotifications(req.user.id);
    return sendSuccess(res, 200, 'Notifications loaded.', data);
  } catch (err) { next(err); }
}

async function markNotifRead(req, res, next) {
  try {
    const data = await service.markNotifRead(req.user.id, req.params.id);
    return sendSuccess(res, 200, data.message);
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    const data = await service.markAllRead(req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (err) { next(err); }
}

module.exports = {
  getDashboard,
  getActivity,
  getNotifications,
  markNotifRead,
  markAllRead,
};