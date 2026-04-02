/**
 * EduVerse — Student Routes
 * modules/student/student.routes.js
 */

'use strict';

const express     = require('express');
const router      = express.Router();
const controller  = require('./student.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

// All student routes require authentication
router.use(protect);
router.use(restrictTo('student'));

router.get('/dashboard',    controller.getDashboard);
router.get('/activity',     controller.getActivity);
router.get('/notifications',controller.getNotifications);
router.patch('/notifications/:id/read', controller.markNotifRead);
router.patch('/notifications/mark-all-read', controller.markAllRead);

module.exports = router;