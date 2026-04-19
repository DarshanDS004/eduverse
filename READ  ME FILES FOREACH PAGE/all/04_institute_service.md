# `institute_service.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/institute/`  
> **File path:** `modules/institute/institute.service.js`  
> **File type:** Service (Business Logic Layer)

---

## 1. FILE OVERVIEW

**File name:** `institute_service.js`  
**File type:** Service / Business Logic Layer  
**Purpose:** Contains all database queries and business logic for the Institute module. It is the single source of truth for every data operation an institute admin can perform — from managing students and teachers to generating reports and issuing certificates.

---

## 2. RESPONSIBILITY

This is the **heaviest file in the institute module** (~1,450 lines). Its responsibilities include:

- Performing all MySQL queries for the institute domain.
- Enforcing data ownership: every operation verifies that the acting user owns the relevant institute record via `_getInstitute(userId)`.
- Handling complex multi-step operations (e.g., adding a student: create user → set password → send email → add to institute → assign to class).
- Performing aggregations for dashboard and analytics.
- Implementing pagination, filtering, and search across student and teacher listings.
- Sending transactional emails via `sendMail`.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `db` | `../../config/db` | MySQL connection pool for all database operations |
| `AppError` | `../../shared/errorHandler` | Custom error class for structured HTTP errors |
| `sendMail` | `../../config/mailer` | Sends transactional emails (welcome, reminders) |
| `bcrypt` | `bcryptjs` | Password hashing when creating new user accounts |
| `uuidv4` | `uuid` | Generates temporary passwords for new students/teachers |

---

## 4. CORE LOGIC BREAKDOWN

### Private Helper: `_getInstitute(userId)`
```js
async function _getInstitute(userId) {
  const [[inst]] = await db.query('SELECT * FROM institutes WHERE user_id = ?', [userId]);
  if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');
  return inst;
}
```
**This is the cornerstone of all security in this service.** Every function that touches institute-specific data calls `_getInstitute(userId)` first. This ensures:
1. The calling user actually has an institute record.
2. All subsequent queries are scoped to `inst.id`, preventing cross-institute data leakage.

---

## 5. FUNCTIONS / METHODS

### Dashboard

#### `getDashboard(userId)`
**Purpose:** Aggregates key metrics for the institute admin home screen.  
**Logic:**
1. Resolves institute via `_getInstitute(userId)`.
2. Runs a single compound `SELECT` with 6 subqueries to get: total students, total teachers, total classes, pending fees, overdue fees, total fees collected.
3. Queries upcoming academic calendar events (next 5).
4. Queries most recent 5 student joins.
5. Queries today's attendance records to compute attendance rate.

**Returns:**
```json
{
  "institute": { "id": 1, "name": "...", "subscription_plan": "..." },
  "stats": { "total_students": 120, "attendance_rate_today": 92 },
  "upcoming_events": [...],
  "recent_students": [...]
}
```

---

### Profile

#### `getProfile(userId)`
- Joins `institutes` → `users` → `user_profiles` to return a complete profile including owner name and contact.

#### `updateProfile(userId, data)`
- Accepts: `name`, `type`, `address`, `city`, `state`, `contact_email`, `contact_phone`, `website`.
- Uses `COALESCE(?, column)` so only provided fields are updated (partial update).

#### `updateLogo(userId, url)`
- Updates `institutes.logo_url` with the file path string.

#### `updateAccreditation(userId, url)`
- Updates `institutes.accreditation_doc_url`.

---

### Student Management

#### `getStudents(userId, filters)`
**Purpose:** Paginated, filtered list of all students belonging to the institute.  
**Parameters:** `{ q, class_id, status, page, per_page }`  
**Logic:**
- Builds a dynamic WHERE clause based on provided filters.
- `q` performs a LIKE search on `full_name`, `email`, and `phone`.
- `status` filters by `institute_members.status`.
- Pagination: defaults to page 1, 20 per page. Max 100 per page.
- Runs two queries: one for results, one for total count.
- Each student row includes their assigned class (via correlated subquery).

**Returns:** `{ students: [...], pagination: { total, page, per_page, total_pages } }`

#### `getStudent(studentId, userId)`
- Verifies the student belongs to this institute.
- Fetches student detail + all classes they are assigned to (with subjects).
- Throws `404 NOT_FOUND` if student is not in this institute.

#### `addStudent(userId, data)`
**Purpose:** Create or enroll a student.  
**Logic:**
1. Check if a user already exists with that email.
2. If **no existing user**: generate an 8-character temp password using `uuidv4().slice(0, 8)`, hash with bcrypt (12 rounds), insert into `users` and `user_profiles`, send a welcome email.
3. If **existing user**: reuse their `id` (re-enrollment).
4. Add to `institute_members` with `INSERT IGNORE` (idempotent).
5. Optionally assign to a class with a roll number.

**Edge Case:** If the email already exists in the system, no new user is created — the existing user is simply added to the institute.

#### `bulkImportStudents(userId, file)`
- **Stub implementation.** Returns a placeholder response indicating that `xlsx` package integration is needed. No actual CSV parsing is performed.

#### `updateStudent(studentId, userId, data)`
- Updates `user_profiles` (name, grade) and optionally `users.phone`.
- Uses `COALESCE` for partial updates.

#### `updateStudentStatus(studentId, userId, status)`
- Updates `institute_members.status` for the student. Does not delete the user.

#### `removeStudent(studentId, userId)`
- Deletes the row from `institute_members` (role = 'student'). The user account itself is preserved.

#### `linkParent(studentId, userId, parentEmail, parentPhone, relation)`
- Looks up a parent user by email OR phone.
- Throws `404` if no parent account exists.
- Inserts into `parent_students` with `INSERT IGNORE`.
- `relation` defaults to `'guardian'`.

#### `generateIdCard(studentId, userId)`
- **Stub implementation.** Notes that `pdf-lib` or `puppeteer` is required for actual PDF generation. Returns `file_url: null`.

#### `getPendingRegistrations(userId)`
- Finds students who self-registered with the institute's code (`user_profiles.institute_code = inst.name`) but are NOT yet in `institute_members`.

#### `approveRegistration(studentId, userId)`
- Inserts the student into `institute_members` with `INSERT IGNORE`.

#### `rejectRegistration(studentId, userId)`
- Clears `user_profiles.institute_code` to `NULL`, preventing the student from auto-joining again.

---

### Teacher Management

#### `getTeachers(userId, filters)`
- Same pattern as `getStudents`: paginated, searchable by name/email.
- Returns teacher subject, qualification, avatar, status.

#### `getTeacher(teacherId, userId)`
- Returns teacher detail + list of classes they teach (with subjects).

#### `addTeacher(userId, data)`
- Same pattern as `addStudent`: check-or-create user, generate temp password, send welcome email, add to `institute_members` as `'teacher'`.

#### `bulkImportTeachers(userId, file)`
- Stub. Returns zero imported.

#### `updateTeacher(teacherId, userId, data)`
- Updates `user_profiles` (`full_name`, `subject`, `qualification`).

#### `updateTeacherStatus` / `removeTeacher`
- Identical pattern to student equivalents.

---

### Classes

#### `getClasses(userId, filters)`
- Returns all classes for the institute with: academic year name, student count, teacher count (via subqueries).

#### `createClass(userId, data)`
- Required field: `name`. Optional: `section`, `academic_year_id`, `description`.
- Throws `400 MISSING_FIELDS` if `name` is absent.

#### `getClass(classId, userId)`
- Returns class row + array of enrolled students (with roll numbers) + array of assigned teachers (with subjects).

#### `updateClass` / `deleteClass`
- Both scope to `inst.id` to prevent cross-institute mutations.

#### `assignStudentToClass(classId, studentId, rollNumber)`
- `INSERT IGNORE INTO class_students` — safe to call multiple times.

#### `removeStudentFromClass` / `assignTeacherToClass` / `removeTeacherFromClass`
- Direct INSERT IGNORE / DELETE operations on junction tables.

#### `transferStudent(studentId, fromClassId, toClassId)`
- Atomic two-step: DELETE from old class, INSERT IGNORE into new class. Not wrapped in a DB transaction.

---

### Academic Years

#### `createAcademicYear(userId, data)`
- If `is_current = true`, first resets all existing academic years to `is_current = 0` before inserting the new one — ensures only one current year exists at a time.

#### `updateAcademicYear(yearId, userId, data)`
- Same `is_current` uniqueness logic on update.

---

### Timetable

#### `getTimetable(userId, filters)`
- Accepts `class_id` and `teacher_id` filters.
- Returns entries ordered by `day_of_week`, then `start_time`.

#### `createTimetableEntry` / `updateTimetableEntry` / `deleteTimetableEntry`
- Direct CRUD on `timetable` table.

---

### Academic Calendar

#### `getCalendar(userId, filters)`
- Supports date range filtering via `from` and `to` query params.

---

### Attendance

#### `createAttendanceSession(userId, data)`
- Creates a session record (a session represents one class meeting on a specific date).

#### `markAttendance(sessionId, records)`
- `records` is an array: `[{ student_id, status }]`.
- Uses `INSERT INTO ... ON DUPLICATE KEY UPDATE` for idempotent marking.

#### `overrideAttendance(recordId, status)`
- Updates a single attendance record's status (e.g., change 'absent' to 'present').

#### `getStudentAttendance(studentId, userId, filters)`
- Returns all attendance records for a student with date range support.

#### `getClassAttendance(classId, userId, filters)`
- Returns session-level attendance summary for an entire class.

---

### Fee Management

#### `getFeeStructures(userId)`
- Lists all fee templates defined by this institute.

#### `createFeeStructure(userId, data)`
- Creates a named fee template (e.g., "Term 1 Tuition", type: "tuition", amount: 15000).

#### `assignFee(userId, data)`
- Assigns a fee structure to one or more students. Creates `student_fees` records.

#### `getStudentFees(userId, filters)`
- Lists fee assignments with student name, status, amount, due date. Supports class/status filtering.

#### `recordManualPayment(feeId, userId, data)`
- Updates a `student_fees` record to `status = 'paid'`, records payment mode and amount.

#### `sendFeeReminder(userId, data)`
- Queries all overdue/pending fees matching criteria.
- Sends email reminders to each affected student via `sendMail`.

---

### Content Management

#### `getContent(userId, filters)`
- Lists all videos and materials uploaded by this institute. Supports type/course filtering.

#### `uploadVideo(userId, data, file)`
- Inserts a video record into the `content` table with file path, title, course association.

#### `uploadMaterial(userId, data, file)`
- Inserts a material (PDF, doc, etc.) record into `content` table.

#### `updateContent(contentId, userId, data)`
- Updates content metadata (title, description).

#### `archiveContent(contentId, userId)`
- Soft-deletes: sets `status = 'archived'` rather than deleting the row.

---

### Announcements

#### `createAnnouncement(userId, data)`
- Inserts into `announcements` table.
- Also inserts into `notifications` for all targeted members (students/teachers of the institute).

#### `deleteAnnouncement(announcementId, userId)`
- Hard deletes the announcement record.

---

### Certificates

#### `issueBatchCertificates(userId, data)`
- Issues completion certificates to multiple students.

#### `generateTransferCert(studentId, userId)` / `generateBonafideCert(studentId, userId)`
- Stubs or PDF generation logic for official school documents.

---

### Analytics & Reports

#### `getAnalytics(userId, filters)`
**Purpose:** Advanced analytics for institute admin dashboard.  
**Returns three datasets:**
1. **Attendance trend:** Daily present/total counts for last 30 days.
2. **Quiz performance:** Class-wise average quiz score and attempt count.
3. **Fee collection summary:** Total collected, pending, overdue amounts.

#### `getStudentReport(studentId, userId)`
**Returns:**
- Student basic info
- All quiz results (score, percentage, pass/fail)
- All assignments (score, status, feedback)
- Attendance (total sessions, present count, percentage)

#### `getClassReport(classId, userId)`
**Returns:**
- Class metadata
- All students with their individual: present count, total count, average quiz score

#### `getAttendanceReport(userId, filters)`
- Accepts `from`, `to`, `class_id` filters.
- Returns per-student attendance percentage, ordered from lowest to highest (to flag at-risk students).

#### `getFeeReport(userId, filters)`
**Returns:**
- Summary: collected, outstanding, overdue count.
- Breakdown: per-fee-structure collected vs pending amounts.

---

## 6. DATA FLOW

```
Controller (institute.controller.js)
    ↓
svc.*(userId, ...) called
    ↓
_getInstitute(userId) → verifies ownership → returns inst
    ↓
db.query(SQL, params) → MySQL
    ↓
[optional] sendMail(...) for welcome/reminder emails
    ↓
Returns plain JS object / array to controller
```

---

## 7. CONNECTIONS

**Called by:** `institute.controller.js` exclusively.

**Depends on:**
- `../../config/db` — MySQL pool
- `../../shared/errorHandler` — `AppError`
- `../../config/mailer` — `sendMail`
- `bcryptjs` — password hashing
- `uuid` — temp password generation

**Touches these DB tables:** `institutes`, `users`, `user_profiles`, `institute_members`, `classes`, `class_students`, `class_teachers`, `academic_years`, `timetable`, `academic_calendar`, `attendance_sessions`, `attendance_records`, `fee_structures`, `student_fees`, `content`, `announcements`, `notifications`, `parent_students`, `quiz_attempts`, `quizzes`, `assignment_submissions`, `assignments`, `certificates`

---

## 8. ERROR HANDLING

| Situation | Error |
|---|---|
| Institute not found for user | `AppError('Institute not found.', 404, 'NOT_FOUND')` |
| Student/teacher not in institute | `AppError('... not found.', 404, 'NOT_FOUND')` |
| Missing required fields | `AppError('...required.', 400, 'MISSING_FIELDS')` |
| Parent not found by email/phone | `AppError('No parent account found...', 404, 'NOT_FOUND')` |
| Class not found in institute | `AppError('Class not found.', 404, 'NOT_FOUND')` |

All errors are instances of `AppError` which carries a message, HTTP status, and error code string.

---

## 9. EDGE CASES / NOTES

- **`transferStudent` is not atomic** — two separate DB queries without a transaction. If the second INSERT fails, the student is removed from the old class but not added to the new one.
- **`bulkImportStudents` and `bulkImportTeachers` are stubs** — they return dummy data and note that `xlsx` package integration is required.
- **`generateIdCard`, `generateTransferCert`, `generateBonafideCert`** are partially stubbed — PDF generation with `pdf-lib`/`puppeteer` is noted as required.
- **Temp passwords** use `uuidv4().slice(0, 8)` — this is an 8-character alphanumeric-ish string. It is sent via email in plaintext (which is acceptable for a one-time temp password, but users should be prompted to change immediately).
- **`COALESCE` pattern** throughout updates means a missing field in the request body will not null-out existing data — only explicitly provided fields are changed.
- **`sendFeeReminder`** is the only place this service sends emails to students (not for account creation). Account creation emails go to students and teachers.

---

## 10. SUMMARY

`institute_service.js` is the brain of the Institute module — a 1,450-line service file that owns all SQL queries and business logic. It enforces data ownership via the `_getInstitute()` guard pattern, supports complex multi-step operations like student onboarding with email, implements paginated and filtered data access, and produces rich analytics data. It is the only layer that talks to the database for this module.
