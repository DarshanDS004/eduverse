/**
 * EduVerse — Super Admin Routes
 * modules/superadmin/superadmin.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('./superadmin.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

router.use(protect);
router.use(restrictTo('superadmin'));

/* ═══════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════ */
router.get('/dashboard', ctrl.getDashboard);

/* ═══════════════════════════════════════
   USER MANAGEMENT
═══════════════════════════════════════ */
router.get('/users',                    ctrl.getUsers);
router.get('/users/:id',                ctrl.getUser);
router.patch('/users/:id/status',       ctrl.updateUserStatus);
router.patch('/users/:id/verify',       ctrl.verifyUser);
router.post('/users/:id/reset-password',ctrl.resetUserPassword);
router.delete('/users/:id',             ctrl.deleteUser);

/* ═══════════════════════════════════════
   INSTITUTE MANAGEMENT
═══════════════════════════════════════ */
router.get('/institutes',                       ctrl.getInstitutes);
router.get('/institutes/:id',                   ctrl.getInstitute);
router.patch('/institutes/:id/approve',         ctrl.approveInstitute);
router.patch('/institutes/:id/reject',          ctrl.rejectInstitute);
router.patch('/institutes/:id/suspend',         ctrl.suspendInstitute);
router.patch('/institutes/:id/reactivate',      ctrl.reactivateInstitute);
router.patch('/institutes/:id/subscription',    ctrl.updateSubscription);
router.post('/institutes/:id/renewal-reminder', ctrl.sendRenewalReminder);

/* ═══════════════════════════════════════
   INSTRUCTOR MANAGEMENT
═══════════════════════════════════════ */
router.get('/instructors',              ctrl.getInstructors);
router.get('/instructors/:id',          ctrl.getInstructor);
router.patch('/instructors/:id/approve',ctrl.approveInstructor);
router.patch('/instructors/:id/suspend',ctrl.suspendInstructor);
router.patch('/instructors/:id/payout', ctrl.markPayoutDone);

/* ═══════════════════════════════════════
   CONTENT MODERATION
═══════════════════════════════════════ */
router.get('/courses/pending',          ctrl.getPendingCourses);
router.get('/courses',                  ctrl.getAllCourses);
router.patch('/courses/:id/approve',    ctrl.approveCourse);
router.patch('/courses/:id/reject',     ctrl.rejectCourse);
router.patch('/courses/:id/feature',    ctrl.featureCourse);
router.delete('/courses/:id',           ctrl.removeCourse);

/* ═══════════════════════════════════════
   REVENUE & PAYMENTS
═══════════════════════════════════════ */
router.get('/revenue',                      ctrl.getRevenue);
router.get('/payments',                     ctrl.getPayments);
router.get('/refunds',                      ctrl.getRefunds);
router.patch('/refunds/:id/approve',        ctrl.approveRefund);
router.patch('/refunds/:id/reject',         ctrl.rejectRefund);

/* ═══════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════ */
router.get('/analytics', ctrl.getAnalytics);

/* ═══════════════════════════════════════
   PLATFORM SETTINGS
═══════════════════════════════════════ */
router.get('/settings',         ctrl.getSettings);
router.patch('/settings',       ctrl.updateSettings);
router.get('/feature-flags',    ctrl.getFeatureFlags);
router.patch('/feature-flags',  ctrl.updateFeatureFlag);

/* ═══════════════════════════════════════
   ANNOUNCEMENTS
═══════════════════════════════════════ */
router.get('/announcements',    ctrl.getAnnouncements);
router.post('/announcements',   ctrl.createAnnouncement);
router.delete('/announcements/:id', ctrl.deleteAnnouncement);

/* ═══════════════════════════════════════
   SUPPORT TICKETS
═══════════════════════════════════════ */
router.get('/tickets',              ctrl.getTickets);
router.get('/tickets/:id',          ctrl.getTicket);
router.post('/tickets/:id/reply',   ctrl.replyTicket);
router.patch('/tickets/:id/status', ctrl.updateTicketStatus);
router.patch('/tickets/:id/assign', ctrl.assignTicket);

/* ═══════════════════════════════════════
   AUDIT LOGS
═══════════════════════════════════════ */
router.get('/audit-logs', ctrl.getAuditLogs);

module.exports = router;