# `student.service.js` — Student Business Logic & Database Operations

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `student.service.js` |
| **Location** | `modules/student/student.service.js` |
| **File Type** | Service Layer (Business Logic) |
| **Project** | EduVerse |

**Purpose:** This is the most comprehensive service file in the student module. It implements all business logic for authenticated student users — fetching dashboard data, enrolled courses, assignments, performance analytics, profile management, calendar events, lesson progress tracking with automatic certificate generation, notifications, and activity feeds.

---

## 2. Responsibility

This file handles:
- Aggregating multi-table dashboard data into a single response
- Calculating study streaks from video watch history
- Tracking lesson completion (90% threshold = complete)
- Auto-issuing certificates on course completion
- Computing performance analytics with time-range filtering
- Managing profile updates with partial-update (COALESCE) safety
- Password updates with bcrypt and refresh token invalidation
- Building monthly calendar views from multiple event sources
- Notification management (read/unread)

**Why this file exists:** Business logic is separated from HTTP handling (controller) and routing, following the service pattern. All database queries live here.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `db` | `../../config/db` | MySQL connection pool for all queries |
| `AppError` | `../../shared/errorHandler` | Structured error with HTTP code and error code |
| `bcrypt` | `bcryptjs` | Password hashing and comparison |
| `uuidv4` | `uuid` | Generating unique certificate codes |

---

## 4. Core Logic Breakdown

The file is organized into logical sections matching student features. Most functions perform multiple sequential SQL queries and assemble a composite response.

### Key Design Patterns:
- **`ON DUPLICATE KEY UPDATE`** — Used in `submitAssignment`, `updateLessonProgress`, `_updateCourseProgress`, `_issueCertificateIfNotExists` to upsert records safely.
- **`COALESCE`** — Used throughout for safe null-fallback in SQL (especially in `getDashboard` stats and `updateProfile`).
- **Subqueries in SELECT** — Used extensively (e.g., in `getDashboard`, `getCourses`) to compute counts inline.
- **Private helper functions** — `_calculateStreak`, `_updateCourseProgress`, `_issueCertificateIfNotExists` are prefixed with `_` and not exported.

---

## 5. Functions / Methods

### `getDashboard(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | Composite dashboard object |

Runs **7 separate DB queries** in sequence:
1. **`courses`** — Last 5 enrolled courses with progress percentages and watched/total video counts.
2. **`assignments`** — Up to 5 upcoming pending assignments with deadline.
3. **`liveSessions`** — Up to 3 upcoming scheduled live sessions.
4. **`statsRow`** — Aggregate counts: total courses, pending assignments, average quiz score.
5. **`attendanceRow`** — Total sessions and present count for attendance rate calculation.
6. **`streakRows`** — Last 30 days with study activity (video watching), passed to `_calculateStreak`.
7. **`activity`** — Last 10 video watch events.
8. **`notifications`** — Last 10 notifications with unread count.

**Returns:**
```js
{
  stats: { total_courses, pending_assignments, attendance_rate, avg_score },
  streak: { count, days },
  courses, assignments, live_sessions,
  activity,
  notifications: { items, unread_count }
}
```

---

### `getCourses(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | Array of enrolled course objects |

Fetches all enrolled courses with:
- Completion percentage and last activity date from `course_progress`
- Total video count and watched video count via correlated subqueries
- Instructor name from `user_profiles`
- Ordered by most recently active first

---

### `getAssignments(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | Array of assignment objects with submission status |

Returns all assignments across enrolled courses, left-joined with submission records. Ordered by status priority:
1. `pending` first
2. `submitted` second
3. `graded` third

Then sorted by deadline ascending within each group.

---

### `submitAssignment(userId, assignmentId, text, fileUrl, fileName)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `assignmentId` — integer, `text` — string or null, `fileUrl` — string or null, `fileName` — string or null |
| **Returns** | `{ message, is_late }` |

**Logic:**
1. Verifies the student is enrolled in the course containing the assignment (JOIN guard).
2. Checks `assignment.deadline` vs current time — marks submission as `'late'` if past deadline.
3. Upserts into `assignment_submissions` — allows re-submission with updated content.

**Edge case:** If the student re-submits, the record is updated (not duplicated). `submitted_at` is always reset to `NOW()` on re-submission.

---

### `getPerformance(userId, days)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `days` — string (parsed to int, defaults to 30) |
| **Returns** | Performance analytics object |

Runs **6 queries** and assembles:
- `avg_score`, `highest_score`, `lowest_score`, `quizzes_taken` — overall quiz stats
- `assignments_completed` — graded assignment count
- `attendance_rate` — present/total sessions
- `courses_enrolled`, `courses_completed` — enrollment stats
- `score_trend` — daily average scores within the time window (grouped by date)
- `subject_scores` — average score per course category
- `recent_quizzes` — last 10 quiz attempts
- `assignment_grades` — last 10 graded assignments

---

### `getProfile(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | Full profile object with stats |
| **Error** | `AppError 404 NOT_FOUND` if user not found |

Single JOIN query with inline subqueries for enrolled course count, certificate count, and average quiz score.

---

### `updateProfile(userId, data)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `data` — object with optional fields |
| **Returns** | `{ message, user }` |

Uses `COALESCE(?, existing_value)` for every field — only updates fields where non-null values are provided. Phone is updated in `users` table separately (different table from profile fields).

**Returns** the updated user object by re-fetching from DB — ensures the response reflects the actual saved state.

---

### `updatePassword(userId, currentPassword, newPassword)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `currentPassword` — string, `newPassword` — string |
| **Returns** | `{ message }` |
| **Errors** | `404 NOT_FOUND`, `400 WRONG_PASSWORD` |

1. Fetches current `password_hash`.
2. Compares with `bcrypt.compare()`.
3. Hashes new password with `BCRYPT_ROUNDS` env rounds.
4. Updates `users.password_hash`.
5. **Deletes all refresh tokens** — forces re-login on all devices after password change.

---

### `updateAvatar(userId, photoUrl)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `photoUrl` — string (server path) |
| **Returns** | `{ message, avatar_url }` |

Simple single-field update to `user_profiles.photo_url`. No cleanup of old avatar file.

---

### `getCalendar(userId, year, month)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `year` — string or number, `month` — string or number |
| **Returns** | Array of calendar event objects |

Runs **3 queries** and merges results into a single event array:
1. Assignment deadlines (type: `'assignment'`)
2. Live session dates (type: `'live'`)
3. Published quiz creation dates (type: `'quiz'`)

Calculates the first and last day of the requested month:
```js
const from = `${y}-${String(m).padStart(2,'0')}-01`;
const to   = new Date(y, m, 0).toISOString().split('T')[0]; // Last day trick
```
`new Date(y, m, 0)` gives the last day of month `m-1` (i.e., the last day of the target month).

---

### `updateLessonProgress(userId, videoId, watchedSeconds)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `videoId` — integer, `watchedSeconds` — integer |
| **Returns** | `{ message, completed }` |

**Completion threshold: 90%**
```js
const completed = durationSecs > 0 ? (seconds / durationSecs) >= 0.9 : false;
```

Upserts `video_progress` with `GREATEST` for `watched_seconds` — progress can only increase, never decrease:
```sql
watched_seconds = GREATEST(watched_seconds, VALUES(watched_seconds))
```

After saving progress, calls `_updateCourseProgress()`.

---

### `_updateCourseProgress(userId, courseId)` *(private)*
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `courseId` — integer |
| **Returns** | `void` (side effects only) |

1. Counts total videos in the course and completed videos by this student.
2. Calculates completion percentage.
3. Upserts `course_progress` with new percentage and timestamp.
4. If `pct === 100`, calls `_issueCertificateIfNotExists()`.

**Sets `completed_at` only when reaching 100%:**
```sql
completed_at = CASE WHEN ? = 100 THEN NOW() ELSE completed_at END
```

---

### `_issueCertificateIfNotExists(userId, courseId)` *(private)*
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `courseId` — integer |
| **Returns** | `void` |

Checks if a certificate already exists. If not:
1. Fetches the course title.
2. Generates a unique certificate code: `EV-{uuid-segment}-{courseId}`.
3. Inserts into `certificates`.

**This is auto-triggered** — no manual action needed from the student.

---

### `getNotifications(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | Array of up to 20 notifications |

---

### `markNotifRead(userId, notifId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `notifId` — integer |
| **Returns** | `{ message }` |

Uses `WHERE id = ? AND user_id = ?` — prevents a student from marking another user's notification as read.

---

### `markAllRead(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | `{ message }` |

Bulk updates all `notifications` rows for the user.

---

### `getActivity(userId, limit)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer, `limit` — string (defaults to 20) |
| **Returns** | Array of activity events |

Currently only returns `video_watched` events. The `type` field is hardcoded as `'video_watched'` — designed to be extensible with UNION queries for other activity types.

---

### `_calculateStreak(dates)` *(private)*
| Property | Details |
|---|---|
| **Parameters** | `dates` — array of Date objects or date strings |
| **Returns** | `{ count, days }` |

**Streak counting logic:**
1. Converts dates to a `Set` of date strings (deduplicates).
2. Starts from today and walks backward day by day.
3. Increments `count` as long as the day exists in the set.
4. Stops at the first gap.

**7-day view (`days` array):**
- Returns the last 7 days with labels (S/M/T/W/T/F/S), date numbers, and `done`/`today` flags.
- Used to render a visual streak calendar in the frontend.

---

## 6. API Role

All functions are called by `student.controller.js`. No direct HTTP exposure.

---

## 8. Data Flow

```
student.controller.js  →  student.service.function(userId, params)
                                    │
                         Multiple SQL queries to:
                         ┌──────────────────────────────────┐
                         │ enrollments, courses              │
                         │ assignments, assignment_submissions│
                         │ live_sessions, attendance_records │
                         │ quiz_attempts, quizzes            │
                         │ video_progress, videos            │
                         │ course_progress, certificates     │
                         │ notifications, user_profiles      │
                         └──────────────────────────────────┘
                                    │
                         Assembled result object
                                    │
                         Returned to controller
```

---

## 9. Connections

### Files That Call This File
- `modules/student/student.controller.js`

### Files This File Depends On
- `../../config/db` — All database queries
- `../../shared/errorHandler` — `AppError`
- `bcryptjs` — Password operations
- `uuid` — Certificate code generation

---

## 11. Error Handling

| Function | Error | Code | HTTP |
|---|---|---|---|
| `submitAssignment` | Not enrolled / assignment not found | `NOT_FOUND` | 404 |
| `getProfile` | User not found | `NOT_FOUND` | 404 |
| `updatePassword` | User not found | `NOT_FOUND` | 404 |
| `updatePassword` | Wrong current password | `WRONG_PASSWORD` | 400 |
| `updateLessonProgress` | Video not found | `NOT_FOUND` | 404 |

All errors are thrown as `AppError` instances and caught by the controller's `try/catch`, forwarded via `next(err)` to the global handler.

---

## 12. Example Usage

```js
// Called from student.controller.js
const data = await service.getDashboard(42);
// Returns: { stats, streak, courses, assignments, live_sessions, activity, notifications }

const result = await service.submitAssignment(42, 7, 'My answer text', '/uploads/assignments/assign-123.pdf', 'homework.pdf');
// Returns: { message: 'Assignment submitted successfully.', is_late: false }

const progress = await service.updateLessonProgress(42, 15, 540);
// Returns: { message: 'Progress saved.', completed: true }
// Side effects: updates course_progress, may issue certificate
```

---

## 13. Edge Cases / Notes

- **Streak counts from today backward** — if today has no activity, streak is 0 even if yesterday had activity.
- **90% threshold for video completion** — students don't need to watch the last 10% of a video to get credit.
- **`GREATEST` in `updateLessonProgress`** — ensures progress can only increase, preventing accidental regressions if the client sends stale data.
- **Certificate is auto-issued** — there is no instructor approval step. Any student who reaches 100% course completion receives a certificate automatically.
- **Calendar `quiz` dates** use `created_at`, not an explicit due date — quizzes without deadline fields may not appear at meaningful times.
- **`getActivity` only shows video events** — other activity types (submissions, quiz attempts) could be added via UNION queries.

---

## 14. Summary

`student.service.js` is the core business logic engine for EduVerse's student module. It runs complex multi-table queries to assemble dashboard data, tracks lesson progress with auto-completion detection, automatically issues certificates on course completion, computes performance analytics over configurable time windows, and manages the full lifecycle of profile management and notifications. All database operations use safe upsert patterns and parameterized queries.
