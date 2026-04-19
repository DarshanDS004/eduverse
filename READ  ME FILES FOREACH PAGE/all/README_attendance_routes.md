# `attendance.routes.js` — Attendance Module

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `attendance.routes.js` |
| **Location** | `modules/attendance/attendance.routes.js` |
| **File Type** | Route Definition (Inline Handler Pattern) |
| **Project** | EduVerse |

**Purpose:** This file defines all attendance-related HTTP endpoints for EduVerse. It handles creating attendance sessions, marking student attendance records (instructor/institute), and viewing attendance data from both student and instructor perspectives. Like `assignments.routes.js`, it uses the **inline handler** pattern — no separate controller or service file.

---

## 2. Responsibility

- Allow instructors/institute users to create attendance sessions for a class.
- Allow instructors/institute users to mark or update attendance records per session.
- Allow students to view their own attendance history and summary.
- Allow instructors/institute users to view class-wide or individual student attendance.
- Apply global JWT protection to all routes.

**Why this file exists:** Attendance is a cross-cutting concern separate from courses and students. Keeping it as a standalone module with inline logic makes it easy to mount and maintain independently.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework, provides `Router()` |
| `db` | `../../config/db` | MySQL pool — used directly for all queries |
| `protect` | `../auth/auth.middleware` | JWT verification middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control |
| `sendSuccess` | `../../shared/errorHandler` | Standardized JSON success responses |
| `sendError` | `../../shared/errorHandler` | Standardized JSON error responses |

---

## 4. Core Logic Breakdown

### Global Middleware
```js
router.use(protect);
```
Every route requires authentication. No public attendance endpoints exist.

### Inline Handler Pattern
All route logic is written directly as `async (req, res, next)` functions on the router. Each follows:
```
1. Extract params/body
2. Validate required fields (where applicable)
3. Execute SQL
4. Return sendSuccess / sendError
5. Catch → next(e)
```

### Attendance Percentage Calculation
Used in two routes (`GET /my` and `GET /student/:studentId`):
```js
const total      = records.length;
const present    = records.filter(r => r.status === 'present').length;
const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
```
Calculated in application code (not in SQL) after fetching records. Safe divide-by-zero guard returns `0` when `total = 0`.

---

## 5. Route Handlers

### `POST /sessions` — Create Attendance Session

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('instructor', 'institute')` |
| **Body** | `class_id` (required), `date` (required), `subject` (optional), `live_session_id` (optional) |
| **Response** | 201 with `{ id: insertId }` |

**Validation:** Returns `400 MISSING_FIELDS` if `class_id` or `date` is absent.

**SQL:**
```sql
INSERT INTO attendance_sessions
  (class_id, instructor_id, subject, date, live_session_id)
VALUES (?, ?, ?, ?, ?)
```

- `instructor_id` is taken from `req.user.id` (JWT), not from the request body — prevents instructors from creating sessions on behalf of others.
- `subject` and `live_session_id` are optional and default to `null`.
- Returns the new session's `insertId` for the client to use when marking attendance.

---

### `POST /sessions/:id/mark` — Mark Attendance

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('instructor', 'institute')` |
| **Parameters** | `req.params.id` — attendance session ID |
| **Body** | `records` — array of `{ student_id, status }` objects |
| **Response** | 200 with `{ count: records.length }` |

**Validation:** Returns `400 INVALID_INPUT` if `records` is not an array.

**SQL (per record, in a loop):**
```sql
INSERT INTO attendance_records (attendance_session_id, student_id, status)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE status = ?
```

Key behaviors:
- **Loops through `records` array** — one DB query per student. For a large class this could be many queries. A bulk INSERT would be more efficient.
- **Upsert pattern:** `ON DUPLICATE KEY UPDATE` allows re-marking attendance (correcting mistakes). If a record already exists for that session+student combination, the status is updated.
- `status` defaults to `'present'` if the field is missing on a record object (`rec.status || 'present'`).
- Returns a count of how many records were processed (not necessarily how many were new vs updated).

---

### `GET /my` — Student's Own Attendance

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('student')` |
| **Parameters** | `req.user.id` — from JWT |
| **Response** | 200 with `{ records, summary: { total, present, percentage } }` |

**SQL:**
```sql
SELECT ats.date, ats.subject, ar.status, c.name AS class_name
FROM attendance_records ar
JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
JOIN classes c ON c.id = ats.class_id
WHERE ar.student_id = ?
ORDER BY ats.date DESC
```

Returns full attendance history across all classes, ordered by date descending. Includes a computed summary with attendance percentage.

---

### `GET /class/:classId` — Class Attendance (Instructor View)

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('instructor', 'institute')` |
| **Parameters** | `req.params.classId`, optional `req.query.date` |
| **Response** | 200 with array of attendance records |

**Dynamic WHERE clause:**
```js
const where  = ['ats.class_id = ?'];
const params = [req.params.classId];
if (date) { where.push('ats.date = ?'); params.push(date); }
```

- If `date` is provided, filters to a specific date — useful for viewing a single session's attendance.
- If `date` is omitted, returns all attendance records for the class across all sessions.

**SQL:**
```sql
SELECT up.full_name AS student_name, ar.status, ats.date, ats.subject
FROM attendance_records ar
JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
JOIN user_profiles up ON up.user_id = ar.student_id
WHERE ats.class_id = ? [AND ats.date = ?]
ORDER BY ats.date DESC
```

---

### `GET /student/:studentId` — Individual Student Attendance (Instructor View)

| Property | Details |
|---|---|
| **Auth** | `protect` + `restrictTo('instructor', 'institute')` |
| **Parameters** | `req.params.studentId` |
| **Response** | 200 with `{ records, summary: { total, present, percentage } }` |

Same query and summary calculation logic as `GET /my`, but accepts an arbitrary `studentId` from the URL param instead of `req.user.id`. Returns the same shape of response (records + summary).

**No ownership restriction:** Any instructor or institute user can query any student's attendance by ID — there is no check that the instructor teaches the student's class.

---

## 6. API Role

When mounted at `/api/attendance` (assumed):

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/attendance/sessions` | Instructor / Institute | Create a new attendance session |
| POST | `/api/attendance/sessions/:id/mark` | Instructor / Institute | Mark/update attendance records for a session |
| GET | `/api/attendance/my` | Student | Get own attendance history + summary |
| GET | `/api/attendance/class/:classId` | Instructor / Institute | Get class attendance (optionally filtered by date) |
| GET | `/api/attendance/student/:studentId` | Instructor / Institute | Get a specific student's attendance + summary |

---

## 8. Data Flow

### Mark Attendance Flow
```
POST /sessions
      │ { class_id, date, subject? }
      ▼
INSERT attendance_sessions
      │ → returns session id
      ▼
POST /sessions/:id/mark
      │ { records: [{ student_id, status }] }
      ▼
Loop: INSERT/UPDATE attendance_records (one query per student)
      │
      ▼
200 { count: N }
```

### Student View Flow
```
GET /my (student JWT)
      │
      ▼
SELECT records from attendance_records JOIN sessions JOIN classes
      │
      ▼
JS: calculate total, present, percentage
      │
      ▼
200 { records, summary }
```

---

## 9. Connections

### Files That Call This File
- Main app entry point — mounts at `/api/attendance`.

### Files This File Depends On
- `../../config/db` — Direct DB queries
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

### Related DB Tables
- `attendance_sessions` — One record per class session
- `attendance_records` — One record per student per session
- `classes` — Class information (name)
- `user_profiles` — Student names

---

## 10. Middleware / Auth

| Route | Middleware |
|---|---|
| All routes | `protect` (global) |
| `POST /sessions` | `restrictTo('instructor', 'institute')` |
| `POST /sessions/:id/mark` | `restrictTo('instructor', 'institute')` |
| `GET /my` | `restrictTo('student')` |
| `GET /class/:classId` | `restrictTo('instructor', 'institute')` |
| `GET /student/:studentId` | `restrictTo('instructor', 'institute')` |

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Missing JWT | `protect` → `401` JSON |
| Wrong role | `restrictTo` → `403` JSON |
| Missing `class_id` or `date` | Inline `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| `records` not an array | Inline `sendError(res, 400, ..., 'INVALID_INPUT')` |
| DB error | `catch(e) → next(e)` → global error handler |

---

## 12. Example Usage

### Create a Session
```http
POST /api/attendance/sessions
Authorization: Bearer eyJhbGci...  ← instructor token
Content-Type: application/json

{
  "class_id": 2,
  "date": "2026-04-18",
  "subject": "Mathematics"
}

→ 201: { "id": 15 }
```

### Mark Attendance
```http
POST /api/attendance/sessions/15/mark
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "records": [
    { "student_id": 101, "status": "present" },
    { "student_id": 102, "status": "absent" },
    { "student_id": 103, "status": "present" }
  ]
}

→ 200: { "count": 3 }
```

### Student Views Own Attendance
```http
GET /api/attendance/my
Authorization: Bearer eyJhbGci...  ← student token

→ 200: {
  "records": [
    { "date": "2026-04-18", "subject": "Mathematics", "status": "present", "class_name": "Class 10A" }
  ],
  "summary": { "total": 42, "present": 38, "percentage": 90 }
}
```

---

## 13. Edge Cases / Notes

- **Serial loop for marking:** `POST /sessions/:id/mark` runs one INSERT per student in a `for` loop. For large classes (50+ students), this is inefficient. A bulk insert with a constructed query would be significantly faster.
- **No session ownership check:** Any instructor or institute user can mark attendance for any session ID, regardless of who created it.
- **`GET /student/:studentId` is unconstrained:** Any instructor can view any student's full attendance history across all classes — there's no filtering by the instructor's own classes.
- **Percentage is JS-computed:** Attendance percentage is calculated after fetching all records into memory. For students with very long attendance histories, this could be slow — a SQL `SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END)` would be more efficient.
- **`status` defaults to `'present'`:** If a `records` array entry has no `status` field, the student is marked present. This default may or may not be intended.
- **No date filter on `GET /my` or `GET /student/:studentId`:** These return complete attendance history with no pagination or date range filtering — could become a large response over time.

---

## 14. Summary

`attendance.routes.js` is a self-contained module handling the full attendance lifecycle in EduVerse. Instructors and institute users can create sessions and mark per-student attendance with upsert safety. Students can view their own history with a computed summary. Instructors can view class-wide or individual student attendance with optional date filtering. All logic is inline with direct DB access — no separate service or controller layer.
