/**
 * EduVerse — Quizzes Service
 * modules/quizzes/quizzes.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');

/* ============================================================
   START QUIZ — creates an attempt, returns questions
============================================================ */

async function startQuiz(quizId, studentId) {
  const [[quiz]] = await db.query(
    `SELECT id, title, description, duration_seconds,
            total_marks, pass_percentage, shuffle_questions, shuffle_options
     FROM quizzes WHERE id = ? AND status = 'published'`,
    [quizId]
  );
  if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');

  // Create attempt
  const [result] = await db.query(
    'INSERT INTO quiz_attempts (quiz_id, student_id) VALUES (?, ?)',
    [quizId, studentId]
  );
  const attemptId = result.insertId;

  // Get questions with options
  let [questions] = await db.query(
    `SELECT id, question, type, marks, order_index
     FROM quiz_questions WHERE quiz_id = ?
     ORDER BY ${quiz.shuffle_questions ? 'RAND()' : 'order_index ASC'}`,
    [quizId]
  );

  for (const q of questions) {
    let [options] = await db.query(
      `SELECT id, text, order_index FROM quiz_options WHERE question_id = ?
       ORDER BY ${quiz.shuffle_options ? 'RAND()' : 'order_index ASC'}`,
      [q.id]
    );
    q.options = options;
  }

  return {
    attempt_id:       attemptId,
    quiz_id:          quiz.id,
    title:            quiz.title,
    description:      quiz.description,
    duration_seconds: quiz.duration_seconds,
    total_marks:      quiz.total_marks,
    questions,
  };
}

/* ============================================================
   SUBMIT QUIZ — grade answers, save result
============================================================ */

async function submitQuiz(quizId, studentId, attemptId, answers) {
  // Validate attempt belongs to this student
  const [[attempt]] = await db.query(
    'SELECT id, submitted_at FROM quiz_attempts WHERE id = ? AND student_id = ? AND quiz_id = ?',
    [attemptId, studentId, quizId]
  );
  if (!attempt) throw new AppError('Attempt not found.', 404, 'NOT_FOUND');
  if (attempt.submitted_at) throw new AppError('Quiz already submitted.', 409, 'ALREADY_SUBMITTED');

  const [[quiz]] = await db.query(
    'SELECT total_marks, pass_percentage FROM quizzes WHERE id = ?',
    [quizId]
  );

  // Grade each answer
  let totalScore = 0;
  let totalQuestions = answers.length;

  for (const answer of answers) {
    const { question_id, selected_option_id } = answer;

    // Get correct option
    const [[question]] = await db.query(
      'SELECT id, marks FROM quiz_questions WHERE id = ? AND quiz_id = ?',
      [question_id, quizId]
    );
    if (!question) continue;

    let isCorrect    = false;
    let marksAwarded = 0;

    if (selected_option_id) {
      const [[option]] = await db.query(
        'SELECT is_correct FROM quiz_options WHERE id = ? AND question_id = ?',
        [selected_option_id, question_id]
      );
      if (option && option.is_correct) {
        isCorrect    = true;
        marksAwarded = question.marks;
        totalScore  += marksAwarded;
      }
    }

    // Save answer
    await db.query(
      `INSERT INTO quiz_answers
         (attempt_id, question_id, selected_option_id, is_correct, marks_awarded)
       VALUES (?, ?, ?, ?, ?)`,
      [attemptId, question_id, selected_option_id || null, isCorrect ? 1 : 0, marksAwarded]
    );
  }

  const percentage = quiz.total_marks > 0
    ? Math.round((totalScore / quiz.total_marks) * 100)
    : 0;
  const passed = percentage >= (quiz.pass_percentage || 60);

  // Update attempt
  await db.query(
    `UPDATE quiz_attempts SET
       score = ?, total_marks = ?, total_questions = ?,
       percentage = ?, passed = ?,
       time_taken = TIMESTAMPDIFF(SECOND, started_at, NOW()),
       submitted_at = NOW()
     WHERE id = ?`,
    [totalScore, quiz.total_marks, totalQuestions, percentage, passed ? 1 : 0, attemptId]
  );

  return {
    attempt_id:      attemptId,
    score:           totalScore,
    total_marks:     quiz.total_marks,
    total_questions: totalQuestions,
    percentage,
    passed,
  };
}

/* ============================================================
   GET ATTEMPT RESULT
============================================================ */

async function getAttemptResult(attemptId) {
  const [[attempt]] = await db.query(
    `SELECT qa.*, q.title AS quiz_title, q.pass_percentage
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.id = ?`,
    [attemptId]
  );
  if (!attempt) throw new AppError('Result not found.', 404, 'NOT_FOUND');

  const [answers] = await db.query(
    `SELECT
       qan.question_id, qan.selected_option_id,
       qan.is_correct, qan.marks_awarded,
       qq.question, qq.marks AS max_marks,
       qo.text AS selected_text,
       (SELECT text FROM quiz_options WHERE question_id = qq.id AND is_correct = 1 LIMIT 1) AS correct_text
     FROM quiz_answers qan
     JOIN quiz_questions qq ON qq.id = qan.question_id
     LEFT JOIN quiz_options qo ON qo.id = qan.selected_option_id
     WHERE qan.attempt_id = ?`,
    [attemptId]
  );

  return { ...attempt, answers };
}

module.exports = { startQuiz, submitQuiz, getAttemptResult };