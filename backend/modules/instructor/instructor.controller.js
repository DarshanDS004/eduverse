/**
 * EduVerse — Instructor Controller  (FIXED v2)
 * modules/instructor/instructor.controller.js
 *
 * Fixes applied in this version:
 *  1. getCoupons handler added (GET /courses/:id/coupons)
 *  2. saveCoupons handler added (POST /courses/:id/coupons)
 *  3. All existing handlers unchanged — fully compatible
 */

'use strict';

const svc                        = require('./instructor.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

/* ═══════════════════════════════════════ DASHBOARD */
exports.getDashboard = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Dashboard loaded.', await svc.getDashboard(req.user.id)); }
  catch (e) { next(e); }
};

/* ═══════════════════════════════════════ COURSES */
exports.getMyCourses = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Courses loaded.', await svc.getMyCourses(req.user.id)); }
  catch (e) { next(e); }
};

exports.getCourse = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Course loaded.', await svc.getCourse(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

exports.createCourse = async (req, res, next) => {
  try {
    const data = await svc.createCourse(req.user.id, req.body);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const data = await svc.updateCourse(req.params.id, req.user.id, req.body);
    return sendSuccess(res, 200, data.message, data);
  } catch (e) { next(e); }
};

exports.publishCourse = async (req, res, next) => {
  try {
    const data = await svc.publishCourse(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    const data = await svc.deleteCourse(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

/**
 * uploadThumbnail
 * POST /courses/:id/thumbnail  (multipart, field: thumbnail)
 */
exports.uploadThumbnail = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    const url = '/uploads/thumbnails/' + req.file.filename;
    await svc.updateCourse(req.params.id, req.user.id, { thumbnail_url: url });
    return sendSuccess(res, 200, 'Thumbnail uploaded.', { thumbnail_url: url });
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ COUPONS (FIX: new handlers) */

/**
 * getCoupons — GET /courses/:id/coupons
 */
exports.getCoupons = async (req, res, next) => {
  try {
    const data = await svc.getCoupons(req.params.id, req.user.id);
    return sendSuccess(res, 200, 'Coupons loaded.', data);
  } catch (e) { next(e); }
};

/**
 * saveCoupons — POST /courses/:id/coupons
 * Body: { coupons: [{ code, type, value, max_uses, expiry }] }
 */
exports.saveCoupons = async (req, res, next) => {
  try {
    const { coupons } = req.body;
    if (!Array.isArray(coupons)) {
      return sendError(res, 400, 'coupons must be an array.', 'INVALID_BODY');
    }
    await svc.saveCoupons(req.params.id, req.user.id, coupons);
    return sendSuccess(res, 200, 'Coupons saved.');
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ MODULES / SECTIONS */
exports.getModules = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.params.id;
    const data     = await svc.getModules(courseId, req.user.id);
    return sendSuccess(res, 200, 'Modules loaded.', data);
  } catch (e) { next(e); }
};

exports.addModule = async (req, res, next) => {
  try {
    const courseId                      = req.params.courseId || req.params.id;
    const { title, description, order } = req.body;
    if (!title) return sendError(res, 400, 'Module title is required.', 'MISSING_TITLE');
    const data = await svc.addModule(courseId, req.user.id, title, description, order);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

exports.updateModule = async (req, res, next) => {
  try {
    const id   = req.params.id || req.params.moduleId || req.params.sectionId;
    const data = await svc.updateModule(id, req.user.id, req.body);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.deleteModule = async (req, res, next) => {
  try {
    const id   = req.params.id || req.params.moduleId || req.params.sectionId;
    const data = await svc.deleteModule(id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ VIDEOS / LESSONS */

exports.getVideos = async (req, res, next) => {
  try {
    const moduleId = req.params.moduleId || req.params.sectionId || req.params.id;
    const data     = await svc.getVideos(moduleId, req.user.id);
    return sendSuccess(res, 200, 'Lessons loaded.', data);
  } catch (e) { next(e); }
};

/**
 * addVideoJson — JSON body only (video_url or stub).
 * POST /modules/:moduleId/videos
 */
exports.addVideoJson = async (req, res, next) => {
  try {
    const moduleId = req.params.moduleId || req.params.sectionId;
    const data     = await svc.addVideo(moduleId, req.user.id, req.body, null);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

/**
 * addLesson — JSON body (title, type, order).
 * POST /sections/:sectionId/lessons  — used by courses.html builder
 */
exports.addLesson = async (req, res, next) => {
  try {
    const moduleId = req.params.sectionId || req.params.moduleId;
    const { title, type, order, description, content, timestamps, duration, is_preview } = req.body;
    if (!title) return sendError(res, 400, 'Lesson title is required.', 'MISSING_TITLE');
    const data = await svc.addVideo(moduleId, req.user.id, {
      title,
      type:        type        || 'video',
      order:       order       || null,
      description: description || null,
      content:     content     || null,
      timestamps:  timestamps  || null,
      video_url:   null,
      duration:    duration    || 0,
      is_preview:  is_preview  || false,
    }, null);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

/**
 * addVideo — multipart file upload.
 * POST /modules/:moduleId/videos/upload
 */
exports.addVideo = async (req, res, next) => {
  try {
    const moduleId = req.params.moduleId || req.params.sectionId;
    const data     = await svc.addVideo(moduleId, req.user.id, req.body, req.file || null);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

exports.updateVideo = async (req, res, next) => {
  try {
    const id   = req.params.id || req.params.videoId || req.params.lessonId;
    const data = await svc.updateVideo(id, req.user.id, req.body);
    return sendSuccess(res, 200, data.message, data);
  } catch (e) { next(e); }
};

exports.deleteVideo = async (req, res, next) => {
  try {
    const id   = req.params.id || req.params.videoId || req.params.lessonId;
    const data = await svc.deleteVideo(id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

/**
 * uploadLessonVideo — multipart file upload to an existing lesson.
 * POST /lessons/:id/upload-video
 */
exports.uploadLessonVideo = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No video file uploaded.', 'NO_FILE');
    const id  = req.params.id;
    const url = '/uploads/videos/' + req.file.filename;
    await svc.updateVideo(id, req.user.id, { video_url: url });
    return sendSuccess(res, 200, 'Video uploaded.', { video_url: url });
  } catch (e) { next(e); }
};

/**
 * saveLessonVideoUrl — save an external URL to a lesson.
 * POST /lessons/:id/video-url
 */
exports.saveLessonVideoUrl = async (req, res, next) => {
  try {
    const { video_url } = req.body;
    if (!video_url) return sendError(res, 400, 'video_url is required.', 'MISSING_URL');
    await svc.updateVideo(req.params.id, req.user.id, { video_url });
    return sendSuccess(res, 200, 'Video URL saved.', { video_url });
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ STUDENTS */
exports.getMyStudents = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Students loaded.', await svc.getMyStudents(req.user.id, req.query)); }
  catch (e) { next(e); }
};

exports.getStudentDetail = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Student loaded.', await svc.getStudentDetail(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ═══════════════════════════════════════ QUIZZES */
exports.getQuizzes = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Quizzes loaded.', await svc.getQuizzes(req.user.id)); }
  catch (e) { next(e); }
};

exports.getQuiz = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Quiz loaded.', await svc.getQuiz(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

exports.createQuiz = async (req, res, next) => {
  try {
    const data = await svc.createQuiz(req.user.id, req.body);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

exports.updateQuiz = async (req, res, next) => {
  try {
    const data = await svc.updateQuiz(req.params.id, req.user.id, req.body);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.publishQuiz = async (req, res, next) => {
  try {
    const data = await svc.publishQuiz(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.deleteQuiz = async (req, res, next) => {
  try {
    const data = await svc.deleteQuiz(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ ASSIGNMENTS */
exports.getAssignments = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Assignments loaded.', await svc.getAssignments(req.user.id)); }
  catch (e) { next(e); }
};

exports.getAssignment = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Assignment loaded.', await svc.getAssignment(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const fileUrl  = req.file ? '/uploads/assignments/' + req.file.filename : null;
    const fileName = req.file ? req.file.originalname : null;
    const data     = await svc.createAssignment(req.user.id, req.body, fileUrl, fileName);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

exports.updateAssignment = async (req, res, next) => {
  try {
    const data = await svc.updateAssignment(req.params.id, req.user.id, req.body);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.deleteAssignment = async (req, res, next) => {
  try {
    const data = await svc.deleteAssignment(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

/* Submissions */
exports.getSubmissions = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Submissions loaded.', await svc.getSubmissions(req.user.id, req.query)); }
  catch (e) { next(e); }
};

exports.gradeSubmission = async (req, res, next) => {
  try {
    const { score, feedback } = req.body;
    if (score === undefined) return sendError(res, 400, 'Score is required.', 'MISSING_SCORE');
    const data = await svc.gradeSubmission(req.params.id, req.user.id, score, feedback);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.deleteSubmission = async (req, res, next) => {
  try {
    const data = await svc.deleteSubmission(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ LIVE SESSIONS */
exports.getLiveSessions = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Sessions loaded.',
      await svc.getLiveSessions(req.user.id, req.query.status));
  } catch (e) { next(e); }
};

exports.getLiveSession = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Session loaded.', await svc.getLiveSession(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

exports.createLiveSession = async (req, res, next) => {
  try {
    const data = await svc.createLiveSession(req.user.id, req.body);
    return sendSuccess(res, 201, data.message, data);
  } catch (e) { next(e); }
};

exports.updateLiveSession = async (req, res, next) => {
  try {
    const data = await svc.updateLiveSession(req.params.id, req.user.id, req.body);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.deleteLiveSession = async (req, res, next) => {
  try {
    const data = await svc.deleteLiveSession(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.startLiveSession = async (req, res, next) => {
  try {
    await svc.updateLiveSession(req.params.id, req.user.id, { status: 'live' });
    return sendSuccess(res, 200, 'Session started.');
  } catch (e) { next(e); }
};

exports.endLiveSession = async (req, res, next) => {
  try {
    await svc.updateLiveSession(req.params.id, req.user.id, { status: 'ended' });
    return sendSuccess(res, 200, 'Session ended.');
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ ANALYTICS / EARNINGS */
exports.getAnalytics = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Analytics loaded.', await svc.getAnalytics(req.user.id, req.query.days)); }
  catch (e) { next(e); }
};

exports.getEarnings = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Earnings loaded.', await svc.getEarnings(req.user.id, req.query)); }
  catch (e) { next(e); }
};

/* ═══════════════════════════════════════ MESSAGES */
exports.getMessageRooms = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Rooms loaded.', await svc.getMessageRooms(req.user.id)); }
  catch (e) { next(e); }
};

exports.createRoom = async (req, res, next) => {
  try {
    const { other_user_id } = req.body;
    if (!other_user_id) return sendError(res, 400, 'other_user_id is required.', 'MISSING_FIELDS');
    const data = await svc.getOrCreateRoom(req.user.id, other_user_id);
    return sendSuccess(res, 200, 'Room ready.', data);
  } catch (e) { next(e); }
};

exports.getMessages = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Messages loaded.',
      await svc.getMessages(req.params.roomId, req.user.id, req.query.limit));
  } catch (e) { next(e); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) return sendError(res, 400, 'Content is required.', 'MISSING_FIELDS');
    const data = await svc.sendMessage(req.params.roomId, req.user.id, content);
    return sendSuccess(res, 201, 'Message sent.', data);
  } catch (e) { next(e); }
};

exports.markMessagesRead = async (req, res, next) => {
  try {
    await svc.markRoomRead(req.params.roomId, req.user.id);
    return sendSuccess(res, 200, 'Marked as read.');
  } catch (e) { next(e); }
};

/* ═══════════════════════════════════════ PROFILE */
exports.getProfile = async (req, res, next) => {
  try { return sendSuccess(res, 200, 'Profile loaded.', await svc.getProfile(req.user.id)); }
  catch (e) { next(e); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const data = await svc.updateProfile(req.user.id, req.body);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return sendError(res, 400, 'Both passwords are required.', 'MISSING_FIELDS');
    const data = await svc.updatePassword(req.user.id, current_password, new_password);
    return sendSuccess(res, 200, data.message);
  } catch (e) { next(e); }
};

exports.updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    const url  = '/uploads/avatars/' + req.file.filename;
    const data = await svc.updateAvatar(req.user.id, url);
    return sendSuccess(res, 200, data.message, data);
  } catch (e) { next(e); }
};