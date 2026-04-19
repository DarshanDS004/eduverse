# Quizzes Module — Documentation

## 1. FILE OVERVIEW

This documentation covers three interconnected files for the quiz module:

| File | Type | Purpose |
|------|------|---------|
| `quizzes.controller.js` | Express Controller | Handles HTTP requests for quiz operations |
| `quizzes.routes.js` | Express Router | Defines quiz endpoints and applies middleware |
| `quizzes.service.js` | Business Logic | Implements quiz logic: start, submit, grade, results |

---

## 2. MODULE RESPONSIBILITY

The quizzes module handles:
- **Quiz Execution** — Students start quizzes and submit answers
- **Answer Grading** — Auto-grade answers against correct options
- **Score Calculation** — Calculate marks, percentage, and pass/fail
- **Attempt Tracking** — Record quiz attempts with timing and results
- **Result Retrieval** — Provide detailed results with question-level feedback

This is an **assessment module** focused on quiz administration and student evaluation.

---

# QUIZZES.CONTROLLER.JS

## 1. FILE OVERVIEW

**File Name:** `quizzes.controller.js`  
**File Type:** Express Controller  
**Location:** `modules/quizzes/quizzes.controller.js`  
**Purpose:** Handles HTTP requests for quiz operations (start, submit, get results) and delegates to service layer.

---

## 2. RESPONSIBILITY

- **Request Handling** — Receive quiz requests from authenticated students
- **Input Validation** — Ensure required fields are present
- **Error Handling** — Catch service errors and format responses
- **Response Formatting** — Use `sendSuccess` and `sendError` utilities
- **User Context** — Extract authenticated user ID from JWT

---

## 3. IMPORTS

```javascript
const service = require('./quizzes.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');
```

---

## 4. FUNCTIONS

### `startQuiz(req, res, next)`

**Purpose:** Initiate a quiz attempt for a student.

**Parameters:**
- `req.params.id` — Quiz ID
- `req.user.id` — Student ID (from JWT)

**Returns (200):**
```json
{
  "success": true,
  "message": "Quiz started.",
  "data": {
    "attempt_id": 123,
    "quiz_id": 42,
    "title": "Python Basics Quiz",
    "description": "Test your Python knowledge",
    "duration_seconds": 1800,
    "total_marks": 100,
    "questions": [
      {
        "id": 1,
        "question": "What is Python?",
        "type": "mcq",
        "marks": 10,
        "order_index": 1,
        "options": [
          { "id": 101, "text": "A snake", "order_index": 1 },
          { "id": 102, "text": "A programming language", "order_index": 2 }
        ]
      }
    ]
  }
}
```

**Logic:**
1. Extracts quiz ID from URL parameter
2. Calls `service.startQuiz(quizId, studentId)`
3. Service creates quiz attempt record
4. Service retrieves questions with options
5. Returns quiz details and questions

**Error Cases:**
- Quiz not found (404)
- Quiz not published (404)

---

### `submitQuiz(req, res, next)`

**Purpose:** Submit quiz answers and get immediate scoring.

**Parameters:**
- `req.params.id` — Quiz ID
- `req.user.id` — Student ID (from JWT)
- `req.body.attempt_id` — Quiz attempt ID
- `req.body.answers` — Array of answers

**Request Body:**
```json
{
  "attempt_id": 123,
  "answers": [
    {
      "question_id": 1,
      "selected_option_id": 102
    },
    {
      "question_id": 2,
      "selected_option_id": 205
    }
  ]
}
```

**Returns (200):**
```json
{
  "success": true,
  "message": "Quiz submitted.",
  "data": {
    "attempt_id": 123,
    "score": 80,
    "total_marks": 100,
    "total_questions": 10,
    "percentage": 80,
    "passed": true
  }
}
```

**Logic:**
1. Validates `attempt_id` and `answers` are provided
2. Returns 400 error if missing
3. Calls `service.submitQuiz(quizId, studentId, attemptId, answers)`
4. Service grades answers and calculates score
5. Returns score summary

**Validation:**
- `attempt_id` — Required (number)
- `answers` — Required (array of objects)

**Error Cases:**
- Missing fields (400)
- Attempt not found (404)
- Quiz already submitted (409)

---

### `getResult(req, res, next)`

**Purpose:** Retrieve detailed quiz result with answer-by-answer breakdown.

**Parameters:**
- `req.params.attemptId` — Quiz attempt ID

**Returns (200):**
```json
{
  "success": true,
  "message": "Result fetched.",
  "data": {
    "id": 123,
    "quiz_id": 42,
    "student_id": 100,
    "score": 80,
    "total_marks": 100,
    "total_questions": 10,
    "percentage": 80,
    "passed": true,
    "quiz_title": "Python Basics Quiz",
    "pass_percentage": 60,
    "submitted_at": "2024-01-20T15:30:45Z",
    "answers": [
      {
        "question_id": 1,
        "selected_option_id": 102,
        "is_correct": true,
        "marks_awarded": 10,
        "question": "What is Python?",
        "max_marks": 10,
        "selected_text": "A programming language",
        "correct_text": "A programming language"
      }
    ]
  }
}
```

**Logic:**
1. Extracts attempt ID from URL
2. Calls `service.getAttemptResult(attemptId)`
3. Service retrieves attempt details and answers
4. Returns detailed result with feedback

**Error Cases:**
- Result not found (404)

---

## 5. SUMMARY

The quizzes controller is lightweight, handling only:
1. Request validation (required fields)
2. Error propagation
3. Response formatting

All business logic is in the service layer.

---

# QUIZZES.ROUTES.JS

## 1. FILE OVERVIEW

**File Name:** `quizzes.routes.js`  
**File Type:** Express Router Configuration  
**Location:** `modules/quizzes/quizzes.routes.js`  
**Purpose:** Defines quiz endpoints with authentication and role-based access.

---

## 2. IMPORTS & SETUP

```javascript
const express    = require('express');
const router     = express.Router();
const controller = require('./quizzes.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

router.use(protect, restrictTo('student'));
```

**Key Decision:** All quiz routes require:
- JWT authentication (`protect`)
- Student role (`restrictTo('student')`)

Students only can start/submit quizzes (instructors manage quizzes elsewhere).

---

## 3. ROUTES

### `POST /:id/start`

**Endpoint:** `POST /api/quizzes/42/start`

**Purpose:** Start a quiz attempt

**Authentication:** Required (JWT + student role)

**Response:** Quiz details with questions and options

---

### `POST /:id/submit`

**Endpoint:** `POST /api/quizzes/42/submit`

**Purpose:** Submit quiz answers

**Authentication:** Required (JWT + student role)

**Request Body:**
```json
{
  "attempt_id": 123,
  "answers": [
    { "question_id": 1, "selected_option_id": 102 }
  ]
}
```

**Response:** Score summary

---

### `GET /attempts/:attemptId`

**Endpoint:** `GET /api/quizzes/attempts/123`

**Purpose:** Retrieve quiz result

**Authentication:** Required (JWT + student role)

**Response:** Detailed result with answer breakdown

---

## 4. SUMMARY

The routes file:
1. Applies `protect` middleware (JWT auth)
2. Applies `restrictTo('student')` (role restriction)
3. Maps 3 endpoints to controller handlers

All routes are protected and student-only.

---

# QUIZZES.SERVICE.JS

## 1. FILE OVERVIEW

**File Name:** `quizzes.service.js`  
**File Type:** Business Logic Service  
**Location:** `modules/quizzes/quizzes.service.js`  
**Purpose:** Implements quiz logic: start attempts, grade answers, calculate scores, retrieve results.

---

## 2. RESPONSIBILITY

- **Attempt Management** — Create and track quiz attempts
- **Question/Option Retrieval** — Fetch quiz content with optional shuffling
- **Answer Grading** — Check if selected option is correct
- **Score Calculation** — Calculate total marks, percentage, pass/fail
- **Result Retrieval** — Return detailed results with feedback

---

## 3. IMPORTS

```javascript
const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
```

---

## 4. FUNCTIONS

### `startQuiz(quizId, studentId)`

**Purpose:** Initialize a quiz attempt and return questions.

**Parameters:**
- `quizId` (number)
- `studentId` (number)

**Returns:**
```javascript
{
  attempt_id: 123,
  quiz_id: 42,
  title: "Python Basics Quiz",
  description: "...",
  duration_seconds: 1800,
  total_marks: 100,
  questions: [
    {
      id: 1,
      question: "What is Python?",
      type: "mcq",
      marks: 10,
      order_index: 1,
      options: [
        { id: 101, text: "A snake", order_index: 1 },
        { id: 102, text: "A programming language", order_index: 2 }
      ]
    }
  ]
}
```

**Logic:**

```javascript
// 1. Fetch quiz
const [[quiz]] = await db.query(
  `SELECT id, title, description, duration_seconds,
          total_marks, pass_percentage, shuffle_questions, shuffle_options
   FROM quizzes WHERE id = ? AND status = 'published'`,
  [quizId]
);
if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');

// 2. Create quiz attempt
const [result] = await db.query(
  'INSERT INTO quiz_attempts (quiz_id, student_id) VALUES (?, ?)',
  [quizId, studentId]
);
const attemptId = result.insertId;

// 3. Fetch questions (with optional shuffling)
let [questions] = await db.query(
  `SELECT id, question, type, marks, order_index
   FROM quiz_questions WHERE quiz_id = ?
   ORDER BY ${quiz.shuffle_questions ? 'RAND()' : 'order_index ASC'}`,
  [quizId]
);

// 4. For each question, fetch options (with optional shuffling)
for (const q of questions) {
  let [options] = await db.query(
    `SELECT id, text, order_index FROM quiz_options WHERE question_id = ?
     ORDER BY ${quiz.shuffle_options ? 'RAND()' : 'order_index ASC'}`,
    [q.id]
  );
  q.options = options;
}

return {
  attempt_id: attemptId,
  quiz_id: quiz.id,
  title: quiz.title,
  description: quiz.description,
  duration_seconds: quiz.duration_seconds,
  total_marks: quiz.total_marks,
  questions,
};
```

**Features:**
- Creates new attempt record (tracks start time via DB timestamp)
- Shuffles questions if `quiz.shuffle_questions = 1`
- Shuffles options if `quiz.shuffle_options = 1`
- Returns correct option answers hidden from student

---

### `submitQuiz(quizId, studentId, attemptId, answers)`

**Purpose:** Grade quiz answers and save results.

**Parameters:**
- `quizId` (number)
- `studentId` (number)
- `attemptId` (number)
- `answers` (array) — Student's answers

**Returns:**
```javascript
{
  attempt_id: 123,
  score: 80,
  total_marks: 100,
  total_questions: 10,
  percentage: 80,
  passed: true
}
```

**Logic:**

```javascript
// 1. Validate attempt belongs to student and hasn't been submitted
const [[attempt]] = await db.query(
  'SELECT id, submitted_at FROM quiz_attempts WHERE id = ? AND student_id = ? AND quiz_id = ?',
  [attemptId, studentId, quizId]
);
if (!attempt) throw new AppError('Attempt not found.', 404, 'NOT_FOUND');
if (attempt.submitted_at) throw new AppError('Quiz already submitted.', 409, 'ALREADY_SUBMITTED');

// 2. Get quiz metadata
const [[quiz]] = await db.query(
  'SELECT total_marks, pass_percentage FROM quizzes WHERE id = ?',
  [quizId]
);

// 3. Grade each answer
let totalScore = 0;
let totalQuestions = answers.length;

for (const answer of answers) {
  const { question_id, selected_option_id } = answer;

  // Get question marks
  const [[question]] = await db.query(
    'SELECT id, marks FROM quiz_questions WHERE id = ? AND quiz_id = ?',
    [question_id, quizId]
  );
  if (!question) continue;

  let isCorrect    = false;
  let marksAwarded = 0;

  // Check if selected option is correct
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

  // Save answer record
  await db.query(
    `INSERT INTO quiz_answers
       (attempt_id, question_id, selected_option_id, is_correct, marks_awarded)
     VALUES (?, ?, ?, ?, ?)`,
    [attemptId, question_id, selected_option_id || null, isCorrect ? 1 : 0, marksAwarded]
  );
}

// 4. Calculate percentage and pass/fail
const percentage = quiz.total_marks > 0
  ? Math.round((totalScore / quiz.total_marks) * 100)
  : 0;
const passed = percentage >= (quiz.pass_percentage || 60);

// 5. Update attempt with results
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
  attempt_id: attemptId,
  score: totalScore,
  total_marks: quiz.total_marks,
  total_questions: totalQuestions,
  percentage,
  passed,
};
```

**Grading Logic:**
- For each question:
  - Get marks for the question
  - Check if selected option is marked `is_correct`
  - If correct, award full marks for question
  - If wrong or unanswered, award 0
  - Save answer with correctness and marks awarded
- Calculate percentage: `(totalScore / total_marks) * 100`
- Pass/fail: `percentage >= quiz.pass_percentage` (default 60%)
- Record time taken: `NOW() - started_at`

**One Answer Per Question Assumption:**
- Answers array has one entry per question attempted
- Unanswered questions: student doesn't send answer in array (0 score)

---

### `getAttemptResult(attemptId)`

**Purpose:** Retrieve detailed quiz result with answer feedback.

**Parameters:**
- `attemptId` (number)

**Returns:**
```javascript
{
  id: 123,
  quiz_id: 42,
  student_id: 100,
  score: 80,
  total_marks: 100,
  total_questions: 10,
  percentage: 80,
  passed: 1,
  quiz_title: "Python Quiz",
  pass_percentage: 60,
  submitted_at: "2024-01-20T15:30:45Z",
  answers: [
    {
      question_id: 1,
      selected_option_id: 102,
      is_correct: 1,
      marks_awarded: 10,
      question: "What is Python?",
      max_marks: 10,
      selected_text: "A programming language",
      correct_text: "A programming language"
    }
  ]
}
```

**Logic:**

```javascript
// 1. Get attempt with quiz details
const [[attempt]] = await db.query(
  `SELECT qa.*, q.title AS quiz_title, q.pass_percentage
   FROM quiz_attempts qa
   JOIN quizzes q ON q.id = qa.quiz_id
   WHERE qa.id = ?`,
  [attemptId]
);
if (!attempt) throw new AppError('Result not found.', 404, 'NOT_FOUND');

// 2. Get detailed answers with question and option text
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
```

**Query Details:**
- Joins attempt with quiz metadata
- For each answer:
  - Shows selected option text
  - Shows correct option text (subquery)
  - Shows whether answer was correct
  - Shows marks awarded
- LEFT JOIN on quiz_options (handles unanswered questions)

---

## 5. DATABASE SCHEMA

| Table | Fields | Purpose |
|-------|--------|---------|
| `quizzes` | id, title, description, duration_seconds, total_marks, pass_percentage, shuffle_questions, shuffle_options, status | Quiz metadata |
| `quiz_questions` | id, quiz_id, question, type, marks, order_index | Questions |
| `quiz_options` | id, question_id, text, is_correct, order_index | Answer options |
| `quiz_attempts` | id, quiz_id, student_id, score, total_marks, total_questions, percentage, passed, time_taken, started_at, submitted_at | Attempt tracking |
| `quiz_answers` | id, attempt_id, question_id, selected_option_id, is_correct, marks_awarded | Student answers |

---

## 6. KEY FEATURES

### 1. Question Shuffling
```javascript
ORDER BY ${quiz.shuffle_questions ? 'RAND()' : 'order_index ASC'}
```

If enabled, questions appear in random order.

### 2. Option Shuffling
```javascript
ORDER BY ${quiz.shuffle_options ? 'RAND()' : 'order_index ASC'}
```

If enabled, answer choices appear in random order.

### 3. Timed Quizzes
```javascript
duration_seconds: 1800,  // 30 minutes
time_taken = TIMESTAMPDIFF(SECOND, started_at, NOW())
```

Frontend enforces time limit; backend records actual time taken.

### 4. Flexible Grading
```javascript
const passed = percentage >= (quiz.pass_percentage || 60);
```

Pass percentage configurable per quiz (default 60%).

### 5. Partial Credit
```javascript
if (option && option.is_correct) {
  marksAwarded = question.marks;  // Full marks only if correct
}
```

All-or-nothing grading (partial credit not supported in current schema).

---

## 7. ERROR SCENARIOS

| Scenario | Error Code | Status | Message |
|----------|-----------|--------|---------|
| Quiz not published | NOT_FOUND | 404 | Quiz not found |
| Attempt doesn't exist | NOT_FOUND | 404 | Attempt not found |
| Already submitted | ALREADY_SUBMITTED | 409 | Quiz already submitted |
| Result not found | NOT_FOUND | 404 | Result not found |

---

## 8. SUMMARY

The quizzes module provides a complete quiz system:

**startQuiz:**
- Creates attempt record
- Retrieves questions with shuffling
- Returns quiz content to student

**submitQuiz:**
- Validates attempt ownership
- Grades each answer
- Calculates score/percentage/pass
- Records time taken

**getAttemptResult:**
- Returns detailed result
- Shows question feedback
- Shows selected vs correct answers

The implementation supports:
- Question and option shuffling
- Time tracking
- Configurable pass percentage
- Detailed result feedback
- Prevention of double submission

---

## 9. COMPLETE FLOW EXAMPLE

```
1. Student clicks "Start Quiz"
   POST /api/quizzes/42/start
   
2. Controller calls service.startQuiz(quizId=42, studentId=100)
   
3. Service:
   - Creates attempt record (id=123)
   - Fetches questions (optionally shuffled)
   - Fetches options for each question (optionally shuffled)
   - Returns attempt_id, quiz title, questions array
   
4. Frontend displays quiz (with timer if duration set)
   
5. Student answers questions and clicks "Submit"
   POST /api/quizzes/42/submit
   {
     "attempt_id": 123,
     "answers": [
       { "question_id": 1, "selected_option_id": 102 },
       { "question_id": 2, "selected_option_id": 205 },
       ...
     ]
   }
   
6. Controller calls service.submitQuiz(quizId=42, studentId=100, attemptId=123, answers)
   
7. Service:
   - Validates attempt belongs to student
   - For each answer: checks if correct, awards marks
   - Saves answer records
   - Calculates total score, percentage, pass/fail
   - Updates attempt with results
   - Returns score summary
   
8. Frontend shows score: "You scored 80/100 (80%)"
   
9. Student clicks "View Detailed Result"
   GET /api/quizzes/attempts/123
   
10. Controller calls service.getAttemptResult(attemptId=123)
    
11. Service returns:
    - Attempt metadata (score, percentage, passed, timing)
    - For each question:
      - What student selected
      - What was correct
      - Marks awarded
      - Whether correct
    
12. Frontend displays detailed feedback to student
```

---
