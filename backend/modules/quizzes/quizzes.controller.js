/**
 * EduVerse — Quizzes Controller
 * modules/quizzes/quizzes.controller.js
 */
'use strict';
const service = require('./quizzes.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

async function startQuiz(req, res, next) {
  try {
    const data = await service.startQuiz(req.params.id, req.user.id);
    return sendSuccess(res, 200, 'Quiz started.', data);
  } catch (err) { next(err); }
}

async function submitQuiz(req, res, next) {
  try {
    const { attempt_id, answers } = req.body;
    if (!attempt_id || !Array.isArray(answers)) {
      return sendError(res, 400, 'attempt_id and answers are required.', 'MISSING_FIELDS');
    }
    const data = await service.submitQuiz(req.params.id, req.user.id, attempt_id, answers);
    return sendSuccess(res, 200, 'Quiz submitted.', data);
  } catch (err) { next(err); }
}

async function getResult(req, res, next) {
  try {
    const data = await service.getAttemptResult(req.params.attemptId);
    return sendSuccess(res, 200, 'Result fetched.', data);
  } catch (err) { next(err); }
}

module.exports = { startQuiz, submitQuiz, getResult };