/**
 * EduVerse — Parent Controller
 * modules/parent/parent.controller.js
 */

'use strict';

const svc = require('./parent.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

const ok = (res, msg, data) => sendSuccess(res, 200, msg, data);
const created = (res, msg, data) => sendSuccess(res, 201, msg, data);

/* ── Dashboard ── */
exports.getDashboard = async (req, res, next) => {
  try { return ok(res, 'Dashboard loaded.', await svc.getDashboard(req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ CHILDREN ══════════════ */
exports.getChildren = async (req, res, next) => {
  try { return ok(res, 'Children loaded.', await svc.getChildren(req.user.id)); }
  catch (e) { next(e); }
};
exports.linkChild = async (req, res, next) => {
  try {
    const { student_id, otp, relation } = req.body;
    if (!student_id) return sendError(res, 400, 'student_id is required.', 'MISSING_FIELDS');
    return ok(res, 'Child linked.', await svc.linkChild(req.user.id, student_id, relation));
  } catch (e) { next(e); }
};
exports.unlinkChild = async (req, res, next) => {
  try { return ok(res, 'Child unlinked.', await svc.unlinkChild(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};

/* ══════════════ MONITORING ══════════════ */
exports.getChildOverview = async (req, res, next) => {
  try { return ok(res, 'Overview loaded.', await svc.getChildOverview(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getChildCourses = async (req, res, next) => {
  try { return ok(res, 'Courses loaded.', await svc.getChildCourses(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getChildPerformance = async (req, res, next) => {
  try { return ok(res, 'Performance loaded.', await svc.getChildPerformance(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getChildAttendance = async (req, res, next) => {
  try { return ok(res, 'Attendance loaded.', await svc.getChildAttendance(req.user.id, req.params.studentId, req.query)); }
  catch (e) { next(e); }
};
exports.getChildAssignments = async (req, res, next) => {
  try { return ok(res, 'Assignments loaded.', await svc.getChildAssignments(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getChildQuizzes = async (req, res, next) => {
  try { return ok(res, 'Quiz results loaded.', await svc.getChildQuizzes(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getChildCertificates = async (req, res, next) => {
  try { return ok(res, 'Certificates loaded.', await svc.getChildCertificates(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getChildActivity = async (req, res, next) => {
  try { return ok(res, 'Activity loaded.', await svc.getChildActivity(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};

/* ══════════════ FEES ══════════════ */
exports.getChildFees = async (req, res, next) => {
  try { return ok(res, 'Fees loaded.', await svc.getChildFees(req.user.id, req.params.studentId)); }
  catch (e) { next(e); }
};
exports.getPaymentHistory = async (req, res, next) => {
  try { return ok(res, 'Payment history loaded.', await svc.getPaymentHistory(req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ MESSAGES ══════════════ */
exports.getMessageRooms = async (req, res, next) => {
  try { return ok(res, 'Rooms loaded.', await svc.getMessageRooms(req.user.id)); }
  catch (e) { next(e); }
};
exports.createRoom = async (req, res, next) => {
  try {
    const { other_user_id } = req.body;
    if (!other_user_id) return sendError(res, 400, 'other_user_id is required.', 'MISSING_FIELDS');
    return ok(res, 'Room ready.', await svc.getOrCreateRoom(req.user.id, other_user_id));
  } catch (e) { next(e); }
};
exports.getMessages = async (req, res, next) => {
  try { return ok(res, 'Messages loaded.', await svc.getMessages(req.params.roomId, req.user.id, req.query.limit)); }
  catch (e) { next(e); }
};
exports.sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return sendError(res, 400, 'Content is required.', 'MISSING_FIELDS');
    return created(res, 'Message sent.', await svc.sendMessage(req.params.roomId, req.user.id, content));
  } catch (e) { next(e); }
};
exports.markRead = async (req, res, next) => {
  try { return ok(res, 'Marked as read.', await svc.markRoomRead(req.params.roomId, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ ANNOUNCEMENTS ══════════════ */
exports.getAnnouncements = async (req, res, next) => {
  try { return ok(res, 'Announcements loaded.', await svc.getAnnouncements(req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ MEETINGS ══════════════ */
exports.getMeetings = async (req, res, next) => {
  try { return ok(res, 'Meetings loaded.', await svc.getMeetings(req.user.id)); }
  catch (e) { next(e); }
};
exports.requestMeeting = async (req, res, next) => {
  try { return created(res, 'Meeting requested.', await svc.requestMeeting(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.cancelMeeting = async (req, res, next) => {
  try { return ok(res, 'Meeting cancelled.', await svc.cancelMeeting(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ NOTIFICATIONS ══════════════ */
exports.getNotifications = async (req, res, next) => {
  try { return ok(res, 'Notifications loaded.', await svc.getNotifications(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.markAllRead = async (req, res, next) => {
  try { return ok(res, 'All marked as read.', await svc.markAllRead(req.user.id)); }
  catch (e) { next(e); }
};
exports.markOneRead = async (req, res, next) => {
  try { return ok(res, 'Marked as read.', await svc.markOneRead(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ PROFILE ══════════════ */
exports.getProfile = async (req, res, next) => {
  try { return ok(res, 'Profile loaded.', await svc.getProfile(req.user.id)); }
  catch (e) { next(e); }
};
exports.updateProfile = async (req, res, next) => {
  try { return ok(res, 'Profile updated.', await svc.updateProfile(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updatePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return sendError(res, 400, 'Both passwords are required.', 'MISSING_FIELDS');
    return ok(res, 'Password updated.', await svc.updatePassword(req.user.id, current_password, new_password));
  } catch (e) { next(e); }
};
exports.updateNotifPrefs = async (req, res, next) => {
  try { return ok(res, 'Preferences updated.', await svc.updateNotifPrefs(req.user.id, req.body)); }
  catch (e) { next(e); }
};