# `student.routes.js` — Student Route Definitions & File Upload Configuration

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `student.routes.js` |
| **Location** | `modules/student/student.routes.js` |
| **File Type** | Route Definition + Multer Configuration |
| **Project** | EduVerse |

**Purpose:** This file defines all HTTP routes available to authenticated student users. It also configures two separate Multer file upload handlers — one for assignment submissions and one for avatar uploads — and applies global authentication/authorization middleware to all student routes.

---

## 2. Responsibility

- Register all student-specific Express routes.
- Apply `protect` + `restrictTo('student')` globally to all routes in this router.
- Configure and apply Multer disk storage for two distinct upload types:
  - **Assignment files** (up to 20MB, any extension)
  - **Avatar images** (up to 5MB, image types only)
- Ensure upload directories exist at startup.
- Export the configured router for mounting in the main app.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework, provides `Router()` |
| `multer` | `multer` | Multipart form data parser for file uploads |
| `path` | Node.js built-in | Constructs file paths for upload destinations |
| `fs` | Node.js built-in | Creates upload directories if they don't exist |
| `controller` | `./student.controller` | All student route handler functions |
| `protect` | `../auth/auth.middleware` | JWT verification middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control middleware |

---

## 4. Core Logic Breakdown

### Step 1 — Global Middleware Application
```js
router.use(protect);
router.use(restrictTo('student'));
```
These two lines apply to **every route** registered on this router. No student route is accessible without:
1. A valid JWT access token.
2. The user having the `'student'` role.

### Step 2 — Directory Initialization
```js
const assignDir = path.join(__dirname, '../../../uploads/assignments');
if (!fs.existsSync(assignDir)) fs.mkdirSync(assignDir, { recursive: true });

const avatarDir = path.join(__dirname, '../../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
```
Directories are created **at module load time** (when the server starts). `{ recursive: true }` means nested directories are created if needed. This prevents multer from failing when trying to write to a non-existent path.

### Step 3 — Multer Configuration (Two Instances)
Two separate multer instances are created with different configurations:
- `assignUpload` — for assignment file submissions
- `avatarUpload` — for profile picture uploads

### Step 4 — Route Registration
Routes are registered in logical groups: dashboard, courses, assignments, performance, profile, calendar, lesson progress, activity, notifications.

---

## 5. Multer Configuration Details

### Assignment Upload (`assignUpload`)

```js
const assignUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, assignDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'assign-' + Date.now() + ext);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
```

| Property | Value | Details |
|---|---|---|
| Storage | Disk | Files saved to `uploads/assignments/` |
| Filename | `assign-{timestamp}.{ext}` | Timestamp prevents name collisions |
| File size limit | 20MB | Rejects larger files |
| File type filter | None | Any file type accepted |

**Usage:** Applied to `POST /assignments/:id/submit` as `assignUpload.single('file')`.

### Avatar Upload (`avatarUpload`)

```js
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, 'avatar-' + req.user.id + '-' + Date.now() + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
```

| Property | Value | Details |
|---|---|---|
| Storage | Disk | Files saved to `uploads/avatars/` |
| Filename | `avatar-{userId}-{timestamp}.{ext}` | Includes user ID for traceability |
| File size limit | 5MB | Stricter limit than assignments |
| File type filter | `.jpg`, `.jpeg`, `.png`, `.webp` | Rejects non-image files silently |

**Usage:** Applied to `POST /profile/avatar` as `avatarUpload.single('avatar')`.

---

## 6. Route Map

All routes below are prefixed with `/api/student` (assumed mount path) and all require `protect` + `restrictTo('student')`.

| Method | Path | Middleware | Controller |
|---|---|---|---|
| GET | `/dashboard` | — | `getDashboard` |
| GET | `/courses` | — | `getCourses` |
| GET | `/assignments` | — | `getAssignments` |
| POST | `/assignments/:id/submit` | `assignUpload.single('file')` | `submitAssignment` |
| GET | `/performance` | — | `getPerformance` |
| GET | `/profile` | — | `getProfile` |
| PATCH | `/profile` | — | `updateProfile` |
| PATCH | `/profile/password` | — | `updatePassword` |
| POST | `/profile/avatar` | `avatarUpload.single('avatar')` | `updateAvatar` |
| GET | `/calendar` | — | `getCalendar` |
| POST | `/lessons/:id/progress` | — | `updateLessonProgress` |
| GET | `/activity` | — | `getActivity` |
| GET | `/notifications` | — | `getNotifications` |
| PATCH | `/notifications/mark-all-read` | — | `markAllRead` |
| PATCH | `/notifications/:id/read` | — | `markNotifRead` |

**Note on route ordering for notifications:**
```js
router.patch('/notifications/mark-all-read', controller.markAllRead);  // ← Registered FIRST
router.patch('/notifications/:id/read',       controller.markNotifRead); // ← Registered SECOND
```
`/mark-all-read` must be registered before `/:id/read`. Otherwise Express would match `mark-all-read` as a value for `:id` and call the wrong handler.

---

## 8. Data Flow

```
HTTP Request (multipart or JSON)
        │
        ▼
Global: protect middleware (JWT verification)
        │
        ▼
Global: restrictTo('student') (role check)
        │
        ▼
Route-specific multer middleware (file routes only)
        │   → Saves file to disk
        │   → Populates req.file
        ▼
student.controller.*()
        │
        ▼
student.service.*()
        │
        ▼
HTTP Response
```

---

## 9. Connections

### Files That Call This File
- Main app entry point (e.g., `app.js`) — mounts this router at `/api/student`.

### Files This File Depends On
- `./student.controller` — Route handlers
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `multer` — File upload handling
- `path`, `fs` — Directory and file path utilities

---

## 10. Middleware / Auth

| Middleware | Scope | Behavior |
|---|---|---|
| `protect` | All routes (via `router.use`) | Verifies JWT, populates `req.user` |
| `restrictTo('student')` | All routes (via `router.use`) | Blocks non-student roles with 403 |
| `assignUpload.single('file')` | `POST /assignments/:id/submit` only | Parses multipart, saves file to disk |
| `avatarUpload.single('avatar')` | `POST /profile/avatar` only | Parses multipart, filters type, saves image |

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Invalid/missing JWT | `protect` returns `401` JSON error |
| Non-student role | `restrictTo` returns `403` JSON error |
| File exceeds size limit | Multer throws error, caught by Express error middleware |
| Invalid avatar file type | `fileFilter` calls `cb(null, false)` — file is rejected silently (multer sets `req.file` to undefined) |
| Upload directory missing | Handled at startup via `fs.mkdirSync` — never missing at request time |

---

## 12. Example Usage

### Assignment Submission (multipart)
```http
POST /api/student/assignments/7/submit
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

file: [binary PDF/DOCX]
text: "See attached document"
```

### Avatar Upload (multipart)
```http
POST /api/student/profile/avatar
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

avatar: [binary JPEG]
```

### Mounting in app.js (assumed pattern)
```js
const studentRoutes = require('./modules/student/student.routes');
app.use('/api/student', studentRoutes);
```

---

## 13. Edge Cases / Notes

- **Avatar `fileFilter` behavior:** When a disallowed extension is uploaded, `cb(null, false)` is called (not `cb(new Error(...), false)`). This means the file is silently rejected and `req.file` is `undefined`. The controller handles this with a `400 NO_FILE` error.
- **No assignment file type filter:** Assignment uploads accept any file extension — only size is restricted. This could be tightened if submission type control is needed.
- **`req.user.id` in avatar filename:** Avatar filenames include the student's user ID, making them traceable but also predictable. Old avatars are not deleted when a new one is uploaded — orphaned files accumulate over time.
- **Directory creation at startup:** `fs.existsSync` + `fs.mkdirSync` runs once when the module is loaded. This is synchronous and appropriate for startup initialization.

---

## 14. Summary

`student.routes.js` is the routing and file-upload configuration file for the EduVerse student module. It applies global JWT authentication and student-role restriction to all 15 routes, configures two distinct Multer disk storage handlers for assignment files (20MB, any type) and avatar images (5MB, images only), ensures upload directories exist at startup, and registers all student API routes mapping to their respective controller functions.
