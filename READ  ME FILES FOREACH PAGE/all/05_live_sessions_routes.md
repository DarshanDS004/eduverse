# `live-sessions_routes.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/live-sessions/`  
> **File path:** `modules/live-sessions/live-sessions.routes.js`  
> **File type:** Route Handler (Express Router — inline controller style)

---

## 1. FILE OVERVIEW

**File name:** `live-sessions_routes.js`  
**File type:** Route / Inline Controller  
**Purpose:** Provides the **student-facing** HTTP API for live session management in EduVerse. Students can view upcoming live sessions for their enrolled courses, access recordings of past sessions, and retrieve details for a specific session.

---

## 2. RESPONSIBILITY

This file covers the read-only student perspective of live sessions. It:

- Lists upcoming scheduled sessions for the authenticated student (filtered by their enrollments).
- Lists past sessions that have recordings available for the student.
- Retrieves full detail for any session by ID.

**What it does NOT do:** Instructor-side CRUD (creating, updating, cancelling sessions) is handled in a separate `instructor.routes.js` file referenced in the module header comment.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework |
| `router` | `express.Router()` | Scoped router instance |
| `db` | `../../config/db` | MySQL connection pool for direct queries |
| `protect` | `../auth/auth.middleware` | JWT authentication middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control middleware |
| `sendSuccess` | `../../shared/errorHandler` | Standardized success response helper |
| `sendError` | `../../shared/errorHandler` | Standardized error response helper |

---

## 4. CORE LOGIC BREAKDOWN

### Global Middleware
```js
router.use(protect);
```
All routes require authentication. `protect` populates `req.user` with `{ id, role, ... }` from the decoded JWT.

### Inline Pattern
Like `discussions_routes.js`, this file does not use a separate controller or service. All SQL queries are written directly inside route callbacks.

---

## 5. FUNCTIONS / METHODS (Route Handlers)

### `GET /upcoming`
**Purpose:** Return upcoming live sessions for the authenticated student across all enrolled courses.  
**Auth:** `student` role only (`restrictTo('student')`).  
**Logic:**
- Joins `live_sessions` with `enrollments` on `course_id` — only sessions for courses the student is enrolled in.
- Filters: `scheduled_at >= NOW()` (future only) AND `status = 'scheduled'` (not ended/cancelled).
- Ordered by `scheduled_at ASC` (soonest first).
- Limited to 10 results.
- Returns: session ID, title, description, scheduled time, duration, meeting link, platform, status, course title, and instructor name.

**Response:**
```json
[
  {
    "id": 5,
    "title": "Introduction to Neural Networks",
    "scheduled_at": "2025-09-01T10:00:00Z",
    "duration_minutes": 90,
    "meeting_link": "https://meet.google.com/abc-xyz",
    "platform": "Google Meet",
    "status": "scheduled",
    "course_title": "AI Fundamentals",
    "instructor_name": "Dr. Priya"
  }
]
```

---

### `GET /recordings/my`
**Purpose:** Return past sessions with available recordings for the authenticated student.  
**Auth:** `student` role only.  
**Logic:**
- Same enrollment join as `/upcoming` — only recordings from enrolled courses are visible.
- Filters: `status = 'ended'` AND `recording_url IS NOT NULL`.
- Ordered by `scheduled_at DESC` (most recent first).
- Returns: session ID, title, scheduled date, recording URL, course title, instructor name.

**Response:**
```json
[
  {
    "id": 3,
    "title": "Week 2: Backpropagation",
    "scheduled_at": "2025-08-15T10:00:00Z",
    "recording_url": "https://...",
    "course_title": "Deep Learning",
    "instructor_name": "Prof. Ramesh"
  }
]
```

---

### `GET /:id`
**Purpose:** Retrieve full detail for a specific live session.  
**Auth:** Any authenticated user (no `restrictTo` restriction).  
**Parameters:** `id` (route param — session ID)  
**Logic:**
- `LEFT JOIN` on `courses` (session may not be tied to a course in all cases).
- `JOIN` on `user_profiles` for instructor name.
- Returns `404 NOT_FOUND` if the session ID does not exist.
- Returns all columns from `live_sessions` plus `course_title` and `instructor_name`.

**Edge Case:** No enrollment check is performed on this endpoint. Any authenticated user (student, instructor, institute) can retrieve session details by ID if they know it.

---

## 6. API ROLE

**Base path (assumed):** `/api/v1/live-sessions`

| Method | Path | Auth Role | Description |
|---|---|---|---|
| GET | `/upcoming` | student | List upcoming sessions for enrolled courses |
| GET | `/recordings/my` | student | List past sessions with recordings |
| GET | `/:id` | Any authenticated | Get session detail by ID |

---

## 7. DATA FLOW

```
HTTP Request
    ↓
protect (JWT → req.user)
    ↓
[optional] restrictTo('student')
    ↓
Route handler → db.query (parameterized SQL)
    ↓
sendSuccess / sendError / next(err)
    ↓
Client Response
```

---

## 8. CONNECTIONS

**Files that use this file:**
- Main `app.js` mounts this router (e.g., `app.use('/api/v1/live-sessions', liveSessionsRouter)`).

**Files this file depends on:**
- `../../config/db` — Database access
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `../../shared/errorHandler` — Response utilities

**Related files (not imported here):**
- `instructor.routes.js` — Handles the instructor-side CRUD for sessions (create, update, cancel, upload recording).

**Tables accessed:** `live_sessions`, `enrollments`, `courses`, `user_profiles`

---

## 9. MIDDLEWARE / AUTH

| Middleware | Scope | Behavior |
|---|---|---|
| `protect` | All routes | JWT required; populates `req.user` |
| `restrictTo('student')` | `GET /upcoming`, `GET /recordings/my` | Only students can call these; other roles get 403 |

The detail endpoint `GET /:id` has no role restriction — it is accessible to any authenticated user.

---

## 10. ERROR HANDLING

| Situation | Response |
|---|---|
| Session not found by ID | `sendError(res, 404, 'Session not found.', 'NOT_FOUND')` |
| Non-student calls `/upcoming` or `/recordings/my` | `restrictTo` sends `403` |
| Any DB/unexpected error | `next(e)` → global error handler |

---

## 11. EXAMPLE USAGE

**Get upcoming sessions (as a student):**
```http
GET /api/v1/live-sessions/upcoming
Authorization: Bearer <student_jwt>
```

**Get recordings:**
```http
GET /api/v1/live-sessions/recordings/my
Authorization: Bearer <student_jwt>
```

**Get session detail:**
```http
GET /api/v1/live-sessions/12
Authorization: Bearer <any_jwt>
```

---

## 12. EDGE CASES / NOTES

- **`/upcoming` is hard-limited to 10 results** — no pagination support. Heavy users with many upcoming sessions will only see the 10 nearest.
- **`GET /:id` has no enrollment check** — a student not enrolled in the course can still view session details if they know the session ID. This may be an intentional public-preview design or an oversight.
- **Recording access is enrollment-gated** (`/recordings/my`) — but session detail (`/:id`) is not. This inconsistency means a non-enrolled user could get the `meeting_link` from `/:id` if the session is still scheduled.
- **No write endpoints** — this file is entirely read-only from the student's perspective.
- **Inline controller pattern** — all SQL is in route handlers; no service/controller abstraction.

---

## 13. SUMMARY

`live-sessions_routes.js` provides three student-facing read-only endpoints for live class sessions. It allows students to see upcoming sessions (limited to their enrollments), access past recordings, and retrieve session details. Role restrictions prevent non-students from accessing enrollment-specific routes. The file follows an inline pattern with direct SQL queries, and is intentionally scoped to student consumption — instructor management of sessions lives in a separate routes file.
