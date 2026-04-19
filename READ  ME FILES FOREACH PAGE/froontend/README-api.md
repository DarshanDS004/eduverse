# api.js — Unified Frontend API Client

## Overview

`api.js` is the **frontend JavaScript API client** for EduVerse. It is exposed as a global `window.Api` object and acts as the single communication layer between all frontend pages and the backend REST API. Every network request made by the frontend goes through this module.

**File path:** `frontend/api.js` (loaded via `<script>` tag on every page)  
**Exposed as:** `window.Api`

---

## Features

| Feature | Description |
|---|---|
| Bulletproof JSON parsing | Reads response as text first, never throws raw JSON errors |
| Empty response handling | Gracefully handles 204 No Content and empty server responses |
| Automatic JWT attachment | Injects `Authorization: Bearer <token>` on every request |
| Silent token refresh | On 401, silently refreshes the access token and replays the request |
| Concurrent refresh queue | Multiple in-flight requests during a refresh are parked and replayed together |
| Auto-logout on 401 | Redirects to `/pages/auth/login.html?reason=session_expired` on unrecoverable auth failure |
| One-time network retry | Retries once on `NETWORK_ERROR` before failing |
| Request cancellation | `Api.cancelToken()` returns an AbortController-backed cancel token |
| Configurable timeout | Default 30 seconds; set to 0 for upload requests |
| XHR-based file upload | Real-time progress %, speed (bytes/sec), and abort support |
| Specific HTTP error messages | Friendly messages for 404, 413, 403, 502/503, 5xx |
| Named endpoint groups | Organized namespaces: `Api.auth`, `Api.instructor`, `Api.student`, etc. |

---

## Configuration

```js
const CONFIG = {
  baseUrl:       'http://localhost:5000/api/v1',
  timeout:       30000,   // 30 seconds; 0 for uploads
  retryAttempts: 1,
  retryDelay:    1000,    // ms before retry
};
```

Change the `baseUrl` at runtime for production:
```js
Api.config.baseUrl = 'https://api.eduverse.com/api/v1';
```

---

## Custom Error Class — `ApiError`

All errors thrown by this module are instances of `ApiError`:

| Property | Type | Description |
|---|---|---|
| `message` | string | Human-readable description |
| `status` | number | HTTP status code (0 = network/parse error) |
| `code` | string | Machine-readable code (e.g. `SESSION_EXPIRED`, `NOT_FOUND`) |
| `data` | any | Raw response body if available |

**Common error codes:**

| Code | Meaning |
|---|---|
| `SESSION_EXPIRED` | 401 — token refresh failed |
| `NOT_FOUND` | 404 — API route doesn't exist |
| `FILE_TOO_LARGE` | 413 — file exceeds server limit |
| `SERVER_UNAVAILABLE` | 502 / 503 — backend down |
| `EMPTY_RESPONSE` | Server returned no body |
| `INVALID_JSON` | Server returned HTML instead of JSON |
| `NETWORK_ERROR` | Cannot reach server |
| `REQUEST_CANCELLED` | `AbortController.abort()` was called |

---

## Core HTTP Methods

```js
Api.get(endpoint, params?, opts?)        // GET with optional query string
Api.post(endpoint, body?, opts?)         // POST with JSON body
Api.put(endpoint, body?, opts?)          // PUT with JSON body
Api.patch(endpoint, body?, opts?)        // PATCH with JSON body
Api.delete(endpoint, opts?)              // DELETE
Api.uploadSimple(endpoint, formData)     // POST with FormData, no progress
```

---

## File Upload — XHR with Progress

For large files (e.g. course videos), use `Api.upload()`:

```js
Api.upload(endpoint, file, {
  fieldName:   'video',          // FormData field name (default: 'file')
  extraFields: { title: 'Intro', is_preview: '0' },
  onProgress:  (percent, speedBps) => { /* update UI */ },
  onAbortReady: (abortFn) => { window._cancelUpload = abortFn; },
})
```

- Uses `XMLHttpRequest` (not `fetch`) so `xhr.upload.onprogress` fires
- `xhr.timeout = 0` — no timeout limit for large uploads
- Reports real-time percentage and bytes-per-second speed

---

## Request Cancellation

```js
const token = Api.cancelToken();

// Pass signal to any request
Api.get('/courses', params, { signal: token.signal });

// Cancel it
token.cancel();
```

---

## Token Storage

Tokens are read from and written to (in priority order):
1. `window.Store` (if available) — `Store.get('auth.token')`
2. `window.Utils.storage` (if available)
3. `localStorage` — keys: `ev_token`, `ev_refresh_token`

---

## Token Refresh Flow

1. A request returns HTTP 401
2. If a refresh is already in progress, the request is added to `_refreshQueue`
3. A single `POST /auth/refresh` call is made with the stored refresh token
4. On success: all queued requests are replayed with the new token
5. On failure: all queued requests are rejected, tokens are cleared, user is redirected to login

---

## Named Endpoint Groups

### `Api.auth`
| Method | Endpoint | Description |
|---|---|---|
| `login(data)` | `POST /auth/login` | Log in |
| `register(data)` | `POST /auth/register` | Register new account |
| `logout()` | `POST /auth/logout` | Log out |
| `me()` | `GET /auth/me` | Get current user |
| `forgotPassword(email)` | `POST /auth/forgot-password` | Request reset email |
| `resetPassword(data)` | `POST /auth/reset-password` | Reset with token |
| `verifyEmail(token)` | `POST /auth/verify-email` | Confirm email address |
| `changePassword(data)` | `PATCH /auth/change-password` | Update password |
| `uploadAvatar(file, onProgress)` | `POST /auth/avatar` | Upload profile photo |

### `Api.student`
| Method | Description |
|---|---|
| `dashboard()` | Fetch student dashboard data |
| `courses(params)` | List available courses |
| `enrolledCourses()` | Get enrolled courses |
| `enroll(courseId)` | Enroll in a course |
| `progress(courseId)` | Get course completion progress |
| `updateProgress(lessonId, data)` | Update video watch progress |
| `performance(params)` | Get grades and quiz performance |
| `certificates()` | List earned certificates |
| `assignments(params)` | List assignments |
| `submitAssignment(id, data)` | Submit assignment |
| `attendance(params)` | View attendance records |
| `fees()` | View pending/paid fees |
| `payFee(data)` | Pay a fee |
| `profile()` | Get profile |
| `updateProfile(data)` | Update profile |

### `Api.instructor`
| Method | Description |
|---|---|
| `dashboard()` | Fetch instructor dashboard |
| `courses(params)` | List own courses |
| `getCourse(id)` | Get course detail |
| `createCourse(data)` | Create a new course |
| `updateCourse(id, data)` | Update course metadata |
| `deleteCourse(id)` | Delete course |
| `publishCourse(id)` | Publish course |
| `uploadThumbnail(id, file, onProgress)` | Upload course thumbnail |
| `getCoupons(courseId)` | Get coupons for a course |
| `saveCoupons(courseId, coupons)` | Save coupon list |
| `sections(courseId)` / `getModules(courseId)` | Get course modules |
| `addModule(courseId, data)` | Add a module |
| `updateModule(id, data)` | Edit a module |
| `deleteModule(id)` | Delete a module |
| `lessons(sectionId)` / `getLessons(moduleId)` | Get lessons in a module |
| `addLesson(moduleId, data)` | Add a lesson (JSON) |
| `updateLesson(id, data)` | Edit lesson metadata |
| `deleteLesson(id)` | Delete a lesson |
| `uploadVideo(lessonId, file, onProgress)` | Upload video to existing lesson |
| `uploadVideoToModule(moduleId, file, title, isPreview, onProgress)` | Upload video as new lesson |
| `saveLessonUrl(id, url)` | Set YouTube/Vimeo URL on lesson |
| `students(params)` | List enrolled students |
| `quizzes(params)` | List quizzes |
| `createQuiz(data)` | Create a quiz |
| `assignments(params)` | List assignments |
| `createAssignment(data)` | Create an assignment |
| `gradeSubmission(id, data)` | Grade a student submission |
| `liveSessions(params)` | List live sessions |
| `createLiveSession(data)` | Schedule a live session |
| `updateLiveSession(id, data)` | Edit live session |
| `endSession(id)` | Mark session as ended |
| `analytics(params)` | Fetch analytics data |
| `earnings(params)` | Fetch earnings data |
| `rooms()` | Get message rooms |
| `sendMessage(roomId, text)` | Send a message |
| `profile()` | Get own profile |
| `updateProfile(data)` | Update profile |
| `updatePassword(data)` | Change password |

### `Api.parent`
| Method | Description |
|---|---|
| `children()` | List linked children |
| `childProgress(id, params)` | Get child's course progress |
| `childAttendance(id, params)` | Get child's attendance |
| `childResults(id, params)` | Get child's exam results |
| `fees(childId)` | View child's fees |
| `meetings(params)` | List PTM meetings |
| `bookMeeting(data)` | Book a parent-teacher meeting |

### `Api.institute`
| Method | Description |
|---|---|
| `dashboard()` | Institute dashboard |
| `students(params)` | Manage students |
| `teachers(params)` | Manage teachers |
| `classes(params)` | Manage classes |
| `timetable(params)` | View/save timetable |
| `attendance(params)` | View/mark attendance |
| `fees(params)` | Manage fee records |
| `uploadResults(file, onProgress)` | Import exam results |
| `issueCertificate(data)` | Issue a certificate |

### `Api.superadmin`
| Method | Description |
|---|---|
| `institutes(params)` | List all institutes |
| `toggleInstitute(id, status)` | Approve/suspend institute |
| `users(params)` | List all users |
| `toggleUser(id, status)` | Activate/deactivate user |
| `courses(params)` | List all courses |
| `toggleCourse(id, status)` | Publish/suspend course |
| `revenue(params)` | Platform revenue data |
| `settings()` / `updateSettings(data)` | Platform settings |
| `support(params)` | Support tickets |
| `replySupport(id, data)` | Reply to ticket |
| `logs(params)` | Audit logs |

### `Api.courses` (Public Catalog)
| Method | Description |
|---|---|
| `list(params)` | Browse public courses |
| `detail(id)` | Get course detail |
| `categories()` | List categories |
| `enroll(id)` | Enroll in a course |
| `submitReview(id, data)` | Submit a course review |

### Other Groups
- `Api.quizzes` — start, submit, get results
- `Api.discussions` — list, post, reply, like, delete
- `Api.notifications` — list, mark read, preferences
- `Api.payments` — initiate, verify, history, refund
- `Api.messages` — rooms, messages, send, mark read, upload attachment
- `Api.liveSessions` — list, detail, join, leave, token, recordings
- `Api.certificates` — list, download, verify by code

---

## Dependencies

- Optional: `window.Store` — reactive state store for token management
- Optional: `window.Utils` — utility helpers (storage abstraction, sleep)
- Both degrade gracefully: falls back to `localStorage` if not present

---

## Usage Example

```js
// Login
const result = await Api.auth.login({ email: 'user@example.com', password: 'secret' });

// Fetch courses
const { data } = await Api.instructor.courses({ page: 1 });

// Upload a video with progress
await Api.instructor.uploadVideo(lessonId, videoFile, (pct, speed) => {
  console.log(`${pct}% at ${(speed / 1024).toFixed(1)} KB/s`);
});

// Cancel a request
const token = Api.cancelToken();
Api.get('/courses', {}, { signal: token.signal });
token.cancel();

// Error handling
try {
  await Api.courses.enroll(courseId);
} catch (err) {
  if (err instanceof Api.ApiError) {
    console.error(err.code, err.message, err.status);
  }
}
```
