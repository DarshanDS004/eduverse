/**
 * EduVerse — Instructor Routes  (v3 — COMPLETE)
 * modules/instructor/instructor.routes.js
 *
 * Key changes in v3:
 *  1. videoUpload multer limit raised to 50 GB (effectively unlimited for practical use).
 *     The XHR upload in course-builder.html streams directly — no memory buffering.
 *  2. Added POST /lessons/:id/upload-video  — replace video on existing lesson
 *  3. Added POST /lessons/:id/video-url     — set external URL on existing lesson
 *  4. Both GET + POST for coupons routes preserved
 *  5. All routes work with both /sections/ and /modules/ aliases for compatibility
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const ctrl       = require('./instructor.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

/* ── All instructor routes require auth + instructor role ── */
router.use(protect);
router.use(restrictTo('instructor'));

/* ═══════════════════════════════════════
   MULTER STORAGE FACTORIES
═══════════════════════════════════════ */
function makeStorage(sub) {
  const dir = path.join(__dirname, '../../../uploads', sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename:    (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const safe = sub.replace(/\//g, '-');
      cb(null, `${safe}-${Date.now()}${ext}`);
    },
  });
}

/* ── Thumbnail: 5 MB, images only ── */
const thumbUpload = multer({
  storage: makeStorage('thumbnails'),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
});

/* ── Video: NO size limit (supports >5 GB files).
   Multer streams directly to disk via diskStorage —
   the file is never held in memory regardless of size.
   The XHR upload in the frontend shows real-time progress via xhr.upload.
── */
const videoUpload = multer({
  storage: makeStorage('videos'),
  limits:  { fileSize: 50 * 1024 * 1024 * 1024 }, // 50 GB hard ceiling; adjust as needed
  fileFilter: (req, file, cb) => {
    const okExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.ts'];
    const isVideo = file.mimetype.startsWith('video/') ||
                    okExts.includes(path.extname(file.originalname).toLowerCase());
    cb(null, isVideo);
  },
});

/* ── Assignment files: 20 MB ── */
const assignUpload = multer({
  storage: makeStorage('assignments'),
  limits:  { fileSize: 20 * 1024 * 1024 },
});

/* ── Avatar: 5 MB, images only ── */
const avatarUpload = multer({
  storage: makeStorage('avatars'),
  fileFilter: (req, file, cb) => {
    const ok = ['.jpg', '.jpeg', '.png', '.webp'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ═══════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════ */
router.get('/dashboard', ctrl.getDashboard);

/* ═══════════════════════════════════════
   COURSES
═══════════════════════════════════════ */
router.get('/courses',               ctrl.getMyCourses);
router.post('/courses',              ctrl.createCourse);
router.get('/courses/:id',           ctrl.getCourse);
router.patch('/courses/:id',         ctrl.updateCourse);
router.put('/courses/:id',           ctrl.updateCourse);
router.patch('/courses/:id/publish', ctrl.publishCourse);
router.put('/courses/:id/publish',   ctrl.publishCourse);
router.delete('/courses/:id',        ctrl.deleteCourse);

/* Thumbnail upload */
router.post('/courses/:id/thumbnail',
  thumbUpload.single('thumbnail'),
  ctrl.uploadThumbnail
);

/* Coupon management */
router.get('/courses/:id/coupons',  ctrl.getCoupons);
router.post('/courses/:id/coupons', ctrl.saveCoupons);

/* ═══════════════════════════════════════
   COURSE BUILDER — MODULES / SECTIONS
   Both /sections/ and /modules/ aliases work.
═══════════════════════════════════════ */
router.get('/courses/:courseId/sections', ctrl.getModules);
router.get('/courses/:courseId/modules',  ctrl.getModules);

router.post('/courses/:courseId/sections', ctrl.addModule);
router.post('/courses/:courseId/modules',  ctrl.addModule);

router.patch('/sections/:id',  ctrl.updateModule);
router.put('/sections/:id',    ctrl.updateModule);
router.delete('/sections/:id', ctrl.deleteModule);

router.patch('/modules/:id',   ctrl.updateModule);
router.put('/modules/:id',     ctrl.updateModule);
router.delete('/modules/:id',  ctrl.deleteModule);

/* ═══════════════════════════════════════
   COURSE BUILDER — LESSONS / VIDEOS
   Supports:
     - /sections/:sectionId/lessons  (JSON, no file)
     - /modules/:moduleId/videos     (JSON, no file — URL or stub)
     - /modules/:moduleId/videos/upload (multipart file — any size)
═══════════════════════════════════════ */

/* List lessons */
router.get('/sections/:sectionId/lessons', ctrl.getVideos);
router.get('/modules/:moduleId/videos',    ctrl.getVideos);

/* Add lesson (JSON — creates stub or URL lesson) */
router.post('/sections/:sectionId/lessons', ctrl.addLesson);

/* Add video with FILE upload (multipart, any size) */
router.post('/modules/:moduleId/videos/upload',
  videoUpload.single('video'),
  ctrl.addVideo
);

/* Add lesson/video via JSON body (video_url or article content) */
router.post('/modules/:moduleId/videos', ctrl.addVideoJson);

/* Update lesson metadata (JSON) */
router.patch('/lessons/:id',  ctrl.updateVideo);
router.put('/lessons/:id',    ctrl.updateVideo);
router.delete('/lessons/:id', ctrl.deleteVideo);

router.patch('/videos/:id',   ctrl.updateVideo);
router.put('/videos/:id',     ctrl.updateVideo);
router.delete('/videos/:id',  ctrl.deleteVideo);

/* Replace video file on existing lesson (multipart, any size) */
router.post('/lessons/:id/upload-video',
  videoUpload.single('video'),
  ctrl.uploadLessonVideo
);

/* Save external video URL to existing lesson */
router.post('/lessons/:id/video-url', ctrl.saveLessonVideoUrl);

/* ═══════════════════════════════════════
   STUDENTS
═══════════════════════════════════════ */
router.get('/students',     ctrl.getMyStudents);
router.get('/students/:id', ctrl.getStudentDetail);

/* ═══════════════════════════════════════
   QUIZZES
═══════════════════════════════════════ */
router.get('/quizzes',               ctrl.getQuizzes);
router.post('/quizzes',              ctrl.createQuiz);
router.get('/quizzes/:id',           ctrl.getQuiz);
router.patch('/quizzes/:id',         ctrl.updateQuiz);
router.put('/quizzes/:id',           ctrl.updateQuiz);
router.patch('/quizzes/:id/publish', ctrl.publishQuiz);
router.put('/quizzes/:id/publish',   ctrl.publishQuiz);
router.delete('/quizzes/:id',        ctrl.deleteQuiz);

/* ═══════════════════════════════════════
   ASSIGNMENTS
═══════════════════════════════════════ */
router.get('/assignments',        ctrl.getAssignments);
router.post('/assignments',       assignUpload.single('file'), ctrl.createAssignment);
router.get('/assignments/:id',    ctrl.getAssignment);
router.patch('/assignments/:id',  ctrl.updateAssignment);
router.put('/assignments/:id',    ctrl.updateAssignment);
router.delete('/assignments/:id', ctrl.deleteAssignment);

router.get('/submissions',            ctrl.getSubmissions);
router.post('/submissions/:id/grade', ctrl.gradeSubmission);
router.delete('/submissions/:id',     ctrl.deleteSubmission);

/* ═══════════════════════════════════════
   LIVE SESSIONS
═══════════════════════════════════════ */
router.get('/live-sessions',              ctrl.getLiveSessions);
router.post('/live-sessions',             ctrl.createLiveSession);
router.get('/live-sessions/:id',          ctrl.getLiveSession);
router.patch('/live-sessions/:id',        ctrl.updateLiveSession);
router.put('/live-sessions/:id',          ctrl.updateLiveSession);
router.delete('/live-sessions/:id',       ctrl.deleteLiveSession);
router.patch('/live-sessions/:id/start',  ctrl.startLiveSession);
router.put('/live-sessions/:id/start',    ctrl.startLiveSession);
router.patch('/live-sessions/:id/end',    ctrl.endLiveSession);
router.put('/live-sessions/:id/end',      ctrl.endLiveSession);

/* ═══════════════════════════════════════
   ANALYTICS / EARNINGS
═══════════════════════════════════════ */
router.get('/analytics', ctrl.getAnalytics);
router.get('/earnings',  ctrl.getEarnings);

/* ═══════════════════════════════════════
   MESSAGES
═══════════════════════════════════════ */
router.get('/messages/rooms',          ctrl.getMessageRooms);
router.post('/messages/rooms',         ctrl.createRoom);
router.get('/messages/:roomId',        ctrl.getMessages);
router.post('/messages/:roomId',       ctrl.sendMessage);
router.patch('/messages/:roomId/read', ctrl.markMessagesRead);
router.put('/messages/:roomId/read',   ctrl.markMessagesRead);

/* ═══════════════════════════════════════
   PROFILE
═══════════════════════════════════════ */
router.get('/profile',            ctrl.getProfile);
router.patch('/profile',          ctrl.updateProfile);
router.put('/profile',            ctrl.updateProfile);
router.patch('/profile/password', ctrl.updatePassword);
router.put('/profile/password',   ctrl.updatePassword);
router.post('/profile/avatar',    avatarUpload.single('avatar'), ctrl.updateAvatar);

module.exports = router;