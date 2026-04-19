# `institute_routes.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/institute/`  
> **File path:** `modules/institute/institute.routes.js`  
> **File type:** Route Definition File (Express Router)

---

## 1. FILE OVERVIEW

**File name:** `institute_routes.js`  
**File type:** Route definition / Express Router  
**Purpose:** Declares all HTTP routes for the Institute admin portal in EduVerse. It maps URL patterns to controller handlers, configures file-upload middleware (Multer) for different upload categories, and enforces authentication and role-based access control at the router level.

---

## 2. RESPONSIBILITY

This file is the **routing layer** for the entire Institute module. It:

- Applies `protect` (JWT auth) and `restrictTo('institute')` globally to every route, ensuring only institute-role users can access any endpoint.
- Configures multiple Multer storage configurations for different file types (logos, documents, materials, videos, bulk CSVs).
- Maps every HTTP verb + path combination to the appropriate controller function in `institute.controller.js`.
- Provides 60+ routes spanning: dashboard, profile, student management, teacher management, classes, academic years, timetable, calendar, attendance, fees, content, announcements, certificates, and analytics/reports.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework |
| `router` | `express.Router()` | Creates an isolated route namespace |
| `multer` | `multer` | Multipart form-data / file upload handling |
| `path` | Node.js built-in | File path utilities (extensions, directory joining) |
| `fs` | Node.js built-in | File system access (directory creation check) |
| `ctrl` | `./institute.controller` | All controller functions for this module |
| `protect` | `../auth/auth.middleware` | JWT verification middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control middleware |

---

## 4. CORE LOGIC BREAKDOWN

### Global Middleware Stack
```js
router.use(protect);
router.use(restrictTo('institute'));
```
Every single route is protected. Unauthenticated requests receive a `401`. Non-institute roles receive a `403`. These two lines run before any route handler.

### Multer Upload Factory (`makeStorage`)
```js
function makeStorage(sub) {
  const dir = path.join(__dirname, '../../../uploads', sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, sub.replace('/', '-') + '-' + Date.now() + ext);
    },
  });
}
```
**Purpose:** Generates a Multer `diskStorage` configuration for a named subdirectory under `/uploads/`. Key behaviors:
- Creates the target directory if it doesn't exist (`fs.mkdirSync`).
- Generates a collision-resistant filename: `<subdir>-<timestamp>.<ext>`.
- Normalizes the extension to lowercase.

### Upload Middleware Instances

| Variable | Subdirectory | Max File Size |
|---|---|---|
| `logoUpload` | `logos/` | 5 MB |
| `docUpload` | `docs/` | 20 MB |
| `materialUpload` | `materials/` | 50 MB |
| `videoUpload` | `videos/` | 500 MB |
| `bulkUpload` | `bulk/` | 10 MB |

Each is configured as a Multer instance with `.single('fieldname')` usage on specific routes.

---

## 5. ROUTE GROUPS & ENDPOINTS

### Dashboard
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/dashboard` | `ctrl.getDashboard` | Aggregated institute stats |

### Profile
| Method | Path | Multer | Handler | Description |
|---|---|---|---|---|
| GET | `/profile` | — | `ctrl.getProfile` | Fetch institute profile |
| PATCH | `/profile` | — | `ctrl.updateProfile` | Update profile fields |
| POST | `/profile/logo` | `logoUpload.single('logo')` | `ctrl.uploadLogo` | Upload institute logo |
| POST | `/profile/accreditation` | `docUpload.single('document')` | `ctrl.uploadAccreditation` | Upload accreditation document |

### Student Management
| Method | Path | Multer | Handler |
|---|---|---|---|
| GET | `/students` | — | `ctrl.getStudents` |
| GET | `/students/:id` | — | `ctrl.getStudent` |
| POST | `/students` | — | `ctrl.addStudent` |
| POST | `/students/bulk-import` | `bulkUpload.single('file')` | `ctrl.bulkImportStudents` |
| PATCH | `/students/:id` | — | `ctrl.updateStudent` |
| PATCH | `/students/:id/status` | — | `ctrl.updateStudentStatus` |
| DELETE | `/students/:id` | — | `ctrl.removeStudent` |
| POST | `/students/:id/link-parent` | — | `ctrl.linkParent` |
| GET | `/students/:id/generate-id-card` | — | `ctrl.generateIdCard` |
| GET | `/pending-registrations` | — | `ctrl.getPendingRegistrations` |
| PATCH | `/pending-registrations/:id/approve` | — | `ctrl.approveRegistration` |
| PATCH | `/pending-registrations/:id/reject` | — | `ctrl.rejectRegistration` |

### Teacher Management
| Method | Path | Multer | Handler |
|---|---|---|---|
| GET | `/teachers` | — | `ctrl.getTeachers` |
| GET | `/teachers/:id` | — | `ctrl.getTeacher` |
| POST | `/teachers` | — | `ctrl.addTeacher` |
| POST | `/teachers/bulk-import` | `bulkUpload.single('file')` | `ctrl.bulkImportTeachers` |
| PATCH | `/teachers/:id` | — | `ctrl.updateTeacher` |
| PATCH | `/teachers/:id/status` | — | `ctrl.updateTeacherStatus` |
| DELETE | `/teachers/:id` | — | `ctrl.removeTeacher` |

### Class & Batch Management
| Method | Path | Handler |
|---|---|---|
| GET | `/classes` | `ctrl.getClasses` |
| POST | `/classes` | `ctrl.createClass` |
| GET | `/classes/:id` | `ctrl.getClass` |
| PATCH | `/classes/:id` | `ctrl.updateClass` |
| DELETE | `/classes/:id` | `ctrl.deleteClass` |
| POST | `/classes/:id/students` | `ctrl.assignStudentToClass` |
| DELETE | `/classes/:id/students/:sid` | `ctrl.removeStudentFromClass` |
| POST | `/classes/:id/teachers` | `ctrl.assignTeacherToClass` |
| DELETE | `/classes/:id/teachers/:tid` | `ctrl.removeTeacherFromClass` |
| POST | `/students/:id/transfer-class` | `ctrl.transferStudent` |

### Academic Years
| Method | Path | Handler |
|---|---|---|
| GET | `/academic-years` | `ctrl.getAcademicYears` |
| POST | `/academic-years` | `ctrl.createAcademicYear` |
| PATCH | `/academic-years/:id` | `ctrl.updateAcademicYear` |

### Timetable
| Method | Path | Handler |
|---|---|---|
| GET | `/timetable` | `ctrl.getTimetable` |
| POST | `/timetable` | `ctrl.createTimetableEntry` |
| PATCH | `/timetable/:id` | `ctrl.updateTimetableEntry` |
| DELETE | `/timetable/:id` | `ctrl.deleteTimetableEntry` |

### Academic Calendar
| Method | Path | Handler |
|---|---|---|
| GET | `/calendar` | `ctrl.getCalendar` |
| POST | `/calendar` | `ctrl.createCalendarEvent` |
| PATCH | `/calendar/:id` | `ctrl.updateCalendarEvent` |
| DELETE | `/calendar/:id` | `ctrl.deleteCalendarEvent` |

### Attendance
| Method | Path | Handler |
|---|---|---|
| GET | `/attendance/sessions` | `ctrl.getAttendanceSessions` |
| POST | `/attendance/sessions` | `ctrl.createAttendanceSession` |
| POST | `/attendance/sessions/:id/mark` | `ctrl.markAttendance` |
| PATCH | `/attendance/records/:id` | `ctrl.overrideAttendance` |
| GET | `/attendance/student/:studentId` | `ctrl.getStudentAttendance` |
| GET | `/attendance/class/:classId` | `ctrl.getClassAttendance` |

### Fee Management
| Method | Path | Handler |
|---|---|---|
| GET | `/fees/structures` | `ctrl.getFeeStructures` |
| POST | `/fees/structures` | `ctrl.createFeeStructure` |
| PATCH | `/fees/structures/:id` | `ctrl.updateFeeStructure` |
| DELETE | `/fees/structures/:id` | `ctrl.deleteFeeStructure` |
| POST | `/fees/assign` | `ctrl.assignFee` |
| GET | `/fees/students` | `ctrl.getStudentFees` |
| PATCH | `/fees/:id/manual-payment` | `ctrl.recordManualPayment` |
| POST | `/fees/send-reminder` | `ctrl.sendFeeReminder` |

### Content Management
| Method | Path | Multer | Handler |
|---|---|---|---|
| GET | `/content` | — | `ctrl.getContent` |
| POST | `/content/video` | `videoUpload.single('video')` | `ctrl.uploadVideo` |
| POST | `/content/material` | `materialUpload.single('file')` | `ctrl.uploadMaterial` |
| PATCH | `/content/:id` | — | `ctrl.updateContent` |
| DELETE | `/content/:id` | — | `ctrl.archiveContent` |

### Announcements
| Method | Path | Handler |
|---|---|---|
| GET | `/announcements` | `ctrl.getAnnouncements` |
| POST | `/announcements` | `ctrl.createAnnouncement` |
| DELETE | `/announcements/:id` | `ctrl.deleteAnnouncement` |

### Certificates & Documents
| Method | Path | Handler |
|---|---|---|
| POST | `/certificates/batch` | `ctrl.issueBatchCertificates` |
| POST | `/certificates/transfer/:studentId` | `ctrl.generateTransferCert` |
| POST | `/certificates/bonafide/:studentId` | `ctrl.generateBonafideCert` |

### Reports & Analytics
| Method | Path | Handler |
|---|---|---|
| GET | `/analytics` | `ctrl.getAnalytics` |
| GET | `/reports/student/:id` | `ctrl.getStudentReport` |
| GET | `/reports/class/:id` | `ctrl.getClassReport` |
| GET | `/reports/attendance` | `ctrl.getAttendanceReport` |
| GET | `/reports/fees` | `ctrl.getFeeReport` |

---

## 6. DATA FLOW

```
HTTP Request
    ↓
protect (JWT auth → req.user)
    ↓
restrictTo('institute') (role check)
    ↓
[optional] Multer middleware (parses file, writes to disk → req.file)
    ↓
Controller handler (ctrl.*)
    ↓
Service layer (institute.service.js)
    ↓
Response
```

---

## 7. CONNECTIONS

**Files that call this file:**
- Main `app.js` / `server.js` mounts this router (e.g., `app.use('/api/v1/institute', instituteRouter)`).

**Files this file depends on:**
- `./institute.controller` — All request handlers
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `multer` — File upload parsing
- `path`, `fs` — Directory management for upload destinations

---

## 8. MIDDLEWARE / AUTH

| Middleware | Scope | Effect |
|---|---|---|
| `protect` | All routes | JWT required; sets `req.user` |
| `restrictTo('institute')` | All routes | Only users with role `'institute'` allowed |
| `logoUpload.single('logo')` | `POST /profile/logo` | Parses multipart, saves to `/uploads/logos/`, sets `req.file` |
| `docUpload.single('document')` | `POST /profile/accreditation` | Parses multipart, saves to `/uploads/docs/` |
| `videoUpload.single('video')` | `POST /content/video` | Parses multipart, saves to `/uploads/videos/` (500 MB limit) |
| `materialUpload.single('file')` | `POST /content/material` | Saves to `/uploads/materials/` (50 MB limit) |
| `bulkUpload.single('file')` | Bulk import routes | Saves CSV/Excel to `/uploads/bulk/` (10 MB limit) |

---

## 9. ERROR HANDLING

This file itself does not handle errors. Error handling is delegated to:
- Multer: throws if file size exceeds limit; Express passes this to the global error handler.
- Controller functions: each uses `try/catch` with `next(e)`.
- Auth middleware: sends `401`/`403` directly before reaching the controller.

---

## 10. EXAMPLE USAGE

**Upload institute logo:**
```http
POST /api/v1/institute/profile/logo
Authorization: Bearer <institute_jwt>
Content-Type: multipart/form-data

logo=<file_data>
```

**Add a student:**
```http
POST /api/v1/institute/students
Authorization: Bearer <institute_jwt>
Content-Type: application/json

{ "name": "Arjun Kumar", "email": "arjun@example.com", "grade": "10", "class_id": 3 }
```

---

## 11. EDGE CASES / NOTES

- **Directory auto-creation:** `makeStorage` calls `fs.mkdirSync` with `{ recursive: true }` at server startup time (when the file is first `require`d). This means upload directories are created lazily on first use of each Multer instance.
- **Route conflict risk:** The path `/students/:id` and `/students/bulk-import` could conflict in some Express versions — Express resolves this by matching literal segments before parameterized ones, so `bulk-import` takes precedence.
- **All routes are institute-only:** The `router.use(restrictTo('institute'))` at the top means this entire router is inaccessible to students, parents, instructors, and superadmins.
- **No pagination on some routes:** GET `/classes`, `/academic-years`, `/announcements` return all records without pagination.
- **File size limits** are enforced by Multer and will result in a `MulterError` if exceeded.

---

## 12. SUMMARY

`institute_routes.js` is the comprehensive routing file for EduVerse's Institute admin module. It defines 60+ routes covering every administrative feature an institute needs: managing students and teachers, configuring classes and academic calendars, tracking attendance, managing fees, uploading content, issuing certificates, and generating reports. All routes are locked down to `institute`-role users via global middleware. File uploads are handled by five distinct Multer configurations, each targeting a specific upload category with appropriate file size limits.
