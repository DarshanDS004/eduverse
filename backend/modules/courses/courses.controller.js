/**
 * EduVerse — Courses Controller (COMPLETE)
 * modules/courses/courses.controller.js
 *
 * Handlers:
 *  Public      : listCourses, getCourse, getCategories
 *  Student     : enroll, submitReview, getWishlist, toggleWishlist
 *  Instructor  : createCourse, updateCourse, deleteCourse,
 *                publishCourse, saveDraft, getInstructorCourses
 *  Admin       : adminListCourses, adminDeleteCourse
 *
 * Fix for "Unexpected end of JSON input":
 *  - Every route now always calls sendSuccess / sendError / next(err)
 *  - No silent exits that leave the response body empty
 */

'use strict';

const service                    = require('./courses.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

/* ══════════════════════════════════════
   PUBLIC
══════════════════════════════════════ */

/**
 * GET /api/v1/courses
 * Query params: page, limit, category, search, level, minPrice, maxPrice, sortBy
 */
async function listCourses(req, res, next) {
  try {
    const data = await service.listCourses(req.query);
    return sendSuccess(res, 200, 'Courses fetched.', data);
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/courses/categories
 */
async function getCategories(req, res, next) {
  try {
    const data = await service.getCategories();
    return sendSuccess(res, 200, 'Categories fetched.', data);
  } catch (err) { next(err); }
}

/**
 * GET  /api/v1/courses/:id
 * HEAD /api/v1/courses/:id
 * GET  /api/v1/courses/:id/reviews
 * optionalAuth — enrolled users receive video_urls
 */
async function getCourse(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const data   = await service.getCourse(req.params.id, userId);
    if (!data) return sendError(res, 404, 'Course not found.', 'COURSE_NOT_FOUND');
    return sendSuccess(res, 200, 'Course fetched.', data);
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════
   STUDENT
══════════════════════════════════════ */

/**
 * POST /api/v1/courses/:id/enroll
 * Returns 201 for free/direct enroll, 200 + payment_url for paid courses
 */
async function enroll(req, res, next) {
  try {
    const data = await service.enroll(req.params.id, req.user.id);
    const code = data.enrolled ? 201 : 200;
    return sendSuccess(res, code, data.message, data);
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/courses/:id/reviews
 * Body: { rating: 1-5, review_text?: string }
 */
async function submitReview(req, res, next) {
  try {
    const rating      = parseInt(req.body.rating, 10);
    const review_text = req.body.review_text || null;
    if (!rating || rating < 1 || rating > 5) {
      return sendError(res, 400, 'Rating must be between 1 and 5.', 'INVALID_RATING');
    }
    const data = await service.submitReview(req.params.id, req.user.id, rating, review_text);
    return sendSuccess(res, 200, data.message, data);
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/courses/wishlist
 */
async function getWishlist(req, res, next) {
  try {
    const data = await service.getWishlist(req.user.id);
    return sendSuccess(res, 200, 'Wishlist fetched.', data);
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/courses/:id/wishlist
 * Toggles: adds if not present, removes if present
 */
async function toggleWishlist(req, res, next) {
  try {
    const data = await service.toggleWishlist(req.params.id, req.user.id);
    return sendSuccess(res, 200, data.message, data);
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════
   INSTRUCTOR
══════════════════════════════════════ */

/**
 * GET /api/v1/courses/instructor/my-courses
 * Lists all courses (including drafts) belonging to the logged-in instructor
 */
async function getInstructorCourses(req, res, next) {
  try {
    const data = await service.getInstructorCourses(req.user.id, req.query);
    return sendSuccess(res, 200, 'Instructor courses fetched.', data);
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/courses
 * Create a new course (starts as draft)
 * Body: { title, description, category_id, price, level, thumbnail?, sections? }
 */
async function createCourse(req, res, next) {
  try {
    const { title, description, category_id, price, level, thumbnail, sections } = req.body;

    if (!title || !title.trim()) {
      return sendError(res, 400, 'Course title is required.', 'MISSING_TITLE');
    }
    if (!category_id) {
      return sendError(res, 400, 'Category is required.', 'MISSING_CATEGORY');
    }

    const data = await service.createCourse(req.user.id, {
      title:       title.trim(),
      description: description || '',
      category_id,
      price:       parseFloat(price) || 0,
      level:       level || 'beginner',
      thumbnail:   thumbnail || null,
      sections:    sections  || [],
      status:      'draft',
    });

    return sendSuccess(res, 201, 'Course created successfully.', data);
  } catch (err) { next(err); }
}

/**
 * PUT   /api/v1/courses/:id
 * PATCH /api/v1/courses/:id
 * Update any fields of an existing course
 * Body: any subset of { title, description, category_id, price, level, thumbnail, sections, status }
 *
 * FIX: This is the handler that was missing — caused "Unexpected end of JSON input"
 *      when the frontend's "Save Course" button sent PUT/PATCH with no matching route.
 */
async function updateCourse(req, res, next) {
  try {
    const courseId = req.params.id;

    // Validate ownership before touching anything
    const owned = await service.isCourseOwnedBy(courseId, req.user.id);
    if (!owned) {
      return sendError(res, 403, 'You do not have permission to edit this course.', 'FORBIDDEN');
    }

    const allowed = ['title', 'description', 'category_id', 'price', 'level', 'thumbnail', 'sections', 'tags', 'requirements', 'objectives', 'language'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.title !== undefined && !updates.title.trim()) {
      return sendError(res, 400, 'Course title cannot be empty.', 'INVALID_TITLE');
    }
    if (updates.price !== undefined) {
      updates.price = parseFloat(updates.price);
      if (isNaN(updates.price) || updates.price < 0) {
        return sendError(res, 400, 'Invalid price value.', 'INVALID_PRICE');
      }
    }

    const data = await service.updateCourse(courseId, req.user.id, updates);
    return sendSuccess(res, 200, 'Course updated successfully.', data);
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/courses/:id/save-draft
 * Explicit "Save as Draft" — same as updateCourse but forces status = 'draft'
 * This is the endpoint your "Save Course" button should call
 */
async function saveDraft(req, res, next) {
  try {
    const courseId = req.params.id;

    const owned = await service.isCourseOwnedBy(courseId, req.user.id);
    if (!owned) {
      return sendError(res, 403, 'You do not have permission to edit this course.', 'FORBIDDEN');
    }

    const allowed = ['title', 'description', 'category_id', 'price', 'level', 'thumbnail', 'sections', 'tags', 'requirements', 'objectives', 'language'];
    const updates = { status: 'draft' };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const data = await service.updateCourse(courseId, req.user.id, updates);
    return sendSuccess(res, 200, 'Draft saved successfully.', data);
  } catch (err) { next(err); }
}

/**
 * POST /api/v1/courses/:id/publish
 * Validates required fields then sets status = 'published'
 */
async function publishCourse(req, res, next) {
  try {
    const courseId = req.params.id;

    const owned = await service.isCourseOwnedBy(courseId, req.user.id);
    if (!owned) {
      return sendError(res, 403, 'You do not have permission to publish this course.', 'FORBIDDEN');
    }

    // Service should validate: has title, description, at least 1 section/video, price set
    const data = await service.publishCourse(courseId, req.user.id);
    return sendSuccess(res, 200, 'Course published successfully.', data);
  } catch (err) { next(err); }
}

/**
 * DELETE /api/v1/courses/:id
 * Soft-delete (recommended) or hard-delete depending on service implementation
 */
async function deleteCourse(req, res, next) {
  try {
    const courseId = req.params.id;

    const owned = await service.isCourseOwnedBy(courseId, req.user.id);
    if (!owned) {
      return sendError(res, 403, 'You do not have permission to delete this course.', 'FORBIDDEN');
    }

    await service.deleteCourse(courseId, req.user.id);
    return sendSuccess(res, 200, 'Course deleted successfully.');
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════
   SUPER ADMIN
══════════════════════════════════════ */

/**
 * GET /api/v1/courses/admin/all
 * All courses across all instructors (admin view)
 */
async function adminListCourses(req, res, next) {
  try {
    const data = await service.adminListCourses(req.query);
    return sendSuccess(res, 200, 'All courses fetched.', data);
  } catch (err) { next(err); }
}

/**
 * DELETE /api/v1/courses/admin/:id
 * Admin can delete any course regardless of ownership
 */
async function adminDeleteCourse(req, res, next) {
  try {
    await service.deleteCourse(req.params.id, null, { force: true });
    return sendSuccess(res, 200, 'Course deleted by admin.');
  } catch (err) { next(err); }
}

/* ══════════════════════════════════════
   EXPORTS
══════════════════════════════════════ */
module.exports = {
  // Public
  listCourses,
  getCategories,
  getCourse,
  // Student
  enroll,
  submitReview,
  getWishlist,
  toggleWishlist,
  // Instructor
  getInstructorCourses,
  createCourse,
  updateCourse,
  saveDraft,
  publishCourse,
  deleteCourse,
  // Admin
  adminListCourses,
  adminDeleteCourse,
};