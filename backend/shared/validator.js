/**
 * EduVerse — Input Validator
 * shared/validator.js
 *
 * Centralized validation using express-validator.
 *
 * Pattern:
 * 1. Define a validation chain using the helpers below
 * 2. Add it to a route as middleware
 * 3. Call `validate(req, res, next)` at end of chain to check results
 *
 * Example in route:
 *   router.post('/register',
 *     validators.register,
 *     validate,
 *     controller.register
 *   );
 */

'use strict';

const { body, param, query, validationResult } = require('express-validator');
const { sendError } = require('./errorHandler');

/* ============================================================
   VALIDATE MIDDLEWARE
   Run after validation chain — collects errors and responds
============================================================ */

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map(e => ({
      field:   e.path || e.param,
      message: e.msg,
    }));
    return sendError(res, 422, 'Validation failed.', 'VALIDATION_ERROR', formatted);
  }
  next();
}

/* ============================================================
   COMMON FIELD VALIDATORS
============================================================ */

const field = {

  name: () =>
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required.')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),

  email: () =>
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required.')
      .isEmail().withMessage('Please enter a valid email address.')
      .normalizeEmail(),

  password: () =>
    body('password')
      .notEmpty().withMessage('Password is required.')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
      .matches(/[0-9]/).withMessage('Password must contain at least one number.'),

  phone: () =>
    body('phone')
      .optional()
      .trim()
      .matches(/^\+?[0-9]{7,15}$/).withMessage('Please enter a valid phone number.'),

  role: () =>
    body('role')
      .notEmpty().withMessage('Role is required.')
      .isIn(['student', 'instructor', 'parent', 'institute'])
      .withMessage('Invalid role. Must be: student, instructor, parent, or institute.'),

  id: (fieldName = 'id') =>
    param(fieldName)
      .notEmpty().withMessage(`${fieldName} is required.`)
      .isInt({ min: 1 }).withMessage(`${fieldName} must be a positive integer.`)
      .toInt(),

  positiveInt: (fieldName) =>
    body(fieldName)
      .optional()
      .isInt({ min: 1 }).withMessage(`${fieldName} must be a positive integer.`)
      .toInt(),

  rating: () =>
    body('rating')
      .notEmpty().withMessage('Rating is required.')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.')
      .toInt(),

  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer.')
      .toInt(),
    query('per_page')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('per_page must be between 1 and 100.')
      .toInt(),
  ],

  dateField: (fieldName) =>
    body(fieldName)
      .optional()
      .isISO8601().withMessage(`${fieldName} must be a valid date (ISO 8601).`)
      .toDate(),

  url: (fieldName) =>
    body(fieldName)
      .optional()
      .trim()
      .isURL().withMessage(`${fieldName} must be a valid URL.`),

  price: () =>
    body('price')
      .optional()
      .isFloat({ min: 0 }).withMessage('Price must be a non-negative number.')
      .toFloat(),

  level: () =>
    body('level')
      .optional()
      .isIn(['preschool', 'primary', 'middle', 'high', 'ug', 'pg', 'beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid education level.'),

};

/* ============================================================
   VALIDATION CHAINS — Per route / feature
   Used as middleware arrays in routes.
============================================================ */

const validators = {

  /* ── Auth ── */
  register: [
    field.name(),
    field.email(),
    field.password(),
    field.role(),
    field.phone(),
  ],

  login: [
    field.email(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],

  forgotPassword: [
    field.email(),
  ],

  resetPassword: [
    body('token').notEmpty().withMessage('Reset token is required.'),
    field.password(),
    body('confirm_password')
      .notEmpty().withMessage('Confirm password is required.')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match.');
        }
        return true;
      }),
  ],

  /* ── Courses ── */
  createCourse: [
    body('title')
      .trim()
      .notEmpty().withMessage('Course title is required.')
      .isLength({ max: 255 }).withMessage('Title must be under 255 characters.'),
    field.price(),
    field.level(),
    body('language').optional().trim().isLength({ max: 50 }),
    body('category').optional().trim().isLength({ max: 100 }),
  ],

  submitReview: [
    field.id('id'),
    field.rating(),
    body('review_text').optional().trim().isLength({ max: 2000 }),
  ],

  /* ── Quizzes ── */
  createQuiz: [
    body('title')
      .trim()
      .notEmpty().withMessage('Quiz title is required.'),
    body('duration_seconds')
      .optional()
      .isInt({ min: 60 }).withMessage('Duration must be at least 60 seconds.')
      .toInt(),
    body('pass_percentage')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Pass percentage must be 1–100.')
      .toInt(),
    body('total_marks')
      .optional()
      .isInt({ min: 1 }).withMessage('Total marks must be at least 1.')
      .toInt(),
  ],

  startQuiz: [
    field.id('id'),
  ],

  submitQuiz: [
    field.id('id'),
    body('attempt_id')
      .notEmpty().withMessage('attempt_id is required.')
      .isInt({ min: 1 }).toInt(),
    body('answers')
      .isArray({ min: 0 }).withMessage('answers must be an array.'),
  ],

  /* ── Assignments ── */
  createAssignment: [
    body('title')
      .trim()
      .notEmpty().withMessage('Assignment title is required.'),
    body('course_id')
      .notEmpty().withMessage('course_id is required.')
      .isInt({ min: 1 }).toInt(),
    body('max_marks')
      .optional()
      .isInt({ min: 1 }).toInt(),
    field.dateField('deadline'),
  ],

  gradeSubmission: [
    field.id('id'),
    body('score')
      .notEmpty().withMessage('Score is required.')
      .isFloat({ min: 0 }).withMessage('Score must be a non-negative number.')
      .toFloat(),
    body('feedback').optional().trim().isLength({ max: 5000 }),
  ],

  /* ── Payments ── */
  createOrder: [
    body('type')
      .notEmpty().withMessage('Payment type is required.')
      .isIn(['course_purchase', 'material', 'fee', 'subscription'])
      .withMessage('Invalid payment type.'),
    body('reference_id')
      .notEmpty().withMessage('reference_id is required.')
      .isInt({ min: 1 }).toInt(),
  ],

  requestRefund: [
    body('payment_id')
      .notEmpty().withMessage('payment_id is required.')
      .isInt({ min: 1 }).toInt(),
    body('reason')
      .trim()
      .notEmpty().withMessage('Reason is required.')
      .isLength({ min: 10, max: 1000 }).withMessage('Reason must be 10–1000 characters.'),
  ],

  /* ── Messages ── */
  sendMessage: [
    body('content')
      .trim()
      .notEmpty().withMessage('Message content is required.')
      .isLength({ max: 5000 }).withMessage('Message too long.'),
  ],

  /* ── Institute ── */
  createClass: [
    body('name')
      .trim()
      .notEmpty().withMessage('Class name is required.')
      .isLength({ max: 100 }),
    body('section')
      .optional()
      .trim()
      .isLength({ max: 10 }),
  ],

  addStudent: [
    field.name(),
    field.email(),
    field.phone(),
  ],

  createFeeStructure: [
    body('name').trim().notEmpty().withMessage('Fee name is required.'),
    body('amount')
      .notEmpty().withMessage('Amount is required.')
      .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.')
      .toFloat(),
    body('type')
      .optional()
      .isIn(['tuition', 'exam', 'activity', 'library', 'transport', 'other'])
      .withMessage('Invalid fee type.'),
  ],

  createCalendarEvent: [
    body('event_name').trim().notEmpty().withMessage('Event name is required.'),
    field.dateField('event_date'),
    body('event_type')
      .optional()
      .isIn(['holiday', 'exam', 'assignment_deadline', 'event', 'ptm', 'live_class', 'other']),
  ],

  /* ── Super Admin ── */
  updateUserStatus: [
    field.id('id'),
    body('status')
      .notEmpty().withMessage('Status is required.')
      .isIn(['active', 'suspended', 'banned'])
      .withMessage('Invalid status.'),
  ],

  updateFeatureFlag: [
    body('feature_name').trim().notEmpty().withMessage('feature_name is required.'),
    body('is_enabled').isBoolean().withMessage('is_enabled must be boolean.'),
  ],

  /* ── Support ── */
  createTicket: [
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required.')
      .isLength({ max: 255 }),
    body('description')
      .trim()
      .notEmpty().withMessage('Description is required.')
      .isLength({ min: 10, max: 5000 }),
    body('category').optional().trim(),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent']),
  ],

  replyTicket: [
    field.id('id'),
    body('message')
      .trim()
      .notEmpty().withMessage('Message is required.')
      .isLength({ max: 5000 }),
  ],

  /* ── Parent ── */
  linkChild: [
    body('student_id')
      .notEmpty().withMessage('student_id is required.')
      .isInt({ min: 1 }).toInt(),
    body('relation')
      .optional()
      .isIn(['father', 'mother', 'guardian']),
  ],

  /* ── Live Sessions ── */
  createLiveSession: [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('scheduled_at')
      .notEmpty().withMessage('Scheduled time is required.')
      .isISO8601().withMessage('scheduled_at must be a valid datetime.'),
    body('duration_minutes')
      .optional()
      .isInt({ min: 5, max: 480 }).withMessage('Duration must be 5–480 minutes.')
      .toInt(),
  ],

};

module.exports = { validate, validators, field };