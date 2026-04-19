/**
 * EduVerse — Parent Routes
 * modules/parent/parent.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('./parent.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

router.use(protect);
router.use(restrictTo('parent'));

/* ═══════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════ */
router.get('/dashboard', ctrl.getDashboard);

/* ═══════════════════════════════════════
   CHILDREN MANAGEMENT
═══════════════════════════════════════ */
router.get('/children',                   ctrl.getChildren);
router.post('/children/link',             ctrl.linkChild);
router.delete('/children/:studentId',     ctrl.unlinkChild);

/* ═══════════════════════════════════════
   ACADEMIC MONITORING (per child)
═══════════════════════════════════════ */
router.get('/children/:studentId/overview',    ctrl.getChildOverview);
router.get('/children/:studentId/courses',     ctrl.getChildCourses);
router.get('/children/:studentId/performance', ctrl.getChildPerformance);
router.get('/children/:studentId/attendance',  ctrl.getChildAttendance);
router.get('/children/:studentId/assignments', ctrl.getChildAssignments);
router.get('/children/:studentId/quizzes',     ctrl.getChildQuizzes);
router.get('/children/:studentId/certificates',ctrl.getChildCertificates);
router.get('/children/:studentId/activity',    ctrl.getChildActivity);

/* ═══════════════════════════════════════
   FEES & PAYMENTS
═══════════════════════════════════════ */
router.get('/children/:studentId/fees',        ctrl.getChildFees);
router.get('/payments/history',                ctrl.getPaymentHistory);

/* ═══════════════════════════════════════
   COMMUNICATION
═══════════════════════════════════════ */
router.get('/messages/rooms',                  ctrl.getMessageRooms);
router.post('/messages/rooms',                 ctrl.createRoom);
router.get('/messages/:roomId',                ctrl.getMessages);
router.post('/messages/:roomId',               ctrl.sendMessage);
router.patch('/messages/:roomId/read',         ctrl.markRead);

/* ═══════════════════════════════════════
   ANNOUNCEMENTS
═══════════════════════════════════════ */
router.get('/announcements', ctrl.getAnnouncements);

/* ═══════════════════════════════════════
   PARENT-TEACHER MEETINGS
═══════════════════════════════════════ */
router.get('/meetings',            ctrl.getMeetings);
router.post('/meetings',           ctrl.requestMeeting);
router.patch('/meetings/:id/cancel', ctrl.cancelMeeting);

/* ═══════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════ */
router.get('/notifications',                 ctrl.getNotifications);
router.patch('/notifications/mark-all-read', ctrl.markAllRead);
router.patch('/notifications/:id/read',      ctrl.markOneRead);

/* ═══════════════════════════════════════
   PROFILE
═══════════════════════════════════════ */
router.get('/profile',              ctrl.getProfile);
router.patch('/profile',            ctrl.updateProfile);
router.patch('/profile/password',   ctrl.updatePassword);
router.patch('/profile/notif-prefs',ctrl.updateNotifPrefs);

module.exports = router;