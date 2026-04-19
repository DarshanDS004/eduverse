# `student.controller.js` — Student HTTP Request Handler

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `student.controller.js` |
| **Location** | `modules/student/student.controller.js` |
| **File Type** | Controller (HTTP Request Handler) |
| **Project** | EduVerse |

**Purpose:** This file handles all HTTP requests made by authenticated student users. It delegates all business logic to `student.service.js` and formats HTTP responses. It covers student dashboard, courses, assignments, performance, profile management, calendar, lesson progress, activity, and notifications.

---

## 2. Responsibility

The student controller's responsibilities:
- Extract parameters from `req.body`, `req.params`, `req.query`, and `req.file`.
- Perform lightweight field validation (e.g., missing required fields).
- Call the appropriate `student.service.js` function.
- Return standardized success or error responses.
- Forward unexpected errors to Express's global error handler.

**Why this file exists:** Keeps HTTP-layer logic (request parsing, response formatting) separate from business logic (database queries, calculations) in the student module.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `service` | `./student.service` | All student business logic and DB operations |
| `sendSuccess` | `../../shared/errorHandler` | Sends standardized success JSON responses |
| `sendError` | `../../shared/errorHandler` | Sends standardized error JSON responses |

---

## 4. Core Logic Breakdown

Every function follows the same pattern:
```
try {
  [extract params from req]
  [optional: validate required fields]
  const data = await service.functionName(params);
  return sendSuccess(res, statusCode, message, data);
} catch (err) { next(err); }
```

The controller never performs DB operations or business calculations. It is entirely a delegation layer.

---

## 5. Functions / Methods

### `getDashboard(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/dashboard` |
| **Source** | `req.user.id` (from JWT middleware) |
| **Response** | 200 with dashboard data (stats, courses, assignments, sessions, activity, notifications) |

Passes the student's user ID to `service.getDashboard()`. No request parameters needed — everything is derived from the authenticated user.

---

### `getCourses(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/courses` |
| **Source** | `req.user.id` |
| **Response** | 200 with array of enrolled courses with progress |

Fetches all courses the student is enrolled in.

---

### `getAssignments(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/assignments` |
| **Source** | `req.user.id` |
| **Response** | 200 with array of assignments with submission status |

Fetches all assignments across all enrolled courses with submission status.

---

### `submitAssignment(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/student/assignments/:id/submit` |
| **Source** | `req.user.id`, `req.params.id`, `req.body.text`, `req.file` (multer) |
| **Response** | 200 with `{ message, is_late }` |

**Special handling for file uploads:**
```js
const fileUrl  = req.file ? '/uploads/assignments/' + req.file.filename : null;
const fileName = req.file ? req.file.originalname : null;
```
- If a file was uploaded via multer, builds the server path from `req.file.filename`.
- Both file and text submissions are supported; either can be null.
- `req.params.id` is the assignment ID.

---

### `getPerformance(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/performance` |
| **Source** | `req.user.id`, `req.query.days` |
| **Response** | 200 with performance stats, score trends, subject scores, recent quizzes, assignment grades |

`req.query.days` controls the time window for trend data (defaults to 30 in service).

---

### `getProfile(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/profile` |
| **Source** | `req.user.id` |
| **Response** | 200 with full student profile |

---

### `updateProfile(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | PATCH |
| **Route** | `/api/student/profile` |
| **Source** | `req.user.id`, `req.body` (name, phone, dob, grade, bio, etc.) |
| **Response** | 200 with `{ message, user }` |

Passes the entire `req.body` to service — service handles null-safety with `COALESCE`.

---

### `updatePassword(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | PATCH |
| **Route** | `/api/student/profile/password` |
| **Source** | `req.user.id`, `req.body.current_password`, `req.body.new_password` |
| **Response** | 200 with `{ message }` |

**Validation:** Returns `400 MISSING_FIELDS` if either `current_password` or `new_password` is absent — this is the only controller in the student module that performs inline field validation.

---

### `updateAvatar(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/student/profile/avatar` |
| **Source** | `req.user.id`, `req.file` (multer avatar upload) |
| **Response** | 200 with `{ message, avatar_url }` |

**Validation:** Returns `400 NO_FILE` if no file was uploaded. Builds the avatar URL from `req.file.filename`.

---

### `getCalendar(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/calendar` |
| **Source** | `req.user.id`, `req.query.year`, `req.query.month` |
| **Response** | 200 with calendar events (assignments, live sessions, quizzes) |

Year and month query parameters are optional (service defaults to current month).

---

### `updateLessonProgress(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/student/lessons/:id/progress` |
| **Source** | `req.user.id`, `req.params.id`, `req.body.progress`, `req.body.watched_seconds` |
| **Response** | 200 with `{ message, completed }` |

**Normalization logic:**
```js
const seconds = watched_seconds || (progress ? progress * 60 : 0);
```
Accepts either `watched_seconds` (preferred, exact) or `progress` percentage (legacy, converted to seconds by multiplying by 60). This provides backward compatibility for older clients.

---

### `getActivity(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/activity` |
| **Source** | `req.user.id`, `req.query.limit` |
| **Response** | 200 with recent activity events |

---

### `getNotifications(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/student/notifications` |
| **Source** | `req.user.id` |
| **Response** | 200 with notification list |

---

### `markNotifRead(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | PATCH |
| **Route** | `/api/student/notifications/:id/read` |
| **Source** | `req.user.id`, `req.params.id` |
| **Response** | 200 with `{ message }` |

---

### `markAllRead(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | PATCH |
| **Route** | `/api/student/notifications/mark-all-read` |
| **Source** | `req.user.id` |
| **Response** | 200 with `{ message }` |

---

## 6. API Role

All routes are mounted under a base path (e.g., `/api/student`) and require `protect` + `restrictTo('student')` middleware applied globally in `student.routes.js`.

| Controller Function | Method | Path |
|---|---|---|
| `getDashboard` | GET | `/dashboard` |
| `getCourses` | GET | `/courses` |
| `getAssignments` | GET | `/assignments` |
| `submitAssignment` | POST | `/assignments/:id/submit` |
| `getPerformance` | GET | `/performance` |
| `getProfile` | GET | `/profile` |
| `updateProfile` | PATCH | `/profile` |
| `updatePassword` | PATCH | `/profile/password` |
| `updateAvatar` | POST | `/profile/avatar` |
| `getCalendar` | GET | `/calendar` |
| `updateLessonProgress` | POST | `/lessons/:id/progress` |
| `getActivity` | GET | `/activity` |
| `getNotifications` | GET | `/notifications` |
| `markNotifRead` | PATCH | `/notifications/:id/read` |
| `markAllRead` | PATCH | `/notifications/mark-all-read` |

---

## 8. Data Flow

```
HTTP Request (with Bearer token)
        │
        ▼
protect + restrictTo('student') middleware
        │
        ▼
student.controller.*()
        │   [req.user.id, req.params, req.body, req.query, req.file]
        ▼
student.service.*()
        │
        ▼
MySQL DB response
        │
        ▼
sendSuccess(res, 200, message, data)
        │
        ▼
HTTP Response (JSON)
```

---

## 9. Connections

### Files That Call This File
- `modules/student/student.routes.js`

### Files This File Depends On
- `./student.service` — Business logic
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

---

## 10. Middleware / Auth

All middleware is applied in `student.routes.js`, not here:
- `protect` — verifies JWT and populates `req.user`
- `restrictTo('student')` — ensures only students access these routes
- `assignUpload.single('file')` — multer for `submitAssignment`
- `avatarUpload.single('avatar')` — multer for `updateAvatar`

By the time controller functions execute, `req.user` is guaranteed to be populated and `req.file` is available for file upload routes.

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Missing `current_password` or `new_password` | Inline `sendError(res, 400, ...)` |
| No file uploaded for avatar | Inline `sendError(res, 400, ...)` |
| Service throws `AppError` | Caught → `next(err)` → global error handler |
| Unexpected runtime error | Caught → `next(err)` → global error handler |

Only `updatePassword` and `updateAvatar` do inline field validation — other controllers trust the service to validate inputs.

---

## 12. Example Usage

### Submit an Assignment with File
```http
POST /api/student/assignments/12/submit
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

file: [binary]
text: "My assignment answer"
```

### Update Lesson Progress
```http
POST /api/student/lessons/55/progress
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{ "watched_seconds": 450 }
```

### Get Calendar for a Specific Month
```http
GET /api/student/calendar?year=2026&month=4
Authorization: Bearer eyJhbGci...
```

---

## 13. Edge Cases / Notes

- **`watched_seconds` vs `progress` normalization:** The controller accepts both formats and converts `progress` to seconds for backward compatibility.
- **File uploads are optional** in `submitAssignment` — both `fileUrl` and `fileName` are set to `null` if no file is present.
- **`markAllRead` vs `markNotifRead`:** Both use PATCH. `markAllRead` has no `:id` param.
- **`req.user.id` is the sole identifier** for all operations — students can only access their own data (enforced by the service passing `userId` to all queries).

---

## 14. Summary

`student.controller.js` is the HTTP request handler for all 15 student-specific API endpoints in EduVerse. It extracts request parameters (including multer file uploads), performs minimal validation, delegates all logic to `student.service.js`, and returns standardized JSON responses. It contains no database logic or business rules — it is purely a delegation and formatting layer.
