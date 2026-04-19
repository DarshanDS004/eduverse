# `assignments.routes.js` — Assignments Standalone Module (Student-Facing)

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `assignments.routes.js` |
| **Location** | `modules/assignments/assignments.routes.js` |
| **File Type** | Route Definition (Inline Handler Pattern) |
| **Project** | EduVerse |

**Purpose:** This file defines student-facing and submission-viewing endpoints for the assignments module. Unlike typical route files that delegate to a separate controller, this file implements route handler logic **inline** using anonymous `async` functions directly on the router. It covers fetching course assignments (student), viewing a single assignment (any authenticated user), and viewing all submissions for an assignment (instructor/institute).

> **Note (from source comment):** Instructor assignment CRUD (create, update, delete, grade) is handled separately in `instructor.routes.js`. This module only handles the read/view side and submission listing.

---

## 2. Responsibility

- Provide students with a list of assignments for a specific enrolled course.
- Allow any authenticated user to fetch details of a single assignment.
- Allow instructors and institute users to view all student submissions for an assignment.
- Apply global JWT authentication to all routes via `router.use(protect)`.
- Perform all database queries inline (no separate service or controller file).

**Why this file exists:** The assignments module is lightweight enough that a dedicated service/controller layer was not created. Logic is handled directly in the route handlers, making this a self-contained mini-module.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework, provides `Router()` |
| `db` | `../../config/db` | MySQL connection pool — used directly in route handlers |
| `protect` | `../auth/auth.middleware` | JWT verification middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control |
| `sendSuccess` | `../../shared/errorHandler` | Standardized success response helper |
| `sendError` | `../../shared/errorHandler` | Standardized error response helper |

---

## 4. Core Logic Breakdown

### Global Middleware
```js
router.use(protect);
```
Applied to the entire router — **every route** in this file requires a valid JWT. There are no public routes in this module.

### Inline Handler Pattern
Each route directly contains the full async handler function:
```js
router.get('/path', restrictTo('role'), async (req, res, next) => {
  try {
    const [rows] = await db.query(...);
    return sendSuccess(res, 200, 'Message', rows);
  } catch (e) { next(e); }
});
```
Errors are always forwarded to Express's global error handler via `next(e)`.

---

## 5. Route Handlers (Functions)

### `GET /course/:courseId` — Get Assignments for a Course

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('student')` |
| **Parameters** | `req.params.courseId` — course ID, `req.user.id` — from JWT |
| **Response** | 200 with array of assignment objects |

**SQL Logic:**
```sql
SELECT a.id, a.title, a.description, a.deadline, a.max_marks,
       s.status, s.score, s.feedback, s.submitted_at
FROM assignments a
JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
WHERE a.course_id = ? AND a.status = 'published'
ORDER BY a.deadline ASC
```

Key behaviors:
- **Enrollment guard:** The `JOIN enrollments` ensures only students enrolled in the course can see its assignments. If the student isn't enrolled, the query returns an empty array.
- **LEFT JOIN on submissions:** Includes submission status, score, and feedback if the student has submitted. Returns `null` for those fields if not yet submitted.
- **Only published assignments:** The `a.status = 'published'` filter hides draft or archived assignments.
- **Ordered by deadline ascending:** Upcoming deadlines appear first.

---

### `GET /:id` — Get Single Assignment

| Property | Details |
|---|---|
| **Auth** | `protect` only (any authenticated role) |
| **Parameters** | `req.params.id` — assignment ID |
| **Response** | 200 with assignment detail object, or `404 NOT_FOUND` |

**SQL Logic:**
```sql
SELECT id, title, description, deadline, max_marks, allowed_types, rubric
FROM assignments WHERE id = ?
```

Key behaviors:
- Returns `404 NOT_FOUND` inline if no assignment is found with that ID.
- **No enrollment check** — any authenticated user (student, instructor, institute) can access a single assignment by ID. Enrollment/access control is not enforced here.
- Includes `allowed_types` (e.g., accepted file extensions) and `rubric` fields — richer detail than the course-list endpoint.

---

### `GET /:id/submissions` — Get All Submissions for an Assignment

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('instructor', 'institute')` |
| **Parameters** | `req.params.id` — assignment ID |
| **Response** | 200 with array of submission objects including student info |

**SQL Logic:**
```sql
SELECT s.id, s.text, s.file_url, s.file_name, s.status,
       s.score, s.feedback, s.submitted_at, s.graded_at,
       up.full_name AS student_name, u.email AS student_email
FROM assignment_submissions s
JOIN users u ON u.id = s.student_id
JOIN user_profiles up ON up.user_id = s.student_id
WHERE s.assignment_id = ?
ORDER BY s.submitted_at DESC
```

Key behaviors:
- Returns all submissions (submitted, graded, late) for instructors/institute users.
- Joins `users` and `user_profiles` to include student name and email alongside submission data.
- **No ownership check** — any instructor or institute user can view submissions for any assignment ID. There is no verification that the instructor actually created that assignment.
- Ordered by most recently submitted first.

---

## 6. API Role

When mounted at `/api/assignments` (assumed):

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/assignments/course/:courseId` | Student only | List assignments for an enrolled course |
| GET | `/api/assignments/:id` | Any authenticated | Single assignment details |
| GET | `/api/assignments/:id/submissions` | Instructor / Institute | All student submissions for an assignment |

---

## 8. Data Flow

```
HTTP Request (with Bearer token)
        │
        ▼
protect middleware (JWT verification → req.user)
        │
        ▼
[restrictTo() if applicable]
        │
        ▼
Inline async handler
        │
        ▼
db.query(SQL, params)
        │
        ▼
sendSuccess(res, 200, message, rows)
        │
        ▼
HTTP JSON Response
```

---

## 9. Connections

### Files That Call This File
- Main app entry point (e.g., `app.js`) — mounts this router at `/api/assignments`.

### Files This File Depends On
- `../../config/db` — Direct DB access (no service layer)
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

### Related Files (Not Imported)
- `instructor.routes.js` — Handles assignment CRUD (create, update, delete, grade)
- `student.routes.js` — Has `submitAssignment` endpoint (separate from this module)

---

## 10. Middleware / Auth

| Route | Middleware Stack |
|---|---|
| All routes | `protect` (global via `router.use`) |
| `GET /course/:courseId` | `protect` → `restrictTo('student')` |
| `GET /:id` | `protect` only |
| `GET /:id/submissions` | `protect` → `restrictTo('instructor', 'institute')` |

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Missing/invalid JWT | `protect` returns `401` JSON |
| Wrong role | `restrictTo` returns `403` JSON |
| Assignment not found (`GET /:id`) | Inline `sendError(res, 404, ...)` |
| DB query failure | `catch(e) → next(e)` → global error handler |

---

## 12. Example Usage

### Student fetches course assignments
```http
GET /api/assignments/course/3
Authorization: Bearer eyJhbGci...  ← student token

→ 200:
[
  {
    "id": 7,
    "title": "Chapter 1 Summary",
    "description": "Write a 500-word summary...",
    "deadline": "2026-04-25T23:59:00.000Z",
    "max_marks": 100,
    "status": "pending",
    "score": null,
    "feedback": null,
    "submitted_at": null
  }
]
```

### Instructor views submissions
```http
GET /api/assignments/7/submissions
Authorization: Bearer eyJhbGci...  ← instructor token

→ 200:
[
  {
    "id": 42,
    "text": "My summary...",
    "file_url": "/uploads/assignments/assign-123.pdf",
    "status": "submitted",
    "score": null,
    "student_name": "Jane Doe",
    "student_email": "jane@example.com"
  }
]
```

---

## 13. Edge Cases / Notes

- **No enrollment check on `GET /:id`:** Any authenticated user can fetch any assignment's details by ID, even if they're not enrolled in the course. This could be a security concern if assignment content is sensitive.
- **No instructor ownership check on `GET /:id/submissions`:** Any instructor or institute user can view submissions for any assignment, not just those they created. This might be intentional for institute-level oversight.
- **`GET /course/:courseId` enrollment is enforced via JOIN:** If the student isn't enrolled, the JOIN returns no rows — the response is an empty array, not a 403. This is a silent access control approach.
- **No service/controller layer:** All business logic is inline. Adding complex logic (e.g., pagination, filtering) would make these handlers large. This is suitable for simple read-only operations.
- **`allowed_types` and `rubric` fields** are only returned on the single-assignment endpoint, not the course-list endpoint — the list view is intentionally slimmer.

---

## 14. Summary

`assignments.routes.js` is a lightweight, self-contained route module for the EduVerse assignments system. It handles three read-focused endpoints: students viewing their course assignments (with enrollment-gated SQL), any authenticated user fetching a single assignment's details, and instructors/institutes viewing all submissions for an assignment. All database logic is inline (no separate service), and global JWT protection is applied via `router.use(protect)`.
