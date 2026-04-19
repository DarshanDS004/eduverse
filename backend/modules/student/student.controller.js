/**
 * EduVerse — Student Controller (Extended)
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

async function getCourses(req, res, next) {
  try {
    const data = await service.getCourses(req.user.id);
    return sendSuccess(res, 200, 'Courses loaded.', data);
  } catch (err) { next(err); }
}

async function getAssignments(req, res, next) {
  try {
    const data = await service.getAssignments(req.user.id);
    return sendSuccess(res, 200, 'Assignments loaded.', data);
  } catch (err) { next(err); }
}

async function submitAssignment(req, res, next) {
  try {
    const { text } = req.body;
    const fileUrl  = req.file ? '/uploads/assignments/' + req.file.filename : null;
    const fileName = req.file ? req.file.originalname : null;
    const data     = await service.submitAssignment(
      req.user.id, req.params.id, text, fileUrl, fileName
    );
    return sendSuccess(res, 200, data.message, data);
  } catch (err) { next(err); }
}

async function getPerformance(req, res, next) {
  try {
    const data = await service.getPerformance(req.user.id, req.query.days);
    return sendSuccess(res, 200, 'Performance loaded.', data);
  } catch (err) { next(err); }
}

async function getProfile(req, res, next) {
  try {
    const data = await service.getProfile(req.user.id);
    return sendSuccess(res, 200, 'Profile loaded.', data);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const data = await service.updateProfile(req.user.id, req.body);
    return sendSuccess(res, 200, data.message, data);
  } catch (err) { next(err); }
}

async function updatePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return sendError(res, 400, 'Current and new password are required.', 'MISSING_FIELDS');
    }
    const data = await service.updatePassword(req.user.id, current_password, new_password);
    return sendSuccess(res, 200, data.message);
  } catch (err) { next(err); }
}

async function updateAvatar(req, res, next) {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    const photoUrl = '/uploads/avatars/' + req.file.filename;
    const data     = await service.updateAvatar(req.user.id, photoUrl);
    return sendSuccess(res, 200, data.message, data);
  } catch (err) { next(err); }
}

async function getCalendar(req, res, next) {
  try {
    const { year, month } = req.query;
    const data = await service.getCalendar(req.user.id, year, month);
    return sendSuccess(res, 200, 'Calendar loaded.', data);
  } catch (err) { next(err); }
}

async function updateLessonProgress(req, res, next) {
  try {
    const { progress, watched_seconds } = req.body;
    const seconds = watched_seconds || (progress ? progress * 60 : 0);
    const data    = await service.updateLessonProgress(req.user.id, req.params.id, seconds);
    return sendSuccess(res, 200, data.message, data);
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

async function getCourseProgress(req, res, next) {
  try {
    const data = await service.getCourseProgress(req.user.id, req.params.id);
    return sendSuccess(res, 200, 'Progress loaded.', data);
  } catch (err) { next(err); }
}

module.exports = {
  getDashboard,
  getCourses,
  getCourseProgress,
  getAssignments,
  submitAssignment,
  getPerformance,
  getProfile,
  updateProfile,
  updatePassword,
  updateAvatar,
  getCalendar,
  updateLessonProgress,
  getActivity,
  getNotifications,
  markNotifRead,
  markAllRead,
};