# instructor.routes.js — Instructor API Routes

## Overview

`instructor.routes.js` defines all HTTP routes for the **Instructor Portal** of EduVerse. Every route in this file requires the user to be authenticated and have the `instructor` role. File uploads (thumbnails, videos, assignments, avatars) are handled here via Multer middleware.

**File path:** `backend/modules/instructor/instructor.routes.js`  
**Base URL:** `/api/v1/instructor`

---

## Authentication & Authorization

All routes are protected by two global middleware applied at the top of the router:

```js
router.use(protect);             // verifies JWT
router.use(restrictTo('instructor'));  // ensures role === 'instructor'
```

Any unauthenticated or non-instructor request returns `401` or `403`.

---

## File Upload Middleware (Multer)

Multer disk storage factories create upload directories automatically if they don't exist. Files are **always streamed to disk** — never held in memory, regardless of size.

| Uploader | Field Name | Max Size | Accepted Types | Disk Path |
|---|---|---|---|---|
| `thumbUpload` | `thumbnail` | 5 MB | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif` | `uploads/thumbnails/` |
| `videoUpload` | `video` | **50 GB** | `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.flv`, `.wmv`, `.m4v`, `.ts` | `uploads/videos/` |
| `assignUpload` | `file` | 20 MB | Any | `uploads/assignments/` |
| `avatarUpload` | `avatar` | 5 MB | `.jpg`, `.jpeg`, `.png`, `.webp` | `uploads/avatars/` |

**Video upload note:** The 50 GB limit is a hard ceiling in Multer. The actual upload is streamed to disk in real time using `diskStorage`, so no RAM is used for buffering. The frontend uses `XMLHttpRequest` (not `fetch`) to display real-time upload progress.

---

## Route Reference

### Dashboard

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/dashboard` | `getDashboard` | Summary stats: courses, students, earnings, upcoming sessions |

---

### Courses

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/courses` | `getMyCourses` | List all courses belonging to this instructor |
| POST | `/courses` | `createCourse` | Create a new course (starts as draft) |
| GET | `/courses/:id` | `getCourse` | Get full course detail including modules |
| PATCH / PUT | `/courses/:id` | `updateCourse` | Update course metadata |
| PATCH / PUT | `/courses/:id/publish` | `publishCourse` | Publish a course (validates ≥1 module, ≥1 lesson) |
| DELETE | `/courses/:id` | `deleteCourse` | Soft-delete a course |
| POST | `/courses/:id/thumbnail` | `uploadThumbnail` | Upload course thumbnail (multipart, field: `thumbnail`) |

---

### Coupons

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/courses/:id/coupons` | `getCoupons` | List all discount coupons for a course |
| POST | `/courses/:id/coupons` | `saveCoupons` | Save/replace coupon list for a course |

**saveCoupons body:**
```json
{
  "coupons": [
    { "code": "SAVE20", "type": "percentage", "value": 20, "max_uses": 100 }
  ]
}
```

---

### Course Builder — Modules / Sections

Both `/sections/` and `/modules/` aliases work interchangeably for frontend compatibility.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/courses/:courseId/sections` | `getModules` | List all modules for a course |
| GET | `/courses/:courseId/modules` | `getModules` | Alias for above |
| POST | `/courses/:courseId/sections` | `addModule` | Add a new module |
| POST | `/courses/:courseId/modules` | `addModule` | Alias for above |
| PATCH / PUT | `/sections/:id` | `updateModule` | Edit module title / description / order |
| DELETE | `/sections/:id` | `deleteModule` | Delete a module (cascades to lessons) |
| PATCH / PUT | `/modules/:id` | `updateModule` | Alias for above |
| DELETE | `/modules/:id` | `deleteModule` | Alias for above |

---

### Course Builder — Lessons / Videos

Three ways to add a lesson:
1. **JSON stub** — creates a placeholder lesson with no file (used for quizzes/articles too)
2. **JSON with URL** — links a YouTube/Vimeo URL to a module without uploading
3. **Multipart file upload** — streams a video file to disk for any size

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/sections/:sectionId/lessons` | `getVideos` | List lessons in a section/module |
| GET | `/modules/:moduleId/videos` | `getVideos` | Alias for above |
| POST | `/sections/:sectionId/lessons` | `addLesson` | Add lesson via JSON (title, type, order) |
| POST | `/modules/:moduleId/videos` | `addVideoJson` | Add lesson via JSON with optional `video_url` |
| POST | `/modules/:moduleId/videos/upload` | `addVideo` | **Upload video file** (multipart, any size up to 50 GB) |
| PATCH / PUT | `/lessons/:id` | `updateVideo` | Update lesson metadata (title, description, order, preview flag) |
| DELETE | `/lessons/:id` | `deleteVideo` | Delete a lesson |
| PATCH / PUT | `/videos/:id` | `updateVideo` | Alias for above |
| DELETE | `/videos/:id` | `deleteVideo` | Alias for above |
| POST | `/lessons/:id/upload-video` | `uploadLessonVideo` | **Replace video** on an existing lesson (multipart) |
| POST | `/lessons/:id/video-url` | `saveLessonVideoUrl` | Save an external video URL to an existing lesson |

**Upload video request (multipart):**
```
POST /api/v1/instructor/modules/:moduleId/videos/upload
Content-Type: multipart/form-data
Field: video (file)
Field: title (string)
Field: is_preview (0 or 1)
```

---

### Students

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/students` | `getMyStudents` | List all enrolled students across all courses |
| GET | `/students/:id` | `getStudentDetail` | Get detailed info for a specific student |

---

### Quizzes

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/quizzes` | `getQuizzes` | List all quizzes |
| POST | `/quizzes` | `createQuiz` | Create a new quiz |
| GET | `/quizzes/:id` | `getQuiz` | Get quiz with questions and options |
| PATCH / PUT | `/quizzes/:id` | `updateQuiz` | Edit quiz |
| PATCH / PUT | `/quizzes/:id/publish` | `publishQuiz` | Publish a quiz |
| DELETE | `/quizzes/:id` | `deleteQuiz` | Delete a quiz |

---

### Assignments

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/assignments` | `getAssignments` | List all assignments |
| POST | `/assignments` | `createAssignment` | Create assignment (optional file attachment, max 20 MB) |
| GET | `/assignments/:id` | `getAssignment` | Get assignment detail |
| PATCH / PUT | `/assignments/:id` | `updateAssignment` | Edit assignment |
| DELETE | `/assignments/:id` | `deleteAssignment` | Delete assignment |
| GET | `/submissions` | `getSubmissions` | List student submissions (filterable) |
| POST | `/submissions/:id/grade` | `gradeSubmission` | Grade a submission (score + feedback) |
| DELETE | `/submissions/:id` | `deleteSubmission` | Delete a submission |

---

### Live Sessions

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/live-sessions` | `getLiveSessions` | List sessions (filterable by `?status=`) |
| POST | `/live-sessions` | `createLiveSession` | Schedule a live session |
| GET | `/live-sessions/:id` | `getLiveSession` | Get session detail |
| PATCH / PUT | `/live-sessions/:id` | `updateLiveSession` | Edit session details |
| DELETE | `/live-sessions/:id` | `deleteLiveSession` | Cancel / delete a session |
| PATCH / PUT | `/live-sessions/:id/start` | `startLiveSession` | Mark session status as `live` |
| PATCH / PUT | `/live-sessions/:id/end` | `endLiveSession` | Mark session status as `ended` |

---

### Analytics & Earnings

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/analytics` | `getAnalytics` | Enrollment trends, ratings, revenue (optional `?days=`) |
| GET | `/earnings` | `getEarnings` | Earnings history and summary |

---

### Messages

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/messages/rooms` | `getMessageRooms` | List all chat rooms |
| POST | `/messages/rooms` | `createRoom` | Create or find a room with another user |
| GET | `/messages/:roomId` | `getMessages` | Get messages in a room |
| POST | `/messages/:roomId` | `sendMessage` | Send a message |
| PATCH / PUT | `/messages/:roomId/read` | `markMessagesRead` | Mark all messages in room as read |

---

### Profile

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/profile` | `getProfile` | Get instructor profile |
| PATCH / PUT | `/profile` | `updateProfile` | Update profile fields |
| PATCH / PUT | `/profile/password` | `updatePassword` | Change password |
| POST | `/profile/avatar` | `updateAvatar` | Upload avatar (multipart, field: `avatar`, max 5 MB) |

---

## Upload Path Summary

Uploaded files are stored under the `uploads/` directory at the project root and served statically by Express:

| Type | Disk Path | URL |
|---|---|---|
| Course thumbnails | `uploads/thumbnails/<filename>` | `/uploads/thumbnails/<filename>` |
| Lesson videos | `uploads/videos/<filename>` | `/uploads/videos/<filename>` |
| Assignment files | `uploads/assignments/<filename>` | `/uploads/assignments/<filename>` |
| Instructor avatars | `uploads/avatars/<filename>` | `/uploads/avatars/<filename>` |

---

## Dependencies

| Package | Purpose |
|---|---|
| `express` | Router |
| `multer` | Multipart/form-data file parsing and disk storage |
| `path` | Path utilities for storage directory construction |
| `fs` | Auto-create upload directories if missing |
| `./instructor.controller` | Request handler functions |
| `../auth/auth.middleware` | `protect`, `restrictTo` |
