# Superadmin & Reports Modules — Documentation

---

# SUPERADMIN.CONTROLLER.JS

## 1. FILE OVERVIEW

**File Name:** `superadmin.controller.js`  
**File Type:** Express Controller  
**Purpose:** Handle HTTP requests for platform administration including user management, institute oversight, content moderation, revenue tracking, and system settings.

**Scope:** 30+ endpoints across 7 functional areas

---

## 2. HELPER FUNCTIONS

```javascript
const ok  = (res, msg, data) => sendSuccess(res, 200, msg, data);
const created = (res, msg, data) => sendSuccess(res, 201, msg, data);
```

Shortcuts for formatting 200 and 201 responses.

---

## 3. FUNCTIONAL AREAS & EXPORTS

### A. DASHBOARD

```javascript
exports.getDashboard = async (req, res, next) => {
  try { return ok(res, 'Dashboard loaded.', await svc.getDashboard()); }
  catch (e) { next(e); }
};
```

**Endpoint:** `GET /admin/dashboard`  
**Purpose:** Platform-wide metrics summary

---

### B. USER MANAGEMENT (5 endpoints)

#### `getUsers(req, res, next)`
**GET `/admin/users?filters`**  
Lists all users with optional filtering

#### `getUser(req, res, next)`
**GET `/admin/users/:id`**  
Get single user details

#### `updateUserStatus(req, res, next)`
**PATCH `/admin/users/:id/status`**  
Change user status (active, suspended, banned)

```javascript
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return sendError(res, 400, 'Status is required.', 'MISSING_FIELDS');
    return ok(res, 'User status updated.', 
      await svc.updateUserStatus(req.params.id, status, req.user.id, req.ip));
  } catch (e) { next(e); }
};
```

**Validation:** Status required  
**Audit:** Logs admin ID and IP address

#### `verifyUser(req, res, next)`
**PATCH `/admin/users/:id/verify`**  
Mark user as email-verified

#### `resetUserPassword(req, res, next)`
**POST `/admin/users/:id/reset-password`**  
Send password reset link to user

#### `deleteUser(req, res, next)`
**DELETE `/admin/users/:id`**  
Permanently delete user account

**Audit:** Records deleting admin and IP address

---

### C. INSTITUTE MANAGEMENT (8 endpoints)

#### `getInstitutes(req, res, next)`
**GET `/admin/institutes?filters`**  
List all institutes

#### `getInstitute(req, res, next)`
**GET `/admin/institutes/:id`**  
Get institute details

#### `approveInstitute(req, res, next)`
**PATCH `/admin/institutes/:id/approve`**  
Approve pending institute registration

#### `rejectInstitute(req, res, next)`
**PATCH `/admin/institutes/:id/reject`**  
Reject institute application

```javascript
exports.rejectInstitute = async (req, res, next) => {
  try {
    const { reason } = req.body;
    return ok(res, 'Institute rejected.', 
      await svc.rejectInstitute(req.params.id, reason, req.user.id));
  } catch (e) { next(e); }
};
```

#### `suspendInstitute(req, res, next)`
**PATCH `/admin/institutes/:id/suspend`**  
Suspend active institute

#### `reactivateInstitute(req, res, next)`
**PATCH `/admin/institutes/:id/reactivate`**  
Re-activate suspended institute

#### `updateSubscription(req, res, next)`
**PATCH `/admin/institutes/:id/subscription`**  
Change subscription plan or end date

```javascript
exports.updateSubscription = async (req, res, next) => {
  try {
    const { plan, end_date } = req.body;
    return ok(res, 'Subscription updated.', 
      await svc.updateSubscription(req.params.id, plan, end_date));
  } catch (e) { next(e); }
};
```

#### `sendRenewalReminder(req, res, next)`
**POST `/admin/institutes/:id/renewal-reminder`**  
Send subscription renewal reminder email

---

### D. INSTRUCTOR MANAGEMENT (5 endpoints)

#### `getInstructors(req, res, next)`
**GET `/admin/instructors?filters`**  
List instructors with payout status

#### `getInstructor(req, res, next)`
**GET `/admin/instructors/:id`**  
Get instructor details

#### `approveInstructor(req, res, next)`
**PATCH `/admin/instructors/:id/approve`**  
Verify and approve instructor account

#### `suspendInstructor(req, res, next)`
**PATCH `/admin/instructors/:id/suspend`**  
Suspend instructor (prevent course uploads)

#### `markPayoutDone(req, res, next)`
**PATCH `/admin/instructors/:id/payout`**  
Record completed payout to instructor

```javascript
exports.markPayoutDone = async (req, res, next) => {
  try {
    const { amount } = req.body;
    return ok(res, 'Payout marked.', 
      await svc.markPayoutDone(req.params.id, amount));
  } catch (e) { next(e); }
};
```

---

### E. CONTENT MODERATION (6 endpoints)

#### `getPendingCourses(req, res, next)`
**GET `/admin/courses/pending`**  
Courses awaiting approval

#### `getAllCourses(req, res, next)`
**GET `/admin/courses?filters`**  
All courses with status filtering

#### `approveCourse(req, res, next)`
**PATCH `/admin/courses/:id/approve`**  
Approve course for publishing

#### `rejectCourse(req, res, next)`
**PATCH `/admin/courses/:id/reject`**  
Reject course submission with reason

```javascript
exports.rejectCourse = async (req, res, next) => {
  try {
    const { reason } = req.body;
    return ok(res, 'Course rejected.', 
      await svc.rejectCourse(req.params.id, reason, req.user.id));
  } catch (e) { next(e); }
};
```

#### `featureCourse(req, res, next)`
**PATCH `/admin/courses/:id/feature`**  
Add/remove course from featured list

```javascript
exports.featureCourse = async (req, res, next) => {
  try {
    const { featured } = req.body;
    return ok(res, 'Course feature status updated.', 
      await svc.featureCourse(req.params.id, featured));
  } catch (e) { next(e); }
};
```

#### `removeCourse(req, res, next)`
**DELETE `/admin/courses/:id`**  
Remove course from platform with reason

```javascript
exports.removeCourse = async (req, res, next) => {
  try {
    const { reason } = req.body;
    return ok(res, 'Course removed.', 
      await svc.removeCourse(req.params.id, reason, req.user.id, req.ip));
  } catch (e) { next(e); }
};
```

**Audit:** Tracks removing admin and IP

---

### F. REVENUE & PAYMENTS (5 endpoints)

#### `getRevenue(req, res, next)`
**GET `/admin/revenue?filters`**  
Revenue reports with date range filtering

#### `getPayments(req, res, next)`
**GET `/admin/payments?filters`**  
All payments with status/date filtering

#### `getRefunds(req, res, next)`
**GET `/admin/refunds?filters`**  
Refund requests with status filtering

#### `approveRefund(req, res, next)`
**PATCH `/admin/refunds/:id/approve`**  
Process approved refund

#### `rejectRefund(req, res, next)`
**PATCH `/admin/refunds/:id/reject`**  
Reject refund request with note

```javascript
exports.rejectRefund = async (req, res, next) => {
  try {
    const { note } = req.body;
    return ok(res, 'Refund rejected.', 
      await svc.resolveRefund(req.params.id, 'rejected', req.user.id, note));
  } catch (e) { next(e); }
};
```

---

### G. ANALYTICS (1 endpoint)

#### `getAnalytics(req, res, next)`
**GET `/admin/analytics?filters`**  
Platform analytics with time period filtering

---

### H. SETTINGS (3 endpoints)

#### `getSettings(req, res, next)`
**GET `/admin/settings`**  
Platform configuration settings

#### `updateSettings(req, res, next)`
**PATCH `/admin/settings`**  
Update platform settings

```javascript
exports.updateSettings = async (req, res, next) => {
  try { return ok(res, 'Settings updated.', 
    await svc.updateSettings(req.body, req.user.id)); }
  catch (e) { next(e); }
};
```

**Audit:** Logs updating admin

#### `getFeatureFlags(req, res, next)`
**GET `/admin/feature-flags`**  
Get feature flag status (beta features)

#### `updateFeatureFlag(req, res, next)`
**PATCH `/admin/feature-flags`**  
Enable/disable features

```javascript
exports.updateFeatureFlag = async (req, res, next) => {
  try {
    const { feature_name, is_enabled } = req.body;
    if (!feature_name) 
      return sendError(res, 400, 'feature_name is required.', 'MISSING_FIELDS');
    return ok(res, 'Feature flag updated.', 
      await svc.updateFeatureFlag(feature_name, is_enabled, req.user.id));
  } catch (e) { next(e); }
};
```

---

### I. ANNOUNCEMENTS (3 endpoints)

#### `getAnnouncements(req, res, next)`
**GET `/admin/announcements`**  
Platform-wide announcements

#### `createAnnouncement(req, res, next)`
**POST `/admin/announcements`**  
Send announcement to all users

```javascript
exports.createAnnouncement = async (req, res, next) => {
  try { return created(res, 'Announcement sent.', 
    await svc.createAnnouncement(req.user.id, req.body)); }
  catch (e) { next(e); }
};
```

Returns 201 Created

#### `deleteAnnouncement(req, res, next)`
**DELETE `/admin/announcements/:id`**  
Remove announcement

---

### J. SUPPORT TICKETS (5 endpoints)

#### `getTickets(req, res, next)`
**GET `/admin/tickets?filters`**  
Support tickets with status/priority filtering

#### `getTicket(req, res, next)`
**GET `/admin/tickets/:id`**  
Ticket details with conversation history

#### `replyTicket(req, res, next)`
**POST `/admin/tickets/:id/reply`**  
Add response to support ticket

```javascript
exports.replyTicket = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) 
      return sendError(res, 400, 'Message is required.', 'MISSING_FIELDS');
    return ok(res, 'Reply sent.', 
      await svc.replyTicket(req.params.id, req.user.id, message));
  } catch (e) { next(e); }
};
```

#### `updateTicketStatus(req, res, next)`
**PATCH `/admin/tickets/:id/status`**  
Change ticket status (open, closed, in_progress)

#### `assignTicket(req, res, next)`
**PATCH `/admin/tickets/:id/assign`**  
Assign ticket to support staff member

```javascript
exports.assignTicket = async (req, res, next) => {
  try {
    const { assigned_to } = req.body;
    return ok(res, 'Ticket assigned.', 
      await svc.assignTicket(req.params.id, assigned_to));
  } catch (e) { next(e); }
};
```

---

### K. AUDIT LOGS (1 endpoint)

#### `getAuditLogs(req, res, next)`
**GET `/admin/audit-logs?filters`**  
Admin action history (user management, content changes, payments)

---

## 4. PATTERNS & OBSERVATIONS

### Error Handling
```javascript
catch (e) { next(e); }
```

All errors passed to Express error middleware.

### Validation
- Required fields checked
- Returns 400 MISSING_FIELDS if invalid

### Audit Logging
Some operations include:
- Admin user ID
- IP address
- Operation timestamp

Examples:
- `updateUserStatus(id, status, adminId, ip)`
- `deleteUser(id, adminId, ip)`
- `removeCourse(id, reason, adminId, ip)`

### Response Status Codes
- 200 — Successful operation
- 201 — Resource created
- 400 — Validation error
- 404 — Resource not found

---

# SUPERADMIN.ROUTES.JS

## 1. FILE OVERVIEW

**File Name:** `superadmin.routes.js`  
**File Type:** Express Router Configuration  
**Purpose:** Define superadmin endpoints with authentication and role restrictions.

---

## 2. AUTHENTICATION & SETUP

```javascript
router.use(protect);
router.use(restrictTo('superadmin'));
```

**Requirements:**
- JWT authentication
- Superadmin role ONLY

All routes restricted to superadmin users.

---

## 3. ROUTE STRUCTURE

```javascript
/* ═══════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════ */
router.get('/dashboard', ctrl.getDashboard);

/* ═══════════════════════════════════════
   USER MANAGEMENT (6 routes)
═══════════════════════════════════════ */
router.get('/users', ctrl.getUsers);
router.get('/users/:id', ctrl.getUser);
router.patch('/users/:id/status', ctrl.updateUserStatus);
router.patch('/users/:id/verify', ctrl.verifyUser);
router.post('/users/:id/reset-password', ctrl.resetUserPassword);
router.delete('/users/:id', ctrl.deleteUser);

/* ═══════════════════════════════════════
   INSTITUTE MANAGEMENT (7 routes)
═══════════════════════════════════════ */
router.get('/institutes', ctrl.getInstitutes);
router.get('/institutes/:id', ctrl.getInstitute);
router.patch('/institutes/:id/approve', ctrl.approveInstitute);
router.patch('/institutes/:id/reject', ctrl.rejectInstitute);
router.patch('/institutes/:id/suspend', ctrl.suspendInstitute);
router.patch('/institutes/:id/reactivate', ctrl.reactivateInstitute);
router.patch('/institutes/:id/subscription', ctrl.updateSubscription);
router.post('/institutes/:id/renewal-reminder', ctrl.sendRenewalReminder);

/* And so on for other sections... */
```

---

## 4. COMPLETE ENDPOINTS LIST

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/dashboard` | Platform dashboard |
| GET | `/users` | List users |
| GET | `/users/:id` | Get user details |
| PATCH | `/users/:id/status` | Update user status |
| PATCH | `/users/:id/verify` | Verify user |
| POST | `/users/:id/reset-password` | Reset password |
| DELETE | `/users/:id` | Delete user |
| GET | `/institutes` | List institutes |
| GET | `/institutes/:id` | Get institute details |
| PATCH | `/institutes/:id/approve` | Approve institute |
| PATCH | `/institutes/:id/reject` | Reject institute |
| PATCH | `/institutes/:id/suspend` | Suspend institute |
| PATCH | `/institutes/:id/reactivate` | Reactivate institute |
| PATCH | `/institutes/:id/subscription` | Update subscription |
| POST | `/institutes/:id/renewal-reminder` | Send renewal reminder |
| GET | `/instructors` | List instructors |
| GET | `/instructors/:id` | Get instructor details |
| PATCH | `/instructors/:id/approve` | Approve instructor |
| PATCH | `/instructors/:id/suspend` | Suspend instructor |
| PATCH | `/instructors/:id/payout` | Record payout |
| GET | `/courses/pending` | Pending courses |
| GET | `/courses` | All courses |
| PATCH | `/courses/:id/approve` | Approve course |
| PATCH | `/courses/:id/reject` | Reject course |
| PATCH | `/courses/:id/feature` | Feature course |
| DELETE | `/courses/:id` | Remove course |
| GET | `/revenue` | Revenue reports |
| GET | `/payments` | All payments |
| GET | `/refunds` | Refund requests |
| PATCH | `/refunds/:id/approve` | Approve refund |
| PATCH | `/refunds/:id/reject` | Reject refund |
| GET | `/analytics` | Analytics data |
| GET | `/settings` | Platform settings |
| PATCH | `/settings` | Update settings |
| GET | `/feature-flags` | Feature flags |
| PATCH | `/feature-flags` | Update feature flag |
| GET | `/announcements` | Get announcements |
| POST | `/announcements` | Create announcement |
| DELETE | `/announcements/:id` | Delete announcement |
| GET | `/tickets` | Support tickets |
| GET | `/tickets/:id` | Ticket details |
| POST | `/tickets/:id/reply` | Reply to ticket |
| PATCH | `/tickets/:id/status` | Update ticket status |
| PATCH | `/tickets/:id/assign` | Assign ticket |
| GET | `/audit-logs` | Audit logs |

**Total:** 44 endpoints

---

# REPORTS.ROUTES.JS

## 1. FILE OVERVIEW

**File Name:** `reports.routes.js`  
**File Type:** Express Router Configuration  
**Purpose:** Generate data reports for students, courses, institutes, and platform metrics.

---

## 2. AUTHENTICATION & SETUP

```javascript
router.use(protect);
```

**Requirement:** JWT authentication only  
**Role Control:** Per-endpoint restrictions using `restrictTo()`

---

## 3. ROUTES

### 1. Student Performance Report

```javascript
router.get('/student/:id', async (req, res, next) => {
  try {
    const [[student]] = await db.query(
      'SELECT up.full_name, u.email, up.grade FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?',
      [req.params.id]
    );
    if (!student) return sendError(res, 404, 'Student not found.', 'NOT_FOUND');

    const [quizzes] = await db.query(
      'SELECT q.title, qa.score, qa.total_marks, qa.percentage, qa.passed, qa.submitted_at FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL ORDER BY qa.submitted_at DESC',
      [req.params.id]
    );

    const [assignments] = await db.query(
      'SELECT a.title, s.score, a.max_marks, s.status FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.student_id = ? ORDER BY s.submitted_at DESC',
      [req.params.id]
    );

    const [[attendance]] = await db.query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN status="present" THEN 1 ELSE 0 END) AS present FROM attendance_records WHERE student_id = ?',
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Report loaded.', {
      student,
      quizzes,
      assignments,
      attendance: {
        ...attendance,
        percentage: attendance.total
          ? Math.round((attendance.present / attendance.total) * 100)
          : 0,
      },
    });
  } catch (e) { next(e); }
});
```

**Endpoint:** `GET /reports/student/:id`  
**Auth:** Required  
**Access:** Any authenticated user

**Returns:**
```json
{
  "student": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "grade": "10A"
  },
  "quizzes": [
    {
      "title": "Python Quiz",
      "score": 80,
      "total_marks": 100,
      "percentage": 80,
      "passed": 1,
      "submitted_at": "2024-01-20T15:30:00Z"
    }
  ],
  "assignments": [
    {
      "title": "Python Project",
      "score": 85,
      "max_marks": 100,
      "status": "graded"
    }
  ],
  "attendance": {
    "total": 30,
    "present": 28,
    "percentage": 93
  }
}
```

---

### 2. Course Report

```javascript
router.get('/course/:id', restrictTo('instructor', 'institute', 'superadmin'), async (req, res, next) => {
  try {
    const [[course]] = await db.query(
      'SELECT id, title, enrolled_count, avg_rating FROM courses WHERE id = ?',
      [req.params.id]
    );
    if (!course) return sendError(res, 404, 'Course not found.', 'NOT_FOUND');

    const [[quizStats]] = await db.query(
      'SELECT COUNT(*) AS attempts, ROUND(AVG(percentage),1) AS avg_score, SUM(passed) AS passed FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE q.course_id = ? AND qa.submitted_at IS NOT NULL',
      [req.params.id]
    );

    const [[assignStats]] = await db.query(
      'SELECT COUNT(*) AS submissions, SUM(CASE WHEN status="graded" THEN 1 ELSE 0 END) AS graded FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ?',
      [req.params.id]
    );

    const [[videoStats]] = await db.query(
      'SELECT COUNT(DISTINCT vp.student_id) AS watchers, ROUND(AVG(CASE WHEN vp.completed=1 THEN 100 ELSE (vp.watched_seconds/NULLIF(v.duration*60,0))*100 END),1) AS avg_completion FROM video_progress vp JOIN videos v ON v.id = vp.video_id JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = ?',
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Course report loaded.', {
      course,
      quiz_stats: quizStats,
      assign_stats: assignStats,
      video_stats: videoStats,
    });
  } catch (e) { next(e); }
});
```

**Endpoint:** `GET /reports/course/:id`  
**Auth:** Required  
**Access:** Instructors, institutes, superadmin

**Returns:**
```json
{
  "course": {
    "id": 42,
    "title": "Python 101",
    "enrolled_count": 150,
    "avg_rating": 4.5
  },
  "quiz_stats": {
    "attempts": 450,
    "avg_score": 78.5,
    "passed": 420
  },
  "assign_stats": {
    "submissions": 300,
    "graded": 280
  },
  "video_stats": {
    "watchers": 150,
    "avg_completion": 85.2
  }
}
```

**Metrics:**
- Quiz attempts and average score
- Assignment submission and grading status
- Video completion rate

---

### 3. Institute Report

```javascript
router.get('/institute/:id', restrictTo('institute', 'superadmin'), async (req, res, next) => {
  try {
    const [[inst]] = await db.query(
      'SELECT id, name, type FROM institutes WHERE id = ?',
      [req.params.id]
    );
    if (!inst) return sendError(res, 404, 'Institute not found.', 'NOT_FOUND');

    const [[members]] = await db.query(
      'SELECT SUM(CASE WHEN role="student" THEN 1 ELSE 0 END) AS students, SUM(CASE WHEN role="teacher" THEN 1 ELSE 0 END) AS teachers FROM institute_members WHERE institute_id = ?',
      [req.params.id]
    );

    const [[fees]] = await db.query(
      'SELECT COALESCE(SUM(CASE WHEN status="paid" THEN amount ELSE 0 END),0) AS collected, COALESCE(SUM(CASE WHEN status!="paid" THEN amount ELSE 0 END),0) AS pending FROM student_fees WHERE institute_id = ?',
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Institute report loaded.', {
      institute: inst,
      members,
      fees,
    });
  } catch (e) { next(e); }
});
```

**Endpoint:** `GET /reports/institute/:id`  
**Auth:** Required  
**Access:** Institute admins, superadmin

**Returns:**
```json
{
  "institute": {
    "id": 5,
    "name": "St. Xavier School",
    "type": "school"
  },
  "members": {
    "students": 500,
    "teachers": 30
  },
  "fees": {
    "collected": 2500000,
    "pending": 500000
  }
}
```

---

### 4. Platform Report

```javascript
router.get('/platform', restrictTo('superadmin'), async (req, res, next) => {
  try {
    const [[users]]      = await db.query("SELECT COUNT(*) AS total FROM users WHERE role != 'superadmin'");
    const [[courses]]    = await db.query("SELECT COUNT(*) AS total FROM courses WHERE status = 'published'");
    const [[enrolls]]    = await db.query('SELECT COUNT(*) AS total FROM enrollments');
    const [[revenue]]    = await db.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status='success'");
    const [[institutes]] = await db.query("SELECT COUNT(*) AS total FROM institutes WHERE status='active'");

    return sendSuccess(res, 200, 'Platform report loaded.', {
      users:             users.total,
      courses:           courses.total,
      enrollments:       enrolls.total,
      revenue:           parseFloat(revenue.total),
      active_institutes: institutes.total,
    });
  } catch (e) { next(e); }
});
```

**Endpoint:** `GET /reports/platform`  
**Auth:** Required  
**Access:** Superadmin only

**Returns:**
```json
{
  "users": 5000,
  "courses": 200,
  "enrollments": 15000,
  "revenue": 1500000,
  "active_institutes": 50
}
```

**Metrics:**
- Total users (excluding superadmin)
- Published courses
- Total enrollments
- Revenue from successful payments
- Active institutes

---

## 4. ROLE-BASED ACCESS PATTERNS

### Public Report
```javascript
// No role restriction
router.get('/student/:id', async ...)
```

Any authenticated user can access.

### Role-Restricted Report
```javascript
// Instructors, institutes, superadmin only
router.get('/course/:id', restrictTo('instructor', 'institute', 'superadmin'), async ...)

// Institute admins and superadmin only
router.get('/institute/:id', restrictTo('institute', 'superadmin'), async ...)

// Superadmin only
router.get('/platform', restrictTo('superadmin'), async ...)
```

---

## 5. QUERY PATTERNS USED

### COUNT(*) AS total
```sql
SELECT COUNT(*) AS total FROM users
```

Total record count.

### SUM() for Aggregation
```sql
SELECT SUM(amount) FROM payments WHERE status='success'
```

Total revenue calculation.

### CASE WHEN for Conditional Counts
```sql
SUM(CASE WHEN status="present" THEN 1 ELSE 0 END) AS present
```

Count records meeting criteria.

### ROUND() for Averages
```sql
ROUND(AVG(percentage), 1) AS avg_score
```

Average with rounding.

### LEFT JOIN for Optional Data
```sql
LEFT JOIN quiz_options qo ON qo.id = selected_option_id
```

Include records even if no join match.

---

## 6. DATABASE DEPENDENCIES

| Table | Columns Used |
|-------|--------------|
| `users` | id, role |
| `user_profiles` | full_name, grade |
| `quiz_attempts` | student_id, quiz_id, score, percentage, passed, submitted_at |
| `quizzes` | id, title, course_id |
| `assignment_submissions` | student_id, assignment_id, score, status |
| `assignments` | id, title, course_id, max_marks |
| `attendance_records` | student_id, status |
| `courses` | id, title, enrolled_count, avg_rating |
| `video_progress` | student_id, video_id, completed, watched_seconds |
| `videos` | id, duration |
| `course_modules` | id, course_id |
| `institutes` | id, name, type, status |
| `institute_members` | institute_id, role |
| `student_fees` | student_id, institute_id, amount, status |
| `enrollments` | course_id, student_id |
| `payments` | amount, status |

---

## 7. SUMMARY

**Reports Module Provides:**

1. **Student Report** — Quiz scores, assignments, attendance
2. **Course Report** — Quiz stats, assignments, video completion
3. **Institute Report** — Members, fee collection
4. **Platform Report** — Users, courses, revenue, institutes

**Key Characteristics:**
- Role-based access control
- Aggregated metrics using SQL aggregation
- Drill-down capability (student → course → platform)
- Focus on quantitative data
- Real-time calculation (no caching)

---

## 8. COMPLETE ENDPOINT REFERENCE

| Method | Endpoint | Auth | Role | Purpose |
|--------|----------|------|------|---------|
| GET | `/student/:id` | Yes | Any | Student performance |
| GET | `/course/:id` | Yes | Instructor/Institute/Admin | Course metrics |
| GET | `/institute/:id` | Yes | Institute/Admin | Institute overview |
| GET | `/platform` | Yes | Admin | Platform dashboard |

---
