/**
 * EduVerse — Courses Routes (COMPLETE)
 * modules/courses/courses.routes.js
 *
 * Route map:
 *
 *  PUBLIC
 *    GET    /api/v1/courses                        → listCourses
 *    GET    /api/v1/courses/categories             → getCategories
 *    GET    /api/v1/courses/:id                    → getCourse  (optionalAuth)
 *    HEAD   /api/v1/courses/:id                    → getCourse  (existence check)
 *    GET    /api/v1/courses/:id/reviews            → getCourse  (reviews embedded)
 *
 *  STUDENT
 *    GET    /api/v1/courses/wishlist               → getWishlist
 *    POST   /api/v1/courses/:id/wishlist           → toggleWishlist
 *    POST   /api/v1/courses/:id/enroll             → enroll
 *    POST   /api/v1/courses/:id/reviews            → submitReview
 *
 *  INSTRUCTOR
 *    GET    /api/v1/courses/instructor/my-courses  → getInstructorCourses
 *    POST   /api/v1/courses                        → createCourse
 *    PUT    /api/v1/courses/:id                    → updateCourse  ← FIX (was missing)
 *    PATCH  /api/v1/courses/:id                    → updateCourse  ← FIX (was missing)
 *    POST   /api/v1/courses/:id/save-draft         → saveDraft     ← FIX (was missing)
 *    POST   /api/v1/courses/:id/publish            → publishCourse
 *    DELETE /api/v1/courses/:id                    → deleteCourse
 *
 *  ADMIN
 *    GET    /api/v1/courses/admin/all              → adminListCourses
 *    DELETE /api/v1/courses/admin/:id              → adminDeleteCourse
 *
 * IMPORTANT — route ordering:
 *   Named static segments (/wishlist, /categories, /instructor/my-courses, /admin/*)
 *   MUST be declared BEFORE /:id routes, otherwise Express will match them as IDs.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('./courses.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

/* ══════════════════════════════════════
   OPTIONAL AUTH MIDDLEWARE
   Decodes JWT if present but does NOT reject missing/invalid tokens.
   Allows enrolled students to receive video_urls in the course detail response.
══════════════════════════════════════ */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const jwt     = require('jsonwebtoken');
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
  } catch (_) {
    // Invalid / expired token — treat as unauthenticated, don't block
  }
  next();
}

/* ══════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════ */
router.get('/',           controller.listCourses);
router.get('/categories', controller.getCategories);

/* ══════════════════════════════════════
   STUDENT ROUTES
   (Declared before /:id to avoid "wishlist" being treated as a course ID)
══════════════════════════════════════ */
router.get('/wishlist',
  protect,
  restrictTo('student'),
  controller.getWishlist
);

/* ══════════════════════════════════════
   INSTRUCTOR ROUTES — static segments first
══════════════════════════════════════ */
router.get('/instructor/my-courses',
  protect,
  restrictTo('instructor'),
  controller.getInstructorCourses
);

/**
 * POST /api/v1/courses
 * Create a new course — starts as draft
 */
router.post('/',
  protect,
  restrictTo('instructor'),
  controller.createCourse
);

/* ══════════════════════════════════════
   ADMIN ROUTES — static segments first
══════════════════════════════════════ */
router.get('/admin/all',
  protect,
  restrictTo('superadmin', 'admin'),
  controller.adminListCourses
);

router.delete('/admin/:id',
  protect,
  restrictTo('superadmin', 'admin'),
  controller.adminDeleteCourse
);

/* ══════════════════════════════════════
   DYNAMIC :id ROUTES
   These come AFTER all static-segment routes
══════════════════════════════════════ */

/* Course detail — public with optional auth */
router.get('/:id',         optionalAuth, controller.getCourse);
router.head('/:id',        optionalAuth, controller.getCourse);   // existence check
router.get('/:id/reviews', optionalAuth, controller.getCourse);   // reviews embedded in getCourse

/* Student — wishlist toggle */
router.post('/:id/wishlist',
  protect,
  restrictTo('student'),
  controller.toggleWishlist
);

/* Student — enroll */
router.post('/:id/enroll',
  protect,
  restrictTo('student'),
  controller.enroll
);

/* Student — submit review */
router.post('/:id/reviews',
  protect,
  restrictTo('student'),
  controller.submitReview
);

/**
 * PUT   /api/v1/courses/:id
 * PATCH /api/v1/courses/:id
 *
 * FIX: These were MISSING — the "Save Course" button was sending PUT/PATCH
 * to a route that didn't exist, resulting in the 404 handler returning HTML
 * which the frontend's res.json() couldn't parse →
 * "Unexpected end of JSON input"
 */
router.put('/:id',
  protect,
  restrictTo('instructor'),
  controller.updateCourse
);

router.patch('/:id',
  protect,
  restrictTo('instructor'),
  controller.updateCourse
);

/**
 * POST /api/v1/courses/:id/save-draft
 * Explicit save draft endpoint — use this for the "Save" button in course builder
 * Keeps status as 'draft' regardless of current status
 */
router.post('/:id/save-draft',
  protect,
  restrictTo('instructor'),
  controller.saveDraft
);

/**
 * POST /api/v1/courses/:id/publish
 * Validates required fields then publishes the course
 */
router.post('/:id/publish',
  protect,
  restrictTo('instructor'),
  controller.publishCourse
);

/**
 * DELETE /api/v1/courses/:id
 * Instructor deletes their own course
 */
router.delete('/:id',
  protect,
  restrictTo('instructor'),
  controller.deleteCourse
);

module.exports = router;