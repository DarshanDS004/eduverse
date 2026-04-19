# `assessments.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `assessments.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/assessments.html` |
| **Page Title** | Assessments — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page allows instructors to **create, view, and manage assessments** — specifically quizzes and assignments — for their courses. It also provides a submissions grading interface where instructors can review and score student assignment submissions.

---

## 2. Responsibility

- Fetch and display all quizzes created by the instructor (`GET /instructor/quizzes`)
- Fetch and display all assignments created by the instructor (`GET /instructor/assignments`)
- Fetch and display all **pending** student submissions awaiting grading (`GET /instructor/submissions?status=pending`)
- Allow instructors to create new quizzes or assignments via a modal form
- Allow instructors to grade pending submissions with a score and feedback
- Allow instructors to delete quizzes or assignments
- Enforce instructor-only access

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icon rendering |
| `Chart.js 4.4.1` | Loaded but **not actively used** on this page |

### Local CSS

| File | Purpose |
|---|---|
| `variables.css` | Design tokens (colors, spacing, radii) |
| `reset.css` | CSS normalization |
| `global.css` | Base styles |
| `components.css` | Reusable component styles |
| `layout.css` | App shell / sidebar / navbar layout |

### Local JavaScript

| File | Purpose |
|---|---|
| `utils.js` | Shared utilities |
| `store.js` | Client-side state store |
| `api.js` | HTTP API client (`Api.get`, `Api.post`, `Api.delete`) |
| `auth.js` | Auth helpers |
| `init.js` | App shell initialization |

---

## 4. Core Logic Breakdown

### Step 1 — Inline Theme Bootstrap
Synchronous theme check before DOM render:
```js
try {
  if (localStorage.getItem('ev_theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
  }
} catch(e) {}
```

### Step 2 — Inline Auth Guard (IIFE)
Checks `ev_token` and `ev_user` in localStorage. If missing or user role is not `'instructor'`, redirects immediately.

### Step 3 — DOMContentLoaded Setup
- Feather icons initialized
- User name and avatar rendered from localStorage
- Sidebar open/collapse listeners wired
- Theme toggle wired
- Navbar user dropdown wired
- Logout button wired
- Helper functions (`_esc`, `showToast`, `openModal`, `closeModal`) defined and exposed on `window`

### Step 4 — Tab System
Three tabs are defined: **Quizzes**, **Assignments**, **Submissions**.

```js
var tabs = document.querySelectorAll('.page-tab');
tabs.forEach(function(t) {
  t.addEventListener('click', function() {
    // Remove active from all tabs and panels
    // Add active to clicked tab + matching panel (#tab-{data-tab})
  });
});
```

### Step 5 — `loadAssessments()` — Parallel Data Fetch
Uses `Promise.all()` to fetch three resources simultaneously:
```js
var [qRes, aRes, sRes] = await Promise.all([
  Api.get('/instructor/quizzes'),
  Api.get('/instructor/assignments'),
  Api.get('/instructor/submissions?status=pending')
]);
```
Then fetches courses to populate the course selector in the Create modal:
```js
var cRes = await Api.get('/courses?instructor_id=' + user.id);
```

### Step 6 — Rendering Functions
Three separate render functions populate table `<tbody>` elements with dynamically built HTML strings.

---

## 5. Functions / Methods

### `loadAssessments()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetches and renders all assessment data |
| **Parameters** | None |
| **Returns** | `Promise<void>` |
| **API Calls** | `GET /instructor/quizzes`, `GET /instructor/assignments`, `GET /instructor/submissions?status=pending`, `GET /courses?instructor_id={id}` |

---

### `renderQuizzes(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render quiz data as table rows in `#quizzes-tbody` |
| **Parameters** | `list` — array of quiz objects |
| **Returns** | `void` |
| **Empty State** | Shows emoji + "No quizzes yet" message when list is empty |

**Each row displays:**
- Title
- Course title (or `—`)
- Question count (e.g., `5 Qs`)
- Time limit (e.g., `60 min` or `Unlimited`)
- Attempt count
- Average score (formatted to 1 decimal + `%`)
- Delete button → calls `deleteItem('quiz', id)`

---

### `renderAssignments(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render assignment data as table rows in `#assignments-tbody` |
| **Parameters** | `list` — array of assignment objects |
| **Returns** | `void` |

**Each row displays:**
- Title
- Course title
- Deadline date (formatted via `toLocaleDateString('en-IN', ...)`) — colored red if past deadline
- Max score (default 100)
- Submission count
- Delete button → calls `deleteItem('assignment', id)`

**Edge Case**: `isLate` is computed by comparing `new Date(a.deadline) < new Date()`, and the deadline text is rendered in danger color if overdue.

---

### `renderSubmissions(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render pending student submissions in `#submissions-tbody` |
| **Parameters** | `list` — array of submission objects |
| **Returns** | `void` |

**Each row displays:**
- Student name + email
- Assignment title
- Submission date
- Status badge (always "Pending" for this view)
- Grade button → calls `openGradeModal(submission_object)`

---

### `openGradeModal(sub)` — `window` function

| Property | Detail |
|---|---|
| **Purpose** | Populates and opens the grade modal for a selected submission |
| **Parameters** | `sub` — full submission object (passed inline via `JSON.stringify` + `&quot;` escaping in HTML) |
| **Returns** | `void` |
| **Side Effect** | Sets `selectedSubmission` variable; populates `#grade-submission-info` |

---

### Grade Submit Handler (`#submit-grade-btn` click)

| Property | Detail |
|---|---|
| **Purpose** | Submit a grade and optional feedback for the selected submission |
| **API Call** | `POST /instructor/submissions/{id}/grade` with `{ score, feedback }` |
| **Validation** | Score field must not be empty |
| **Success** | Closes modal, shows success toast, reloads assessments |
| **Failure** | Shows error toast with error message |

---

### Create Assessment Handler (`#save-assessment-btn` click)

| Property | Detail |
|---|---|
| **Purpose** | Create a new quiz or assignment |
| **Parameters** | Reads from modal form fields: `atitle`, `atype`, `acourse`, `atime`, `ascore`, `adeadline`, `ainstructions` |
| **API Call** | `POST /instructor/quizzes` or `POST /instructor/assignments` depending on type |
| **Validation** | Title is required |
| **Success** | Closes modal, shows success toast, reloads data |

---

### `deleteItem(type, id)` — `window.deleteItem` async function

| Property | Detail |
|---|---|
| **Purpose** | Delete a quiz or assignment after confirmation |
| **Parameters** | `type` (`'quiz'` or `'assignment'`), `id` (number) |
| **API Call** | `DELETE /instructor/quizzes/{id}` or `DELETE /instructor/assignments/{id}` |
| **Guard** | `confirm()` dialog before deletion |
| **Success** | Shows success toast, reloads data |

---

## 6. API Role

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/instructor/quizzes` | List all quizzes for instructor | Required |
| `GET` | `/instructor/assignments` | List all assignments for instructor | Required |
| `GET` | `/instructor/submissions?status=pending` | List ungraded student submissions | Required |
| `GET` | `/courses?instructor_id={id}` | Get instructor's courses for dropdown | Required |
| `POST` | `/instructor/quizzes` | Create new quiz | Required |
| `POST` | `/instructor/assignments` | Create new assignment | Required |
| `POST` | `/instructor/submissions/{id}/grade` | Submit grade for a submission | Required |
| `DELETE` | `/instructor/quizzes/{id}` | Delete quiz | Required |
| `DELETE` | `/instructor/assignments/{id}` | Delete assignment | Required |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .page-header          ← Title + "New Assessment" button
        ├── .page-tabs            ← Quizzes | Assignments | Submissions
        ├── #tab-quizzes          ← Table: all quizzes
        ├── #tab-assignments      ← Table: all assignments
        ├── #tab-submissions      ← Table: pending submissions to grade
        ├── #add-assessment-modal ← Create new quiz or assignment
        └── #grade-modal          ← Grade a submission
```

### Modals

#### Add Assessment Modal (`#add-assessment-modal`)
Fields: Type (quiz/assignment), Title*, Course (dropdown), Time Limit, Max Score, Deadline, Instructions

#### Grade Submission Modal (`#grade-modal`)
Fields: Submission info display, Score*, Feedback (optional textarea)

---

## 8. Data Flow

```
Page Load
  → Auth guard check (localStorage)
  → DOMContentLoaded
  → loadAssessments()
      → Promise.all([quizzes, assignments, pending submissions])
      → renderQuizzes() → injects HTML into #quizzes-tbody
      → renderAssignments() → injects HTML into #assignments-tbody
      → renderSubmissions() → injects HTML into #submissions-tbody
      → fetch courses → populate #acourse dropdown

User clicks "New Assessment"
  → openModal('add-assessment-modal')
  → user fills form + clicks "Create"
  → POST /instructor/quizzes or /instructor/assignments
  → closeModal, showToast, loadAssessments()

User clicks "Grade" on a submission
  → openGradeModal(sub) — populates modal
  → user enters score + feedback + clicks "Submit Grade"
  → POST /instructor/submissions/{id}/grade
  → closeModal, showToast, loadAssessments()

User clicks "Delete" on quiz/assignment
  → confirm() dialog
  → DELETE /instructor/quizzes/{id} or /instructor/assignments/{id}
  → showToast, loadAssessments()
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | All API calls via `Api.get`, `Api.post`, `Api.delete` |
| `utils.js` | HTML escaping and utilities |
| `auth.js` | Auth helpers |
| `store.js` | State store |
| `init.js` | App shell setup |
| `dashboard.html` | Sidebar navigation target |
| `courses.html` | Sidebar navigation target |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` inaccessible | `try/catch` around theme and auth guard |
| `loadAssessments()` API failure | `catch(e)` → `console.error(e)` — no user toast shown |
| Grade submit fails | `catch(err)` → `showToast('error', ...)` with error message |
| Create assessment fails | `catch(err)` → `showToast('error', ...)` with error message |
| Delete fails | `catch(err)` → `showToast('error', ...)` with error message |
| Empty score field | Validates before API call → `showToast('error', 'Score is required.')` |
| Missing title on create | Validates before API call → `showToast('error', 'Title is required.')` |

---

## 11. Edge Cases / Notes

- **`selectedSubmission` variable**: A module-level variable that holds the currently selected submission object for grading. It is set in `openGradeModal` and consumed in the grade submit handler.
- **Deadline color coding**: Deadlines in the past are displayed in `var(--color-danger)` to visually signal overdue assignments.
- **Chart.js loaded but unused**: `Chart.js` is included via CDN but no charts are rendered on this page — this appears to be a shared script tag across all portal pages.
- **Course dropdown in modal**: Populated dynamically from `GET /courses?instructor_id=` — if no courses exist, a disabled "No courses found" option is shown.
- **`JSON.stringify` in inline `onclick`**: The Grade button passes the full submission object as `JSON.stringify(s).replace(/"/g, '&quot;')` — this is functional but has XSS risk for data with special characters. It relies on `_esc` not being applied to this specific path.
- **Tab system is client-side only**: Tab switching does not re-fetch data — all three datasets are loaded once on page load.

---

## 12. Summary

`assessments.html` is the **Assessments Management page** of the EduVerse Instructor Portal. It presents a three-tab interface for managing quizzes, assignments, and pending student submissions. Instructors can create new quizzes/assignments via a modal form, delete existing ones, and grade student submissions with scores and feedback. All data is fetched in parallel on page load using `Promise.all()`, and the page enforces instructor-only access via a client-side JWT + role check.
