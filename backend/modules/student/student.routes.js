/**
 * EduVerse — Student Routes (Extended)
 * modules/student/student.routes.js
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const controller = require('./student.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

// All student routes require authentication + student role
router.use(protect);
router.use(restrictTo('student'));

/* ── Multer for assignment file uploads ── */
const assignDir = path.join(__dirname, '../../../uploads/assignments');
if (!fs.existsSync(assignDir)) fs.mkdirSync(assignDir, { recursive: true });

const avatarDir = path.join(__dirname, '../../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const assignUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, assignDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'assign-' + Date.now() + ext);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'avatar-' + req.user.id + '-' + Date.now() + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* ── Dashboard ── */
router.get('/dashboard', controller.getDashboard);

/* ── Courses ── */
router.get('/courses', controller.getCourses);

/* ── Assignments ── */
router.get('/assignments', controller.getAssignments);
router.post('/assignments/:id/submit',
  assignUpload.single('file'),
  controller.submitAssignment
);

/* ── Performance ── */
router.get('/performance', controller.getPerformance);

/* ── Profile ── */
router.get('/profile',          controller.getProfile);
router.patch('/profile',        controller.updateProfile);
router.patch('/profile/password', controller.updatePassword);
router.post('/profile/avatar',
  avatarUpload.single('avatar'),
  controller.updateAvatar
);

/* ── Calendar ── */
router.get('/calendar', controller.getCalendar);

/* ── Lesson progress ── */
router.post('/lessons/:id/progress', controller.updateLessonProgress);
router.get('/courses/:id/progress',  controller.getCourseProgress);

/* ── Activity ── */
router.get('/activity', controller.getActivity);

/* ── Notifications ── */
router.get('/notifications',                    controller.getNotifications);
router.patch('/notifications/mark-all-read',    controller.markAllRead);
router.patch('/notifications/:id/read',         controller.markNotifRead);

module.exports = router;