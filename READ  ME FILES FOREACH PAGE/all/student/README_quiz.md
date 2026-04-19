# `quiz.html` — Quiz Engine

## Overview

`quiz.html` is the **timed quiz engine** of the EduVerse Student Portal. It presents multiple-choice questions one at a time (with back/next navigation), runs a live countdown timer, tracks the student's selected answers client-side, and submits the complete attempt to the backend on completion or timer expiry. A results screen is shown after submission with score, emoji feedback, and navigation links.

---

## File Location

```
pages/student/quiz.html
```

---

## URL Parameters

| Parameter | Required | Description |
|---|---|---|
| `quiz` | ✅ Yes | The quiz ID to load |

**Example URL:**
```
pages/student/quiz.html?quiz=7
```

Read via `Utils.getParam('quiz')`.

---

## Authentication & Access Control

Standard synchronous student guard before render.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Google Fonts — Inter | latest | UI typography |

> Feather Icons is **not** loaded on this page — it is intentionally excluded to keep the quiz page lightweight and focused.

### Internal JS

```html
<script>window.EV_BASE="../../";</script>
<script src="../../js/utils.js"></script>
<script src="../../js/sidebar.js"></script>
<script src="../../js/store.js"></script>
<script src="../../js/api.js"></script>
<script src="../../js/auth.js"></script>
<script src="../../js/router.js"></script>
<script src="../../js/init.js"></script>
<!-- inline page script -->
```

---

## Layout Structure

```
body
├── .quiz-topbar               ← brand + timer + exit button
├── .quiz-progress-bar-wrap    ← thin progress bar (0–100%)
└── .quiz-body (#quiz-body)    ← dynamic content area
    ├── [skeleton] while loading
    ├── [question view] during quiz
    └── [result view] after submission
```

This page does **not** use the standard `.app-shell` / `.app-sidebar` layout — it is a full-page focused quiz interface.

---

## Quiz Start Flow

```
DOMContentLoaded
    ↓
Read ?quiz from URL
If no quizId → show "No quiz ID provided." → stop
    ↓
Api.quizzes.start(quizId)  →  POST /quizzes/:id/start
    ↓
Receive:
  questions[]       ← array of question objects
  duration_seconds  ← total time allowed
  attempt_id        ← unique attempt identifier for submission
    ↓
startTimer()        ← begins countdown
showQuestion(0)     ← render first question
```

---

## API Calls

| Call | Method | Endpoint | Description |
|---|---|---|---|
| `Api.quizzes.start(quizId)` | `POST` | `/quizzes/:id/start` | Start a quiz attempt, receive questions + timer |
| `Api.quizzes.submit(quizId, payload)` | `POST` | `/quizzes/:id/submit` | Submit all answers |

### Start Response Shape

```json
{
  "data": {
    "attempt_id": "att_abc123",
    "duration_seconds": 600,
    "questions": [
      {
        "id": "q1",
        "question": "What is the powerhouse of the cell?",
        "options": [
          { "id": "o1", "text": "Nucleus" },
          { "id": "o2", "text": "Mitochondria" },
          { "id": "o3", "text": "Ribosome" },
          { "id": "o4", "text": "Golgi Apparatus" }
        ]
      }
    ]
  }
}
```

> If `duration_seconds` is not provided, it falls back to `time_limit_seconds`, then defaults to `questions.length * 60` (1 minute per question).

### Submit Payload

```json
{
  "attempt_id": "att_abc123",
  "answers": [
    { "question_id": "q1", "selected_option_id": "o2" },
    { "question_id": "q2", "selected_option_id": "o3" }
  ]
}
```

### Submit Response Shape

```json
{
  "data": {
    "score": 8,
    "total_questions": 10
  }
}
```

---

## Countdown Timer

### Display

```html
<div class="quiz-timer" id="quiz-timer">
  <span id="timer-val">10:00</span>
</div>
```

Formatted as `MM:SS` using `String(m).padStart(2,'0')`.

### Urgency State

When `timeLeft <= 60` seconds, the timer turns red:
```js
document.getElementById('quiz-timer').classList.toggle('urgent', timeLeft <= 60);
```

`.quiz-timer.urgent { color: var(--color-danger); }`

### Auto-Submit on Expiry

```js
timerInterval = setInterval(function() {
  timeLeft--;
  updateTimer();
  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    submitQuiz();       // ← auto-submits with whatever answers exist
  }
}, 1000);
```

---

## Question Rendering (`showQuestion(idx)`)

```js
function showQuestion(idx) {
  currentIndex = idx;
  var q = questions[idx];
  var pct = (idx / questions.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';

  // Render question + options + nav into #quiz-body
}
```

### Question View Structure

```
.quiz-q-num      ← "Question 3 of 10"
.quiz-question   ← question text (large, bold)
.quiz-options    ← list of option items
.quiz-nav        ← ← Previous  |  Next → / Submit Quiz
```

### Option Letters

Options are labelled A, B, C, D, E using:
```js
var letters = ['A', 'B', 'C', 'D', 'E'];
```

### Option States

| CSS Class | Trigger | Visual |
|---|---|---|
| `.quiz-option` | Default | White background, grey border |
| `.quiz-option.selected` | Answer chosen | Blue border + light blue bg + blue letter circle |
| `.quiz-option.correct` | Post-submit reveal | Green border + green bg |
| `.quiz-option.wrong` | Post-submit reveal | Red border + red bg |

> Note: `.correct` and `.wrong` states are defined in CSS but not applied by the current JS (post-submission reveal is not implemented — the result screen is shown instead).

---

## Answer Tracking

Answers are stored in a plain object keyed by question ID:

```js
var answers = {};    // { "q1": "o2", "q3": "o4", ... }

window.selectOpt = function(qId, optId) {
  answers[qId] = optId;
  showQuestion(currentIndex);    // re-render to show .selected state
};
```

`selectOpt` is on `window` to allow inline `onclick` in dynamically generated HTML.

---

## Navigation

| Button | Condition | Action |
|---|---|---|
| ← Previous | `idx > 0` | `showQuestion(idx - 1)` |
| Next → | Not last question | `showQuestion(idx + 1)` |
| Submit Quiz | Last question | `submitQuiz()` |

Previous button is `visibility: hidden` (not `display: none`) on the first question to preserve layout.

---

## Progress Bar

A thin bar at the top of the viewport tracks question progress:

```js
var pct = (idx / questions.length) * 100;
document.getElementById('progress-fill').style.width = pct + '%';
```

At result time: `progress-fill` is set to `100%`.

---

## Submission Flow (`submitQuiz`)

```
User clicks "Submit Quiz" OR timer expires
    ↓
clearInterval(timerInterval)
    ↓
Show skeleton in #quiz-body
    ↓
Build payload:
  {
    attempt_id,
    answers: Object.keys(answers).map(qId => ({
      question_id: qId,
      selected_option_id: answers[qId]
    }))
  }
    ↓
Api.quizzes.submit(quizId, payload)  →  POST /quizzes/:id/submit
    ↓
Receive { score, total_questions }
    ↓
showResult(result)
```

---

## Result Screen (`showResult`)

```js
function showResult(result) {
  var score = result.score || 0;
  var total = result.total_questions || questions.length;
  var pct   = total ? Math.round((score / total) * 100) : 0;

  var emoji = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📖';
  var color = pct >= 80 ? 'var(--color-success)'
            : pct >= 50 ? 'var(--color-warning)'
            :             'var(--color-danger)';

  var label = pct >= 80 ? 'Excellent!' : pct >= 50 ? 'Good Job!' : 'Keep Practicing';
  // Renders result-box with emoji, percentage, label, score fraction, action buttons
}
```

### Result Screen Elements

| Element | Content |
|---|---|
| Emoji | 🎉 / 👍 / 📖 based on score |
| Percentage | Large coloured number (green/amber/red) |
| Label | "Excellent!" / "Good Job!" / "Keep Practicing" |
| Fraction | "You scored X out of Y questions correctly." |
| Buttons | "Back to Courses" → `courses.html` | "View Performance" → `performance.html` |

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.quiz-topbar` | Fixed top bar |
| `.quiz-brand` | EduVerse branding text |
| `.quiz-timer` | Timer display |
| `.quiz-timer.urgent` | Red timer state (≤ 60s) |
| `.quiz-progress-bar-wrap` | 4px top progress bar container |
| `.quiz-progress-bar-fill` | Animated fill element |
| `.quiz-body` | Main dynamic content area |
| `.quiz-q-num` | Question counter label |
| `.quiz-question` | Question text (large, bold) |
| `.quiz-options` | Flex column of options |
| `.quiz-option` | Individual option row |
| `.quiz-option.selected` | Chosen answer state |
| `.quiz-option-letter` | Option letter circle (A/B/C/D) |
| `.quiz-option-text` | Option answer text |
| `.quiz-nav` | Previous + Next/Submit button row |
| `.result-box` | Centred result display |
| `.result-score` | Large percentage number |
| `.result-label` | Score label text |
| `.result-sub` | Fraction description |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No quiz ID in URL | Show "No quiz ID provided." message |
| `Api.quizzes.start()` fails | Show error message from `err.message` |
| `Api.quizzes.submit()` fails | Show "Submission failed." in quiz body |

---

## Notes for Developers

- Unanswered questions are omitted from the `answers` payload (only answered questions appear in `Object.keys(answers)`). The backend should handle partial submissions gracefully.
- The timer uses `setInterval` with 1-second ticks. For high accuracy in production, use `Date.now()` delta instead of decrementing a counter, to compensate for timer drift.
- The Exit button changes its text to "Back to Courses" after quiz submission, so the student has a clear exit path from the result screen.
- `selectOpt` re-renders the entire question on every answer selection (calling `showQuestion(currentIndex)`). This is simple but inefficient — for large option lists, toggle classes directly on option elements instead.
- Correct/wrong answer highlighting classes (`.correct`, `.wrong`) are present in CSS but not applied post-submission. Implement a review mode that shows correct answers by comparing the submission result.
