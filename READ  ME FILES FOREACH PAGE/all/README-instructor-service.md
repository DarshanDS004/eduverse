# instructor.service.js — Instructor Service

## Overview

`instructor.service.js` contains all **business logic and direct database queries** for the Instructor module. It is called exclusively by `instructor.controller.js` and has no knowledge of HTTP (no `req`/`res`). All database access goes through the shared `db` query pool.

**File path:** `backend/modules/instructor/instructor.service.js`

---

## Architecture

- All functions are `async` and throw `AppError` for business rule violations
- SQL queries use parameterized placeholders (`?`) — no string interpolation
- Ownership is verified in every function before performing mutations
- File deletion from disk is fire-and-forget (non-blocking) using `fs.unlink`

---

## Function Reference

### Dashboard

#### `getDashboard(instructorId)`
Runs five aggregated SQL queries in parallel:

| Data | Query |
|---|---|
| Stats | Total published courses, total distinct enrolled students, material earnings (paid purchases), total materials, upcoming session count |
| Recent courses | Last 5 courses (with video count) |
| Recent students | Last 6 distinct enrolled students (with course title) |
| Upcoming live sessions | Next 3 sessions (scheduled in the future) |
| Recent materials | Last 4 study materials with total earnings |
| Earnings trend | Monthly material earnings for the past 6 months |

**Returns:**
```json
{
  "stats": { "total_courses": 3, "total_students": 47, ... },
  "courses": [...],
  "students": [...],
  "live_sessions": [...],
  "materials": [...],
  "earnings_trend": [...]
}
```

---

### Courses

#### `getMyCourses(instructorId)`
Returns all courses owned by the instructor (all statuses: draft, published, archived, etc.), ordered by `updated_at DESC`. Each row includes sub-query counts for:
- `total_modules` — number of modules in the course
- `total_videos` / `video_count` — total lessons across all modules
- `total_revenue` — sum of successful payments × 0.9 (after 10% platform commission)

#### `getCourse(courseId, instructorId)`
Returns the full course detail for the instructor's own course:
- Verifies `instructor_id` ownership before returning
- Fetches modules in `order_index ASC`
- For each module: fetches lessons with `type`, `content`, `timestamps`, `video_url`, `is_preview`, `processing_status`
- Fetches coupons for the course
- Returns: `{ ...course, modules: [...], coupons: [...] }`

#### `createCourse(instructorId, data)`
| Field | Handling |
|---|---|
| `title` | Required; throws `400` if missing |
| `level` | Validated against allowed values; defaults to `beginner` |
| `status` | Normalized (e.g. `'review'` → `'pending_review'`); `'published'` is forced to `'pending_review'` (admin must approve) |
| `is_free` | Accepts boolean, string `'true'`, or `1` |
| `price` | Parsed as float; 0 if free |
| `coupons` | Saved if provided as an array |

**Returns:** `{ id, message, status }`

#### `updateCourse(courseId, instructorId, data)`
- Verifies ownership first; throws `404` if not found
- Dynamically builds `SET` clause from provided fields only
- Handles field aliases: `short_description` → `description`, `outcomes` → `what_you_learn`
- Validates `level` and normalizes `status`
- If `data.coupons` is an array, calls `saveCoupons` as part of the update

#### `publishCourse(courseId, instructorId)`
**Pre-publish validation:**
1. Verifies ownership — throws `404` if not found
2. Checks at least 1 module exists — throws `400` with code `NO_MODULES` if missing
3. Checks at least 1 lesson exists across all modules — throws `400` with code `NO_LESSONS` if missing

On success: Sets `status = 'published'` and `published_at = NOW()`.

#### `deleteCourse(courseId, instructorId)`
- Verifies ownership — throws `404` if not found
- **Blocks deletion if students are enrolled** — throws `400` with `HAS_ENROLLMENTS`
- If no enrollments: hard deletes from `courses` table (cascade deletes modules/videos)

---

### Coupons

#### `saveCoupons(courseId, instructorId, coupons)`
1. Soft-deactivates all existing coupons for the course (`is_active = 0`)
2. Upserts each new coupon using `INSERT ... ON DUPLICATE KEY UPDATE`
3. Normalizes code to uppercase, discount type to `'percentage'` or `'flat'`

**Coupon object:**
```js
{ code, type, value, max_uses, expiry }
```

#### `getCoupons(courseId, instructorId)`
Returns active coupons only (`is_active = 1`), ordered by `created_at DESC`.

---

### Modules

#### `getModules(courseId, instructorId)`
- Verifies course ownership — throws `404` if not found
- Returns modules ordered by `order_index ASC`

#### `addModule(courseId, instructorId, title, description, order)`
- Verifies course ownership
- Auto-computes `order_index` as `MAX(order_index) + 1` if not provided
- Inserts into `course_modules`

**Returns:** `{ id, title, order_index, message }`

#### `updateModule(moduleId, instructorId, data)`
- Verifies the module belongs to a course owned by this instructor (JOIN query)
- Dynamically updates only provided fields: `title`, `description`, `order_index`

#### `deleteModule(moduleId, instructorId)`
- Verifies ownership via JOIN
- Hard deletes; cascade removes all videos in the module

---

### Videos / Lessons

#### `getVideos(moduleId, instructorId)`
- Verifies the module belongs to the instructor's course
- Returns all columns: `id`, `title`, `description`, `video_url`, `duration`, `order_index`, `is_preview`, `processing_status`, `thumbnail_url`, `type`, `content`, `timestamps`

#### `addVideo(moduleId, instructorId, data, file)`
Handles three lesson types:
1. **File upload** — `file` param is a Multer file object; `video_url = '/uploads/videos/' + file.filename`
2. **External URL** — `data.video_url` is set (YouTube, Vimeo, etc.)
3. **Article / stub** — `video_url = null`, `content` holds the article body

| Field | Handling |
|---|---|
| `title` | Required |
| `type` | `'video'`, `'article'`, `'quiz'` — defaults to `'video'` |
| `is_preview` | Accepts boolean, `'true'`, `1`, `'1'` |
| `order` | Auto-computed as `MAX(order_index) + 1` if not provided |
| `content` | Article lesson body |
| `timestamps` | Chapter markers (JSON string) |

After insert: updates `courses.total_duration` from the sum of all video durations in the course.

**Returns:** `{ id, message, video_url }`

#### `updateVideo(videoId, instructorId, data)`
- Verifies ownership via three-table JOIN (`videos → course_modules → courses`)
- Dynamically builds SET clause
- Supports all fields: `title`, `video_url`, `duration`, `order_index`, `thumbnail_url`, `type`, `is_preview`, `description`, `content`, `timestamps`

#### `deleteVideo(videoId, instructorId)`
- Verifies ownership
- Hard deletes from `videos`
- If `video_url` starts with `/uploads/videos/`, attempts to delete the physical file from disk (`fs.unlink` — fire and forget)

---

### Students

#### `getMyStudents(instructorId, filters)`
Paginated query returning students enrolled in any of this instructor's courses.

| Filter | Applied as |
|---|---|
| `q` | `LIKE` search on `full_name` and `email` |
| `course_id` | Filter to students in a specific course |
| `page`, `per_page` | Pagination (max 50 per page) |

Each result includes `enrolled_courses` (comma-separated course titles), `last_enrolled_at`, and `avg_score` (average quiz percentage).

#### `getStudentDetail(studentId, instructorId)`
- Verifies the student is enrolled in at least one of the instructor's courses
- Returns: student profile, enrollment list with progress percentages, quiz attempt history

---

### Quizzes

#### `getQuizzes(instructorId)`
Returns all quizzes with question count and attempt count.

#### `getQuiz(quizId, instructorId)`
Returns quiz with all questions and their answer options.

#### `createQuiz(instructorId, data)`
| Field | Default |
|---|---|
| `duration_seconds` | 1800 (30 min) |
| `total_marks` | 100 |
| `pass_percentage` | 60 |
| `status` | `'draft'` |

Inserts questions and options in a loop if provided.

#### `updateQuiz(quizId, instructorId, data)`
Updates quiz metadata. If `questions` array is provided, deletes and re-inserts all questions and options.

#### `publishQuiz(quizId, instructorId)`
Sets `status = 'published'`.

#### `deleteQuiz(quizId, instructorId)`
Hard deletes quiz; cascade removes questions, options, and attempts.

---

### Assignments

#### `createAssignment(instructorId, data, fileUrl, fileName)`
Creates an assignment linked to a course and instructor. Attaches file URL and name if a file was uploaded (max 20 MB).

#### `gradeSubmission(submissionId, instructorId, score, feedback)`
- Verifies the submission belongs to an assignment owned by this instructor
- Updates `score`, `feedback`, `status = 'graded'`

#### `getSubmissions(instructorId, filters)`
Returns student submissions filterable by `assignment_id` and `status`.

---

### Live Sessions

#### `createLiveSession(instructorId, data)`
Inserts into `live_sessions` with `status = 'scheduled'`. Supported platforms: `jitsi`, `zoom`, `gmeet`, `other`.

#### `updateLiveSession(sessionId, instructorId, data)`
Verifies ownership; dynamically updates: `title`, `description`, `scheduled_at`, `duration_minutes`, `meeting_link`, `meeting_id`, `meeting_password`, `platform`, `status`, `recording_url`.

#### `deleteLiveSession(sessionId, instructorId)`
Verifies ownership; hard deletes.

---

### Analytics

#### `getAnalytics(instructorId, days)`
Returns (for the last N days, default 30):
- Enrollment trend (daily count)
- Revenue trend (daily sum)
- Total videos watched (from `video_progress`)
- Quiz average scores

#### `getEarnings(instructorId, filters)`
- Total lifetime course earnings (90% of payments — 10% platform commission)
- Monthly breakdown
- Per-course revenue
- Material purchase earnings

---

### Messages

#### `getOrCreateRoom(userId1, userId2)`
Finds an existing `message_rooms` row between the two users or creates one.

#### `getMessageRooms(userId)`
Returns all rooms with the latest message and the other user's profile.

#### `getMessages(roomId, userId, limit)`
Returns the last N messages (default 50) in a room. Verifies the user is a member of the room.

#### `sendMessage(roomId, senderId, content)`
Inserts into `messages`; updates `message_rooms.updated_at`.

#### `markRoomRead(roomId, userId)`
Sets `is_read = 1` for all messages sent by the other user in the room.

---

### Profile

#### `getProfile(userId)`
Joins `users` and `user_profiles` to return the full instructor profile.

#### `updateProfile(userId, data)`
Updates `user_profiles` fields: `full_name`, `bio`, `subject`, `qualification`, `experience_years`, `linkedin_url`, `teaching_levels`, `phone`.

#### `updatePassword(userId, currentPassword, newPassword)`
- Fetches the stored `password_hash` from `users`
- Compares `currentPassword` with `bcrypt.compare`
- Throws `401` if wrong; throws `400` if same as current
- Hashes and saves the new password

#### `updateAvatar(userId, photoUrl)`
Updates `user_profiles.photo_url`.

---

## Error Handling

All service functions throw `AppError` (never plain `Error`) for business rule violations:

```js
throw new AppError('Course not found.', 404, 'NOT_FOUND');
throw new AppError('Add at least one module before publishing.', 400, 'NO_MODULES');
throw new AppError('Cannot delete a course with enrolled students.', 400, 'HAS_ENROLLMENTS');
```

The controller catches these via `try/catch` and forwards to Express's global error handler via `next(e)`.

---

## Dependencies

| Import | Purpose |
|---|---|
| `../../config/db` | MySQL connection pool (`db.query`) |
| `../../shared/errorHandler` | `AppError` class |
| `bcryptjs` | Password hashing and comparison |
| `path` | Construct disk file paths for deletion |
| `fs` | Delete orphaned video files from disk |
