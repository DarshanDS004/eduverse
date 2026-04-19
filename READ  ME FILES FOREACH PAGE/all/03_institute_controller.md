# `institute_controller.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/institute/`  
> **File path:** `modules/institute/institute.controller.js`  
> **File type:** Controller

---

## 1. FILE OVERVIEW

**File name:** `institute_controller.js`  
**File type:** Controller  
**Purpose:** Acts as the HTTP layer between the Express router and the institute business logic service. It extracts parameters from `req`, calls the appropriate service function, and returns a standardized HTTP response. It contains no business logic or database queries of its own.

---

## 2. RESPONSIBILITY

This file is the **controller layer** of the Institute module. Its sole responsibilities are:

- Extracting data from `req.body`, `req.params`, `req.query`, and `req.file`.
- Calling the corresponding function in `institute.service.js`.
- Returning a success or error response using `sendSuccess` / `sendError`.
- Delegating unexpected errors to the Express global error handler via `next(e)`.

It does **not** contain SQL queries, business rules, or data transformation logic.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `svc` | `./institute.service` | All business logic and database operations |
| `sendSuccess` | `../../shared/errorHandler` | Sends standardized `{ success: true, data }` JSON responses |
| `sendError` | `../../shared/errorHandler` | Sends standardized `{ success: false, error }` JSON responses |

### Helper Aliases
```js
const ok      = (res, msg, data) => sendSuccess(res, 200, msg, data);
const created = (res, msg, data) => sendSuccess(res, 201, msg, data);
```
These shorthand aliases reduce repetition. `ok` is used for successful reads and updates. `created` is used when a new resource is created (HTTP 201).

---

## 4. CORE LOGIC BREAKDOWN

Every exported function follows this strict pattern:

```js
exports.someAction = async (req, res, next) => {
  try {
    // 1. Optionally validate req.file or req.body fields
    // 2. Extract relevant data from req
    // 3. Call svc.someAction(...)
    // 4. Return ok() or created()
  } catch (e) {
    next(e); // Pass to global error handler
  }
};
```

The controller never throws directly — all errors are forwarded to Express's error-handling middleware.

---

## 5. FUNCTIONS / METHODS

### Dashboard

#### `getDashboard(req, res, next)`
- **Purpose:** Load aggregated institute statistics.
- **Calls:** `svc.getDashboard(req.user.id)`
- **Response:** 200 with dashboard data (student count, fee stats, attendance rate, etc.)

---

### Profile

#### `getProfile(req, res, next)`
- **Calls:** `svc.getProfile(req.user.id)`
- **Response:** 200 with institute profile data.

#### `updateProfile(req, res, next)`
- **Calls:** `svc.updateProfile(req.user.id, req.body)`
- **Response:** 200 with update confirmation.

#### `uploadLogo(req, res, next)`
- **Validation:** Returns `400 NO_FILE` if `req.file` is absent (Multer did not receive a file).
- **Logic:** Constructs a URL path `/uploads/logos/<filename>` from `req.file.filename`.
- **Calls:** `svc.updateLogo(req.user.id, url)`
- **Response:** 200 with the new logo URL.

#### `uploadAccreditation(req, res, next)`
- **Validation:** Returns `400 NO_FILE` if `req.file` is absent.
- **Logic:** Constructs URL path `/uploads/docs/<filename>`.
- **Calls:** `svc.updateAccreditation(req.user.id, url)`
- **Response:** 200 with document URL.

---

### Students

#### `getStudents(req, res, next)`
- **Calls:** `svc.getStudents(req.user.id, req.query)` — `req.query` carries `q`, `class_id`, `status`, `page`, `per_page`.
- **Response:** 200 with paginated student list.

#### `getStudent(req, res, next)`
- **Calls:** `svc.getStudent(req.params.id, req.user.id)`
- **Response:** 200 with single student detail.

#### `addStudent(req, res, next)`
- **Calls:** `svc.addStudent(req.user.id, req.body)`
- **Response:** 201 with new student ID.

#### `bulkImportStudents(req, res, next)`
- **Validation:** Returns `400 NO_FILE` if no file uploaded.
- **Calls:** `svc.bulkImportStudents(req.user.id, req.file)`
- **Response:** 200 with import summary.

#### `updateStudent(req, res, next)`
- **Calls:** `svc.updateStudent(req.params.id, req.user.id, req.body)`
- **Response:** 200 with update confirmation.

#### `updateStudentStatus(req, res, next)`
- **Extracts:** `const { status } = req.body`
- **Calls:** `svc.updateStudentStatus(req.params.id, req.user.id, status)`
- **Response:** 200.

#### `removeStudent(req, res, next)`
- **Calls:** `svc.removeStudent(req.params.id, req.user.id)`
- **Response:** 200.

#### `linkParent(req, res, next)`
- **Extracts:** `{ parent_email, parent_phone, relation }` from `req.body`
- **Calls:** `svc.linkParent(req.params.id, req.user.id, parent_email, parent_phone, relation)`
- **Response:** 200.

#### `generateIdCard(req, res, next)`
- **Calls:** `svc.generateIdCard(req.params.id, req.user.id)`
- **Response:** 200 with generated file URL (or stub response).

#### `getPendingRegistrations(req, res, next)`
- **Calls:** `svc.getPendingRegistrations(req.user.id)`
- **Response:** 200 with list of pending student registrations.

#### `approveRegistration(req, res, next)`
- **Calls:** `svc.approveRegistration(req.params.id, req.user.id)`
- **Response:** 200.

#### `rejectRegistration(req, res, next)`
- **Calls:** `svc.rejectRegistration(req.params.id, req.user.id)`
- **Response:** 200.

---

### Teachers

#### `getTeachers(req, res, next)`
- **Calls:** `svc.getTeachers(req.user.id, req.query)`
- **Response:** 200 with paginated teacher list.

#### `getTeacher(req, res, next)`
- **Calls:** `svc.getTeacher(req.params.id, req.user.id)`
- **Response:** 200 with teacher detail.

#### `addTeacher(req, res, next)`
- **Calls:** `svc.addTeacher(req.user.id, req.body)`
- **Response:** 201.

#### `bulkImportTeachers(req, res, next)`
- **Validation:** Returns `400 NO_FILE` if absent.
- **Calls:** `svc.bulkImportTeachers(req.user.id, req.file)`
- **Response:** 200.

#### `updateTeacher(req, res, next)`
- **Calls:** `svc.updateTeacher(req.params.id, req.user.id, req.body)`
- **Response:** 200.

#### `updateTeacherStatus(req, res, next)`
- **Extracts:** `const { status } = req.body`
- **Calls:** `svc.updateTeacherStatus(req.params.id, req.user.id, status)`
- **Response:** 200.

#### `removeTeacher(req, res, next)`
- **Calls:** `svc.removeTeacher(req.params.id, req.user.id)`
- **Response:** 200.

---

### Classes

#### `getClasses(req, res, next)`
- **Calls:** `svc.getClasses(req.user.id, req.query)`
- **Response:** 200 with all classes.

#### `createClass(req, res, next)`
- **Calls:** `svc.createClass(req.user.id, req.body)`
- **Response:** 201.

#### `getClass(req, res, next)`
- **Calls:** `svc.getClass(req.params.id, req.user.id)`
- **Response:** 200 with class + students + teachers.

#### `updateClass(req, res, next)`
- **Calls:** `svc.updateClass(req.params.id, req.user.id, req.body)`
- **Response:** 200.

#### `deleteClass(req, res, next)`
- **Calls:** `svc.deleteClass(req.params.id, req.user.id)`
- **Response:** 200.

#### `assignStudentToClass(req, res, next)`
- **Extracts:** `{ student_id, roll_number }` from `req.body`
- **Calls:** `svc.assignStudentToClass(req.params.id, student_id, roll_number)`
- **Response:** 200.

#### `removeStudentFromClass(req, res, next)`
- **Calls:** `svc.removeStudentFromClass(req.params.id, req.params.sid)`
- **Response:** 200.

#### `assignTeacherToClass(req, res, next)`
- **Extracts:** `{ teacher_id, subject }` from `req.body`
- **Calls:** `svc.assignTeacherToClass(req.params.id, teacher_id, subject)`
- **Response:** 200.

#### `removeTeacherFromClass(req, res, next)`
- **Calls:** `svc.removeTeacherFromClass(req.params.id, req.params.tid)`
- **Response:** 200.

#### `transferStudent(req, res, next)`
- **Extracts:** `{ from_class_id, to_class_id }` from `req.body`
- **Calls:** `svc.transferStudent(req.params.id, from_class_id, to_class_id)`
- **Response:** 200.

---

### Academic Years

#### `getAcademicYears`, `createAcademicYear`, `updateAcademicYear`
- Standard CRUD. All pass `req.user.id` for institute scoping and `req.params.id` / `req.body` as needed.

---

### Timetable

#### `getTimetable(req, res, next)`
- **Calls:** `svc.getTimetable(req.user.id, req.query)` — query supports `class_id`, `teacher_id` filters.

#### `createTimetableEntry(req, res, next)`
- **Response:** 201 with new timetable entry ID.

#### `updateTimetableEntry(req, res, next)`
- Note: only `req.params.id` and `req.body` are passed — institute scoping is done at service level using other constraints.

#### `deleteTimetableEntry(req, res, next)`
- Calls `svc.deleteTimetableEntry(req.params.id)` — no userId passed (service does not re-verify ownership here).

---

### Calendar

#### `getCalendar`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`
- Full CRUD for academic calendar events. All scope by `req.user.id`.

---

### Attendance

#### `markAttendance(req, res, next)`
- **Extracts:** `req.body.records` — expected to be an array of attendance records.
- **Calls:** `svc.markAttendance(req.params.id, req.body.records)`

#### `overrideAttendance(req, res, next)`
- **Extracts:** `const { status } = req.body`
- **Calls:** `svc.overrideAttendance(req.params.id, status)` — overrides a specific attendance record.

---

### Fees

#### `recordManualPayment(req, res, next)`
- **Calls:** `svc.recordManualPayment(req.params.id, req.user.id, req.body)` — records a cash/offline payment against a fee record.

#### `sendFeeReminder(req, res, next)`
- **Calls:** `svc.sendFeeReminder(req.user.id, req.body)` — triggers notification/email reminders for overdue fees.

---

### Content

#### `uploadVideo(req, res, next)`
- **Validation:** Returns `400 NO_FILE` if absent.
- **Calls:** `svc.uploadVideo(req.user.id, req.body, req.file)` — passes both form metadata and file info.
- **Response:** 201.

#### `uploadMaterial(req, res, next)`
- **Validation:** Returns `400 NO_FILE` if absent.
- **Calls:** `svc.uploadMaterial(req.user.id, req.body, req.file)`
- **Response:** 201.

#### `archiveContent(req, res, next)`
- Soft-deletes (archives) a content item rather than hard-deleting.

---

### Announcements
- Standard CRUD: `getAnnouncements`, `createAnnouncement`, `deleteAnnouncement`. All scope by `req.user.id`.

---

### Certificates

#### `issueBatchCertificates(req, res, next)`
- **Calls:** `svc.issueBatchCertificates(req.user.id, req.body)` — issues certificates to multiple students at once.

#### `generateTransferCert(req, res, next)`
- **Calls:** `svc.generateTransferCert(req.params.studentId, req.user.id)`

#### `generateBonafideCert(req, res, next)`
- **Calls:** `svc.generateBonafideCert(req.params.studentId, req.user.id)`

---

### Analytics & Reports

#### `getAnalytics(req, res, next)`
- **Calls:** `svc.getAnalytics(req.user.id, req.query)` — attendance trend, quiz performance, fee summary.

#### `getStudentReport`, `getClassReport`, `getAttendanceReport`, `getFeeReport`
- All accept filtering via `req.query` and scope results to the institute via `req.user.id`.

---

## 6. DATA FLOW

```
HTTP Request (from institute_routes.js)
    ↓
Controller function
    ├─ Extracts: req.params, req.query, req.body, req.file, req.user.id
    ├─ [Optional] Validates required fields → sendError(400)
    ↓
svc.* (institute.service.js)
    ↓
ok() / created() → sendSuccess()
    OR
next(e) → Global error handler
```

---

## 7. CONNECTIONS

**Called by:** `institute_routes.js` (every route maps to an export from this file)

**Calls:**
- `./institute.service` — all business logic
- `../../shared/errorHandler` — response utilities

---

## 8. ERROR HANDLING

| Situation | Behavior |
|---|---|
| `req.file` is missing on upload routes | `sendError(res, 400, 'No file uploaded.', 'NO_FILE')` |
| `status` missing on status update | Not validated here — handled in service |
| Service throws `AppError` | `next(e)` → global handler returns appropriate status |
| Unexpected DB error | `next(e)` → global handler returns 500 |

---

## 9. EXAMPLE USAGE

**Record a manual payment:**
```http
PATCH /api/v1/institute/fees/17/manual-payment
Authorization: Bearer <token>
Content-Type: application/json

{ "amount": 5000, "payment_mode": "cash", "note": "Paid at front desk" }
```

**Mark attendance for a session:**
```http
POST /api/v1/institute/attendance/sessions/8/mark
Authorization: Bearer <token>
Content-Type: application/json

{ "records": [{ "student_id": 5, "status": "present" }, { "student_id": 6, "status": "absent" }] }
```

---

## 10. EDGE CASES / NOTES

- **`deleteTimetableEntry` doesn't pass userId to service** — this means the service function for this action may not enforce ownership, relying only on the global `restrictTo('institute')` middleware.
- **File URL construction is done in the controller** for upload routes (`/uploads/logos/<filename>`) — the service only receives the final string URL, not the raw `req.file` object.
- **No input validation beyond file presence** — all body field validation (required fields, formats) is delegated to the service layer.
- **Consistent error delegation** — no controller function uses `throw`; all errors go through `next(e)`.

---

## 11. SUMMARY

`institute_controller.js` is a thin, clean controller layer with 50+ exported async functions. Each function follows an identical pattern: extract from request → delegate to service → respond. It handles the one concern it owns — file-presence validation for upload endpoints — and delegates everything else. Its consistency makes it highly maintainable and easy to extend.
