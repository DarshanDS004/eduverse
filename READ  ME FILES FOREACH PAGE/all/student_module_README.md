# Student Module — Documentation

## 1. MODULE OVERVIEW

The student module provides a comprehensive dashboard and profile management system for authenticated student users.

**Files Included:**
- `student.controller.js` — HTTP request handlers
- `student.routes.js` — Route definitions with file upload
- `student.service.js` — Business logic (referenced but not provided)

**Purpose:** Enable students to view courses, submit assignments, track performance, manage profiles, and access notifications.

---

# STUDENT.CONTROLLER.JS

## 1. FILE OVERVIEW

**File Name:** `student.controller.js`  
**File Type:** Express Controller  
**Purpose:** Handle 14 HTTP endpoints for student operations including dashboard, courses, assignments, performance, profile, and notifications.

---

## 2. EXPORTS & FUNCTIONS

### 1. `getDashboard(req, res, next)`

**Purpose:** Return personalized student dashboard with summary data.

**Returns (200):**
```json
{
  "data": {
    "courses": [{ enrolled courses summary }],
    "upcoming_assignments": [{ next assignments }],
    "recent_activity": [{ recent events }]
  }
}
```

**Calls:** `service.getDashboard(userId)`

---

### 2. `getCourses(req, res, next)`

**Purpose:** List all courses the student is enrolled in.

**Returns (200):**
```json
{
  "data": [
    {
      "id": 42,
      "title": "Python 101",
      "instructor": "John Doe",
      "progress": 65,
      "enrolled_date": "2024-01-01"
    }
  ]
}
```

**Calls:** `service.getCourses(userId)`

---

### 3. `getAssignments(req, res, next)`

**Purpose:** Retrieve assignments for enrolled courses.

**Returns (200):**
```json
{
  "data": [
    {
      "id": 100,
      "title": "Python Project",
      "course_title": "Python 101",
      "due_date": "2024-02-15",
      "status": "pending"
    }
  ]
}
```

**Calls:** `service.getAssignments(userId)`

---

### 4. `submitAssignment(req, res, next)`

**Purpose:** Submit assignment with optional file upload and text content.

**Parameters:**
- `req.params.id` — Assignment ID
- `req.body.text` — Text submission (optional)
- `req.file` — Uploaded file (optional, multer parsed)

**Returns (200):**
```json
{
  "message": "Assignment submitted successfully",
  "data": { submission details }
}
```

**Logic:**
```javascript
const { text } = req.body;
const fileUrl  = req.file ? '/uploads/assignments/' + req.file.filename : null;
const fileName = req.file ? req.file.originalname : null;
const data     = await service.submitAssignment(
  req.user.id, req.params.id, text, fileUrl, fileName
);
```

**File Upload Configuration:**
- Max file size: 20 MB
- Stored in: `uploads/assignments/`
- Filename format: `assign-{timestamp}.{ext}`

**Calls:** `service.submitAssignment(userId, assignmentId, text, fileUrl, fileName)`

---

### 5. `getPerformance(req, res, next)`

**Purpose:** Return student performance metrics over time.

**Query Parameters:**
- `days` — Performance period (e.g., 30 for last 30 days)

**Returns (200):**
```json
{
  "data": {
    "average_score": 78,
    "quiz_attempts": 15,
    "assignments_completed": 8,
    "trend": [{ daily metrics }]
  }
}
```

**Calls:** `service.getPerformance(userId, days)`

---

### 6. `getProfile(req, res, next)`

**Purpose:** Retrieve student profile information.

**Returns (200):**
```json
{
  "data": {
    "id": 100,
    "email": "student@example.com",
    "full_name": "John Student",
    "phone": "9876543210",
    "bio": "...",
    "photo_url": "/uploads/avatars/avatar-100.jpg"
  }
}
```

**Calls:** `service.getProfile(userId)`

---

### 7. `updateProfile(req, res, next)`

**Purpose:** Update student profile fields.

**Request Body:**
```json
{
  "full_name": "John Doe",
  "phone": "9876543210",
  "bio": "Aspiring developer"
}
```

**Returns (200):**
```json
{
  "message": "Profile updated successfully",
  "data": { updated profile }
}
```

**Calls:** `service.updateProfile(userId, bodyData)`

---

### 8. `updatePassword(req, res, next)`

**Purpose:** Change student password with verification.

**Request Body:**
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass123"
}
```

**Validation:**
- Both fields required (returns 400 if missing)

**Returns (200):**
```json
{
  "message": "Password updated successfully"
}
```

**Calls:** `service.updatePassword(userId, currentPassword, newPassword)`

---

### 9. `updateAvatar(req, res, next)`

**Purpose:** Upload and update student profile photo.

**Parameters:**
- `req.file` — Image file (multer parsed)

**File Upload Configuration:**
- Accepted formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- Max file size: 5 MB
- Stored in: `uploads/avatars/`
- Filename format: `avatar-{userId}-{timestamp}.{ext}`

**Validation:**
- File required (returns 400 if missing)
- Extension validation in multer filter

**Returns (200):**
```json
{
  "message": "Avatar updated successfully",
  "data": { updated profile with new photo_url }
}
```

**Logic:**
```javascript
const photoUrl = '/uploads/avatars/' + req.file.filename;
const data     = await service.updateAvatar(userId, photoUrl);
```

**Calls:** `service.updateAvatar(userId, photoUrl)`

---

### 10. `getCalendar(req, res, next)`

**Purpose:** Get calendar view of deadlines and events.

**Query Parameters:**
- `year` — Year (e.g., 2024)
- `month` — Month (1-12)

**Returns (200):**
```json
{
  "data": {
    "month": 1,
    "year": 2024,
    "events": [
      {
        "day": 15,
        "title": "Python Project Due",
        "type": "deadline"
      }
    ]
  }
}
```

**Calls:** `service.getCalendar(userId, year, month)`

---

### 11. `updateLessonProgress(req, res, next)`

**Purpose:** Track lesson/video progress as student learns.

**Parameters:**
- `req.params.id` — Lesson/video ID

**Request Body:**
```json
{
  "progress": 65,           // Percentage (0-100)
  "watched_seconds": 1200   // Seconds watched (alternative)
}
```

**Logic:**
```javascript
const { progress, watched_seconds } = req.body;
const seconds = watched_seconds || (progress ? progress * 60 : 0);
const data    = await service.updateLessonProgress(userId, lessonId, seconds);
```

**Returns (200):**
```json
{
  "message": "Progress updated",
  "data": { updated progress }
}
```

**Calls:** `service.updateLessonProgress(userId, lessonId, watchedSeconds)`

---

### 12. `getActivity(req, res, next)`

**Purpose:** Retrieve activity feed (quiz attempts, assignments, etc.).

**Query Parameters:**
- `limit` — Number of activities to return

**Returns (200):**
```json
{
  "data": [
    {
      "id": 1,
      "type": "quiz_completed",
      "title": "Completed Python Quiz",
      "timestamp": "2024-01-20T15:30:00Z"
    }
  ]
}
```

**Calls:** `service.getActivity(userId, limit)`

---

### 13. `getNotifications(req, res, next)`

**Purpose:** Retrieve unread notifications for student.

**Returns (200):**
```json
{
  "data": [
    {
      "id": 200,
      "title": "Assignment Graded",
      "body": "Your assignment has been graded",
      "read": 0,
      "created_at": "2024-01-20T15:30:00Z"
    }
  ]
}
```

**Calls:** `service.getNotifications(userId)`

---

### 14. `markNotifRead(req, res, next)`

**Purpose:** Mark a specific notification as read.

**Parameters:**
- `req.params.id` — Notification ID

**Returns (200):**
```json
{
  "message": "Notification marked as read"
}
```

**Calls:** `service.markNotifRead(userId, notificationId)`

---

### 15. `markAllRead(req, res, next)`

**Purpose:** Mark all notifications as read.

**Returns (200):**
```json
{
  "message": "All notifications marked as read"
}
```

**Calls:** `service.markAllRead(userId)`

---

## 3. ERROR HANDLING

```javascript
// Pattern: Try-catch with next(e)
async function getDashboard(req, res, next) {
  try {
    const data = await service.getDashboard(req.user.id);
    return sendSuccess(res, 200, 'Dashboard loaded.', data);
  } catch (err) { next(err); }
}
```

All errors propagated to Express error middleware via `next(e)`.

---

# STUDENT.ROUTES.JS

## 1. FILE OVERVIEW

**File Name:** `student.routes.js`  
**File Type:** Express Router with Multer Integration  
**Purpose:** Define student endpoints with authentication, role restriction, and file upload handling.

---

## 2. AUTHENTICATION & SETUP

```javascript
router.use(protect);
router.use(restrictTo('student'));
```

**Requirements:**
- JWT authentication (protect middleware)
- Student role only (restrictTo middleware)

All routes are student-only and authenticated.

---

## 3. MULTER CONFIGURATION

### Assignment File Upload

```javascript
const assignUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, assignDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'assign-' + Date.now() + ext);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
```

**Configuration:**
- Destination: `uploads/assignments/` (created if not exist)
- Filename: `assign-{timestamp}.{extension}`
- Max size: 20 MB
- No file type restrictions

### Avatar Upload

```javascript
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, 'avatar-' + req.user.id + '-' + Date.now() + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext     = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
```

**Configuration:**
- Destination: `uploads/avatars/` (created if not exist)
- Filename: `avatar-{userId}-{timestamp}.{extension}`
- Max size: 5 MB
- Allowed formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- File type filtering enabled

---

## 4. ROUTE DEFINITIONS

```javascript
// Dashboard
router.get('/dashboard', controller.getDashboard);

// Courses
router.get('/courses', controller.getCourses);

// Assignments
router.get('/assignments', controller.getAssignments);
router.post('/assignments/:id/submit',
  assignUpload.single('file'),
  controller.submitAssignment
);

// Performance
router.get('/performance', controller.getPerformance);

// Profile
router.get('/profile',          controller.getProfile);
router.patch('/profile',        controller.updateProfile);
router.patch('/profile/password', controller.updatePassword);
router.post('/profile/avatar',
  avatarUpload.single('avatar'),
  controller.updateAvatar
);

// Calendar
router.get('/calendar', controller.getCalendar);

// Lesson progress
router.post('/lessons/:id/progress', controller.updateLessonProgress);

// Activity
router.get('/activity', controller.getActivity);

// Notifications
router.get('/notifications',                    controller.getNotifications);
router.patch('/notifications/mark-all-read',    controller.markAllRead);
router.patch('/notifications/:id/read',         controller.markNotifRead);
```

---

## 5. API ENDPOINTS SUMMARY

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Get dashboard summary |
| GET | `/courses` | List enrolled courses |
| GET | `/assignments` | Get course assignments |
| POST | `/assignments/:id/submit` | Submit assignment |
| GET | `/performance` | Performance metrics |
| GET | `/profile` | Get profile info |
| PATCH | `/profile` | Update profile |
| PATCH | `/profile/password` | Change password |
| POST | `/profile/avatar` | Upload avatar |
| GET | `/calendar` | Get calendar view |
| POST | `/lessons/:id/progress` | Track video progress |
| GET | `/activity` | Get activity feed |
| GET | `/notifications` | Get notifications |
| PATCH | `/notifications/mark-all-read` | Mark all as read |
| PATCH | `/notifications/:id/read` | Mark one as read |

---

## 6. DIRECTORY CREATION

```javascript
// Create uploads directories if they don't exist
const assignDir = path.join(__dirname, '../../../uploads/assignments');
if (!fs.existsSync(assignDir)) fs.mkdirSync(assignDir, { recursive: true });

const avatarDir = path.join(__dirname, '../../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
```

Ensures `uploads/assignments/` and `uploads/avatars/` directories exist before multer writes files.

---

## 7. SUMMARY

The student routes file:
1. Applies authentication and role middleware
2. Configures multer for two file upload types
3. Defines 15 endpoints for student operations
4. Creates necessary directories for file storage

All endpoints require authentication and student role.

---

# STUDENT.SERVICE.JS

## 1. OVERVIEW

**Note:** Service implementation not provided in documents. The service layer would implement all business logic referenced by the controller, including:

- Dashboard data aggregation
- Course list retrieval
- Assignment fetching and submission
- Performance calculations
- Profile CRUD operations
- Password hashing and verification
- Avatar URL management
- Calendar event aggregation
- Lesson progress tracking
- Activity log retrieval
- Notification management

---

## 2. EXPECTED DATABASE OPERATIONS

The service would query tables like:

| Table | Operations |
|-------|-----------|
| `users` | Select profile, update profile, password verification |
| `user_profiles` | Select/update profile details |
| `enrollments` | List student's courses |
| `assignments` | Get course assignments |
| `assignment_submissions` | Submit assignments, get submission status |
| `video_progress` | Track lesson/video watching progress |
| `quiz_attempts` | Performance tracking |
| `activity_logs` | Student activity feed |
| `notifications` | Get/mark notifications |

---

## 3. EXPECTED OPERATIONS

### getDashboard(userId)
- Summary of enrolled courses
- Pending assignments
- Recent activity
- Performance summary

### getCourses(userId)
- List all enrolled courses with progress

### getAssignments(userId)
- Assignments from all enrolled courses

### submitAssignment(userId, assignmentId, text, fileUrl, fileName)
- Create submission record
- Link file if provided
- Update submission status

### getPerformance(userId, days)
- Quiz scores
- Assignment grades
- Trend analysis

### getProfile(userId)
- User profile info
- Profile picture URL

### updateProfile(userId, profileData)
- Update name, phone, bio
- Validate inputs

### updatePassword(userId, currentPassword, newPassword)
- Verify current password
- Hash new password
- Update in database

### updateAvatar(userId, photoUrl)
- Update photo_url field

### getCalendar(userId, year, month)
- Deadlines
- Important dates

### updateLessonProgress(userId, lessonId, watchedSeconds)
- Update video_progress table

### getActivity(userId, limit)
- Recent events
- Quiz completions
- Assignment submissions

### getNotifications(userId)
- Unread notifications

### markNotifRead(userId, notificationId)
- Update notification read flag

### markAllRead(userId)
- Mark all as read

---

## 4. SUMMARY

The student module provides a comprehensive learning platform experience:

**Dashboard:** Summary of progress and upcoming work

**Courses:** View enrolled courses and learning materials

**Assignments:** Submit assignments with file uploads

**Performance:** Track quiz scores and progress

**Profile:** Manage personal information and avatar

**Notifications:** Stay updated on course events

**Progress Tracking:** Monitor video watching and lesson completion

The implementation emphasizes **user experience** with quick access to relevant information and easy submission of work.

---
