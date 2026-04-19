# instructor.controller.js — Instructor Controller

## Overview

`instructor.controller.js` contains all **Express request handler functions** for the Instructor module. Each handler extracts data from the request, performs minimal validation, delegates all business logic to `instructor.service.js`, and returns a standardized JSON response via `sendSuccess` or `sendError`.

**File path:** `backend/modules/instructor/instructor.controller.js`

---

## Architecture Pattern

Every handler follows the same pattern:

```js
exports.someHandler = async (req, res, next) => {
  try {
    const data = await svc.someServiceMethod(req.user.id, req.body);
    return sendSuccess(res, 200, 'Message.', data);
  } catch (e) { next(e); }
};
```

- All errors are forwarded to Express's global error handler via `next(e)`
- `sendSuccess(res, statusCode, message, data?)` always returns JSON
- `sendError(res, statusCode, message, errorCode)` returns a JSON error response
- `req.user.id` is always available (set by `protect` middleware)

---

## Handler Reference

### Dashboard

#### `getDashboard`
- **Route:** `GET /api/v1/instructor/dashboard`
- **Returns:** Aggregated stats: total published courses, total enrolled students, material earnings, upcoming sessions count, recent courses, recent students, upcoming live sessions, recent materials, earnings trend.

---

### Courses

#### `getMyCourses`
- **Route:** `GET /api/v1/instructor/courses`
- **Returns:** All courses belonging to the logged-in instructor (all statuses including drafts).

#### `getCourse`
- **Route:** `GET /api/v1/instructor/courses/:id`
- **Returns:** Full course detail including modules, lessons, and coupon list.
- **Auth check:** Service verifies the instructor owns the course.

#### `createCourse`
- **Route:** `POST /api/v1/instructor/courses`
- **Body:** `{ title, description, category, level, price, language, tags, ... }`
- **Returns:** `201` + new course object.
- **Status:** Created as `draft`.

#### `updateCourse`
- **Route:** `PATCH / PUT /api/v1/instructor/courses/:id`
- **Body:** Any updatable fields (title, description, price, thumbnail_url, etc.)
- **Auth check:** Service verifies ownership before updating.

#### `publishCourse`
- **Route:** `PATCH / PUT /api/v1/instructor/courses/:id/publish`
- **Validation (in service):** Course must have ≥1 module and ≥1 lesson.
- **Effect:** Sets course status to `published`.

#### `deleteCourse`
- **Route:** `DELETE /api/v1/instructor/courses/:id`
- **Auth check:** Only the owner can delete.

#### `uploadThumbnail`
- **Route:** `POST /api/v1/instructor/courses/:id/thumbnail`
- **Expects:** Multipart form with field `thumbnail`
- **Returns:** `{ thumbnail_url: '/uploads/thumbnails/<filename>' }`
- **Validation:** Returns `400` if no file is provided.

---

### Coupons

#### `getCoupons`
- **Route:** `GET /api/v1/instructor/courses/:id/coupons`
- **Returns:** Array of coupon objects for the specified course.

#### `saveCoupons`
- **Route:** `POST /api/v1/instructor/courses/:id/coupons`
- **Body:** `{ coupons: [{ code, type, value, max_uses, expiry }] }`
- **Validation:** `coupons` must be an array. Returns `400` otherwise.
- **Behavior:** Replaces all existing coupons for the course.

---

### Modules / Sections

#### `getModules`
- **Route:** `GET /api/v1/instructor/courses/:courseId/sections` (or `/modules`)
- **Returns:** Ordered list of modules with their lessons.

#### `addModule`
- **Route:** `POST /api/v1/instructor/courses/:courseId/sections` (or `/modules`)
- **Body:** `{ title, description?, order? }`
- **Validation:** `title` is required (returns `400` if missing).
- **Returns:** `201` + new module object.

#### `updateModule`
- **Route:** `PATCH / PUT /api/v1/instructor/sections/:id` (or `/modules/:id`)
- **Body:** `{ title?, description?, order_index? }`
- **Auth check:** Service verifies the module belongs to the instructor's course.

#### `deleteModule`
- **Route:** `DELETE /api/v1/instructor/sections/:id` (or `/modules/:id`)
- **Effect:** Cascade-deletes all lessons within the module.

---

### Lessons / Videos

#### `getVideos`
- **Route:** `GET /api/v1/instructor/sections/:sectionId/lessons` (or `/modules/:moduleId/videos`)
- **Returns:** Ordered list of lessons in the module, including `type`, `video_url`, `duration`, `content`, `timestamps`.

#### `addLesson` *(JSON — stub creation)*
- **Route:** `POST /api/v1/instructor/sections/:sectionId/lessons`
- **Body:** `{ title, type, order?, description? }`
- **Validation:** `title` is required.
- **Use case:** Creates a placeholder lesson for later video upload or article editing.

#### `addVideoJson` *(JSON — URL or stub)*
- **Route:** `POST /api/v1/instructor/modules/:moduleId/videos`
- **Body:** `{ title, video_url?, type?, description?, is_preview? }`
- **Use case:** Create a lesson with a YouTube/Vimeo URL without file upload.

#### `addVideo` *(Multipart — file upload)*
- **Route:** `POST /api/v1/instructor/modules/:moduleId/videos/upload`
- **Expects:** Multipart form; field: `video` (any size up to 50 GB)
- **Body fields:** `title`, `is_preview` (optional)
- **Returns:** `201` + lesson object with `video_url`.

#### `updateVideo`
- **Route:** `PATCH / PUT /api/v1/instructor/lessons/:id` (or `/videos/:id`)
- **Body:** Any updatable fields (title, description, order, is_preview, video_url, content, timestamps)

#### `deleteVideo`
- **Route:** `DELETE /api/v1/instructor/lessons/:id` (or `/videos/:id`)
- **Effect:** Deletes the lesson and removes the associated file from disk (if applicable).

#### `uploadLessonVideo` *(Replace video on existing lesson)*
- **Route:** `POST /api/v1/instructor/lessons/:id/upload-video`
- **Expects:** Multipart form; field: `video`
- **Validation:** Returns `400` if no file uploaded.
- **Returns:** `{ video_url: '/uploads/videos/<filename>' }`

#### `saveLessonVideoUrl` *(Set external URL on existing lesson)*
- **Route:** `POST /api/v1/instructor/lessons/:id/video-url`
- **Body:** `{ video_url: 'https://youtube.com/...' }`
- **Validation:** Returns `400` if `video_url` is missing.

---

### Students

#### `getMyStudents`
- **Route:** `GET /api/v1/instructor/students`
- **Query params:** Filterable via `req.query`
- **Returns:** Students enrolled in any of this instructor's courses.

#### `getStudentDetail`
- **Route:** `GET /api/v1/instructor/students/:id`
- **Returns:** Student profile, enrolled courses, progress, assignments, and attendance.

---

### Quizzes

| Handler | Route | Description |
|---|---|---|
| `getQuizzes` | GET `/quizzes` | List all quizzes created by this instructor |
| `getQuiz` | GET `/quizzes/:id` | Get quiz with all questions and answer options |
| `createQuiz` | POST `/quizzes` | Create quiz with questions |
| `updateQuiz` | PATCH/PUT `/quizzes/:id` | Edit quiz and its questions |
| `publishQuiz` | PATCH/PUT `/quizzes/:id/publish` | Publish quiz to students |
| `deleteQuiz` | DELETE `/quizzes/:id` | Delete quiz |

---

### Assignments

| Handler | Route | Description |
|---|---|---|
| `getAssignments` | GET `/assignments` | List all assignments |
| `getAssignment` | GET `/assignments/:id` | Get assignment detail |
| `createAssignment` | POST `/assignments` | Create assignment; optional file attachment (max 20 MB) |
| `updateAssignment` | PATCH/PUT `/assignments/:id` | Edit assignment |
| `deleteAssignment` | DELETE `/assignments/:id` | Delete assignment |
| `getSubmissions` | GET `/submissions` | List student submissions with optional filters |
| `gradeSubmission` | POST `/submissions/:id/grade` | Assign score and feedback to a submission |
| `deleteSubmission` | DELETE `/submissions/:id` | Remove a submission |

**gradeSubmission body:**
```json
{ "score": 85, "feedback": "Good work, but check section 3." }
```
**Validation:** `score` is required (returns `400` if missing).

---

### Live Sessions

| Handler | Route | Description |
|---|---|---|
| `getLiveSessions` | GET `/live-sessions` | List sessions, filterable by `?status=scheduled/live/ended` |
| `getLiveSession` | GET `/live-sessions/:id` | Get session detail |
| `createLiveSession` | POST `/live-sessions` | Schedule a new session |
| `updateLiveSession` | PATCH/PUT `/live-sessions/:id` | Edit title, time, platform, meeting link |
| `deleteLiveSession` | DELETE `/live-sessions/:id` | Cancel and delete session |
| `startLiveSession` | PATCH/PUT `/live-sessions/:id/start` | Sets `status = 'live'` |
| `endLiveSession` | PATCH/PUT `/live-sessions/:id/end` | Sets `status = 'ended'` |

---

### Analytics & Earnings

#### `getAnalytics`
- **Route:** `GET /api/v1/instructor/analytics`
- **Query:** `?days=30` (default)
- **Returns:** Enrollment trend, video watch counts, quiz performance, revenue breakdown.

#### `getEarnings`
- **Route:** `GET /api/v1/instructor/earnings`
- **Returns:** Paid enrollments, material purchases, total earnings, payout history.

---

### Messages

| Handler | Route | Description |
|---|---|---|
| `getMessageRooms` | GET `/messages/rooms` | List all one-to-one chat rooms |
| `createRoom` | POST `/messages/rooms` | Get or create room with `other_user_id` |
| `getMessages` | GET `/messages/:roomId` | Get messages in a room; optional `?limit=` |
| `sendMessage` | POST `/messages/:roomId` | Send message; body: `{ content }` |
| `markMessagesRead` | PATCH/PUT `/messages/:roomId/read` | Mark all messages in room as read |

**createRoom body:**
```json
{ "other_user_id": 42 }
```
**Validation:** `other_user_id` is required.

---

### Profile

| Handler | Route | Description |
|---|---|---|
| `getProfile` | GET `/profile` | Get instructor profile and user_profiles data |
| `updateProfile` | PATCH/PUT `/profile` | Update profile fields |
| `updatePassword` | PATCH/PUT `/profile/password` | Requires `current_password` and `new_password` |
| `updateAvatar` | POST `/profile/avatar` | Upload avatar image (multipart, field: `avatar`) |

**updatePassword validation:** Both `current_password` and `new_password` are required (returns `400` otherwise).

---

## Response Format

All responses use the shared `sendSuccess` / `sendError` helpers:

**Success:**
```json
{
  "success": true,
  "message": "Course loaded.",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Module title is required.",
  "code": "MISSING_TITLE"
}
```

---

## Dependencies

| Import | Purpose |
|---|---|
| `./instructor.service` | All business logic and database queries |
| `../../shared/errorHandler` | `sendSuccess`, `sendError` |
