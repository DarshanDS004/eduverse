/**
 * EduVerse — Quizzes Routes
 * modules/quizzes/quizzes.routes.js
 */
'use strict';
const express    = require('express');
const router     = express.Router();
const controller = require('./quizzes.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

router.use(protect, restrictTo('student'));
router.post('/:id/start',           controller.startQuiz);
router.post('/:id/submit',          controller.submitQuiz);
router.get('/attempts/:attemptId',  controller.getResult);

module.exports = router;