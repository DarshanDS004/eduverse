/**
 * EduVerse — Super Admin Controller
 * modules/superadmin/superadmin.controller.js
 */

'use strict';

const svc = require('./superadmin.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

const ok  = (res, msg, data) => sendSuccess(res, 200, msg, data);
const created = (res, msg, data) => sendSuccess(res, 201, msg, data);

/* ── Dashboard ── */
exports.getDashboard = async (req, res, next) => {
  try { return ok(res, 'Dashboard loaded.', await svc.getDashboard()); }
  catch (e) { next(e); }
};

/* ══════════════ USERS ══════════════ */
exports.getUsers = async (req, res, next) => {
  try { return ok(res, 'Users loaded.', await svc.getUsers(req.query)); }
  catch (e) { next(e); }
};
exports.getUser = async (req, res, next) => {
  try { return ok(res, 'User loaded.', await svc.getUser(req.params.id)); }
  catch (e) { next(e); }
};
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return sendError(res, 400, 'Status is required.', 'MISSING_FIELDS');
    return ok(res, 'User status updated.', await svc.updateUserStatus(req.params.id, status, req.user.id, req.ip));
  } catch (e) { next(e); }
};
exports.verifyUser = async (req, res, next) => {
  try { return ok(res, 'User verified.', await svc.verifyUser(req.params.id)); }
  catch (e) { next(e); }
};
exports.resetUserPassword = async (req, res, next) => {
  try { return ok(res, 'Password reset link sent.', await svc.resetUserPassword(req.params.id)); }
  catch (e) { next(e); }
};
exports.deleteUser = async (req, res, next) => {
  try { return ok(res, 'User deleted.', await svc.deleteUser(req.params.id, req.user.id, req.ip)); }
  catch (e) { next(e); }
};

/* ══════════════ INSTITUTES ══════════════ */
exports.getInstitutes = async (req, res, next) => {
  try { return ok(res, 'Institutes loaded.', await svc.getInstitutes(req.query)); }
  catch (e) { next(e); }
};
exports.getInstitute = async (req, res, next) => {
  try { return ok(res, 'Institute loaded.', await svc.getInstitute(req.params.id)); }
  catch (e) { next(e); }
};
exports.approveInstitute = async (req, res, next) => {
  try { return ok(res, 'Institute approved.', await svc.approveInstitute(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.rejectInstitute = async (req, res, next) => {
  try {
    const { reason } = req.body;
    return ok(res, 'Institute rejected.', await svc.rejectInstitute(req.params.id, reason, req.user.id));
  } catch (e) { next(e); }
};
exports.suspendInstitute = async (req, res, next) => {
  try { return ok(res, 'Institute suspended.', await svc.updateInstituteStatus(req.params.id, 'suspended')); }
  catch (e) { next(e); }
};
exports.reactivateInstitute = async (req, res, next) => {
  try { return ok(res, 'Institute reactivated.', await svc.updateInstituteStatus(req.params.id, 'active')); }
  catch (e) { next(e); }
};
exports.updateSubscription = async (req, res, next) => {
  try {
    const { plan, end_date } = req.body;
    return ok(res, 'Subscription updated.', await svc.updateSubscription(req.params.id, plan, end_date));
  } catch (e) { next(e); }
};
exports.sendRenewalReminder = async (req, res, next) => {
  try { return ok(res, 'Renewal reminder sent.', await svc.sendRenewalReminder(req.params.id)); }
  catch (e) { next(e); }
};

/* ══════════════ INSTRUCTORS ══════════════ */
exports.getInstructors = async (req, res, next) => {
  try { return ok(res, 'Instructors loaded.', await svc.getInstructors(req.query)); }
  catch (e) { next(e); }
};
exports.getInstructor = async (req, res, next) => {
  try { return ok(res, 'Instructor loaded.', await svc.getInstructor(req.params.id)); }
  catch (e) { next(e); }
};
exports.approveInstructor = async (req, res, next) => {
  try { return ok(res, 'Instructor approved.', await svc.approveInstructor(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.suspendInstructor = async (req, res, next) => {
  try { return ok(res, 'Instructor suspended.', await svc.suspendInstructor(req.params.id)); }
  catch (e) { next(e); }
};
exports.markPayoutDone = async (req, res, next) => {
  try {
    const { amount } = req.body;
    return ok(res, 'Payout marked.', await svc.markPayoutDone(req.params.id, amount));
  } catch (e) { next(e); }
};

/* ══════════════ CONTENT MODERATION ══════════════ */
exports.getPendingCourses = async (req, res, next) => {
  try { return ok(res, 'Pending courses loaded.', await svc.getPendingCourses()); }
  catch (e) { next(e); }
};
exports.getAllCourses = async (req, res, next) => {
  try { return ok(res, 'Courses loaded.', await svc.getAllCourses(req.query)); }
  catch (e) { next(e); }
};
exports.approveCourse = async (req, res, next) => {
  try { return ok(res, 'Course approved.', await svc.approveCourse(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.rejectCourse = async (req, res, next) => {
  try {
    const { reason } = req.body;
    return ok(res, 'Course rejected.', await svc.rejectCourse(req.params.id, reason, req.user.id));
  } catch (e) { next(e); }
};
exports.featureCourse = async (req, res, next) => {
  try {
    const { featured } = req.body;
    return ok(res, 'Course feature status updated.', await svc.featureCourse(req.params.id, featured));
  } catch (e) { next(e); }
};
exports.removeCourse = async (req, res, next) => {
  try {
    const { reason } = req.body;
    return ok(res, 'Course removed.', await svc.removeCourse(req.params.id, reason, req.user.id, req.ip));
  } catch (e) { next(e); }
};

/* ══════════════ REVENUE ══════════════ */
exports.getRevenue = async (req, res, next) => {
  try { return ok(res, 'Revenue loaded.', await svc.getRevenue(req.query)); }
  catch (e) { next(e); }
};
exports.getPayments = async (req, res, next) => {
  try { return ok(res, 'Payments loaded.', await svc.getPayments(req.query)); }
  catch (e) { next(e); }
};
exports.getRefunds = async (req, res, next) => {
  try { return ok(res, 'Refunds loaded.', await svc.getRefunds(req.query)); }
  catch (e) { next(e); }
};
exports.approveRefund = async (req, res, next) => {
  try { return ok(res, 'Refund approved.', await svc.resolveRefund(req.params.id, 'approved', req.user.id)); }
  catch (e) { next(e); }
};
exports.rejectRefund = async (req, res, next) => {
  try {
    const { note } = req.body;
    return ok(res, 'Refund rejected.', await svc.resolveRefund(req.params.id, 'rejected', req.user.id, note));
  } catch (e) { next(e); }
};

/* ══════════════ ANALYTICS ══════════════ */
exports.getAnalytics = async (req, res, next) => {
  try { return ok(res, 'Analytics loaded.', await svc.getAnalytics(req.query)); }
  catch (e) { next(e); }
};

/* ══════════════ SETTINGS ══════════════ */
exports.getSettings = async (req, res, next) => {
  try { return ok(res, 'Settings loaded.', await svc.getSettings()); }
  catch (e) { next(e); }
};
exports.updateSettings = async (req, res, next) => {
  try { return ok(res, 'Settings updated.', await svc.updateSettings(req.body, req.user.id)); }
  catch (e) { next(e); }
};
exports.getFeatureFlags = async (req, res, next) => {
  try { return ok(res, 'Feature flags loaded.', await svc.getFeatureFlags()); }
  catch (e) { next(e); }
};
exports.updateFeatureFlag = async (req, res, next) => {
  try {
    const { feature_name, is_enabled } = req.body;
    if (!feature_name) return sendError(res, 400, 'feature_name is required.', 'MISSING_FIELDS');
    return ok(res, 'Feature flag updated.', await svc.updateFeatureFlag(feature_name, is_enabled, req.user.id));
  } catch (e) { next(e); }
};

/* ══════════════ ANNOUNCEMENTS ══════════════ */
exports.getAnnouncements = async (req, res, next) => {
  try { return ok(res, 'Announcements loaded.', await svc.getAnnouncements()); }
  catch (e) { next(e); }
};
exports.createAnnouncement = async (req, res, next) => {
  try { return created(res, 'Announcement sent.', await svc.createAnnouncement(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.deleteAnnouncement = async (req, res, next) => {
  try { return ok(res, 'Announcement deleted.', await svc.deleteAnnouncement(req.params.id)); }
  catch (e) { next(e); }
};

/* ══════════════ SUPPORT ══════════════ */
exports.getTickets = async (req, res, next) => {
  try { return ok(res, 'Tickets loaded.', await svc.getTickets(req.query)); }
  catch (e) { next(e); }
};
exports.getTicket = async (req, res, next) => {
  try { return ok(res, 'Ticket loaded.', await svc.getTicket(req.params.id)); }
  catch (e) { next(e); }
};
exports.replyTicket = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return sendError(res, 400, 'Message is required.', 'MISSING_FIELDS');
    return ok(res, 'Reply sent.', await svc.replyTicket(req.params.id, req.user.id, message));
  } catch (e) { next(e); }
};
exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    return ok(res, 'Ticket updated.', await svc.updateTicketStatus(req.params.id, status));
  } catch (e) { next(e); }
};
exports.assignTicket = async (req, res, next) => {
  try {
    const { assigned_to } = req.body;
    return ok(res, 'Ticket assigned.', await svc.assignTicket(req.params.id, assigned_to));
  } catch (e) { next(e); }
};

/* ══════════════ AUDIT LOGS ══════════════ */
exports.getAuditLogs = async (req, res, next) => {
  try { return ok(res, 'Audit logs loaded.', await svc.getAuditLogs(req.query)); }
  catch (e) { next(e); }
};