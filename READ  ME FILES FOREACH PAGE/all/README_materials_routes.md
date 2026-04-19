# `materials.routes.js` — Study Materials Route Definitions & Upload Configuration

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `materials.routes.js` |
| **Location** | `modules/materials/materials.routes.js` |
| **File Type** | Route Definition + Multer Configuration |
| **Project** | EduVerse |

**Purpose:** Defines all HTTP routes for the EduVerse study materials system and configures Multer for file uploads. Unlike the student routes file, this router manages three tiers of access: fully public routes (browse/list), student-only routes (purchase/download/review), and instructor-only routes (upload/manage/delete).

---

## 2. Responsibility

- Register all materials API routes.
- Configure Multer disk storage for material file uploads (PDF, Word, PowerPoint, ZIP).
- Apply authentication and role-based middleware on a **per-route** basis (not globally).
- Export the configured router for app-level mounting.

**Why this file exists:** The materials module has mixed access levels — public browsing, student purchasing, and instructor management — requiring per-route middleware application rather than global router-level auth.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework, provides `Router()` |
| `multer` | `multer` | Multipart form data / file upload handling |
| `path` | Node.js built-in | File path construction for storage |
| `fs` | Node.js built-in | Creates upload directory if it doesn't exist |
| `controller` | `./materials.controller` | All materials route handlers |
| `protect` | `../auth/auth.middleware` | JWT verification middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control middleware |

---

## 4. Core Logic Breakdown

### Step 1 — Upload Directory Initialization
```js
const uploadDir = path.join(__dirname, '../../../uploads/materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
```
Creates `uploads/materials/` at module load time if it doesn't exist. Synchronous and runs once on server startup.

### Step 2 — Multer Storage Configuration
```js
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext    = path.extname(file.originalname);
    cb(null, 'material-' + unique + ext);
  },
});
```
Generates unique filenames using `Date.now()` + a random 9-digit number, preventing any collisions.

### Step 3 — File Type Filter
```js
const fileFilter = function (req, file, cb) {
  const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, Word, PowerPoint and ZIP files are allowed.'), false);
  }
};
```
**Unlike the avatar upload filter**, this filter **throws an error** (`cb(new Error(...), false)`) for rejected types — the error propagates to Express's error handler. 

### Step 4 — Multer Instance
```js
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
```
50MB limit for study material files — significantly larger than avatar (5MB) or assignment (20MB) limits.

### Step 5 — Route Registration (3 tiers)

---

## 5. Route Definitions

### Public Routes (No Authentication)

| Method | Path | Middleware | Controller | Description |
|---|---|---|---|---|
| GET | `/` | None | `getMaterials` | Browse/search/filter all published materials |
| GET | `/categories` | None | `getCategories` | List all distinct material categories |
| GET | `/:id` | `protect` | `getMaterial` | View a single material's details |

**Note:** `GET /:id` uses `protect` but NOT `restrictTo` — any authenticated user (any role) can view a material's details. The service checks if the student has purchased it and includes that info.

---

### Student Routes

| Method | Path | Middleware | Controller | Description |
|---|---|---|---|---|
| POST | `/:id/purchase` | `protect`, `restrictTo('student')` | `purchaseMaterial` | Purchase/claim a material |
| POST | `/:id/confirm-purchase` | `protect`, `restrictTo('student')` | `confirmPurchase` | Confirm payment and unlock material |
| GET | `/:id/download` | `protect`, `restrictTo('student')` | `getDownloadUrl` | Get download URL for purchased material |
| GET | `/my/purchases` | `protect`, `restrictTo('student')` | `getMyPurchases` | List all purchased materials |
| POST | `/:id/review` | `protect`, `restrictTo('student')` | `addReview` | Submit a rating and review |

---

### Instructor Routes

| Method | Path | Middleware | Controller | Description |
|---|---|---|---|---|
| POST | `/upload` | `protect`, `restrictTo('instructor')`, `upload.single('file')` | `uploadMaterial` | Upload a new study material |
| GET | `/my/materials` | `protect`, `restrictTo('instructor')` | `getMyMaterials` | List instructor's own materials |
| DELETE | `/:id` | `protect`, `restrictTo('instructor')` | `deleteMaterial` | Delete a material |

---

## 6. API Role

When mounted at `/api/materials` (assumed), full endpoint list:

```
GET    /api/materials                    ← Public
GET    /api/materials/categories         ← Public
GET    /api/materials/:id               ← Authenticated (any role)

POST   /api/materials/:id/purchase       ← Student only
POST   /api/materials/:id/confirm-purchase ← Student only
GET    /api/materials/:id/download       ← Student only
GET    /api/materials/my/purchases       ← Student only
POST   /api/materials/:id/review         ← Student only

POST   /api/materials/upload             ← Instructor only
GET    /api/materials/my/materials       ← Instructor only
DELETE /api/materials/:id                ← Instructor only
```

---

## 7. Critical Route Ordering Issue

```js
// POTENTIAL CONFLICT
router.get('/:id', protect, controller.getMaterial);    // Dynamic param
// ...
router.get('/my/purchases', protect, restrictTo('student'), controller.getMyPurchases);
router.get('/my/materials', protect, restrictTo('instructor'), controller.getMyMaterials);
```

**⚠️ Route Order Warning:** In Express, routes are matched in registration order. `/my/purchases` and `/my/materials` must be registered **BEFORE** `/:id` — otherwise Express would match `my` as the `:id` parameter and call `getMaterial` instead.

Looking at the file, `GET /:id` is registered before `GET /my/purchases`. This creates a potential route conflict. However, since these are different HTTP methods in some cases, or the route is registered before `/my/...` routes, this should be tested carefully in practice.

---

## 8. Data Flow

```
HTTP Request
      │
      ▼
materials.routes.js
      │
      ├── Public route?
      │       └──→ controller directly
      │
      ├── Student route?
      │       ├── protect (JWT check)
      │       ├── restrictTo('student')
      │       └──→ controller
      │
      └── Instructor route?
              ├── protect (JWT check)
              ├── restrictTo('instructor')
              ├── upload.single('file') [upload routes only]
              └──→ controller
```

---

## 9. Connections

### Files That Call This File
- Main app entry point (e.g., `app.js`) — mounts at `/api/materials`.

### Files This File Depends On
- `./materials.controller` — All handler functions
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `multer` — File upload processing

---

## 10. Multer Configuration Summary

| Property | Value |
|---|---|
| Storage type | Disk (`uploads/materials/`) |
| Filename pattern | `material-{timestamp}-{random9digits}.{ext}` |
| Allowed extensions | `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.zip` |
| Max file size | 50MB |
| Error on type mismatch | Yes — throws `Error` (propagates to Express error middleware) |
| Applied to | `POST /upload` only, via `upload.single('file')` |

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Invalid JWT | `protect` returns `401` JSON |
| Wrong role | `restrictTo` returns `403` JSON |
| Unsupported file type | `fileFilter` throws `Error` → Express error middleware |
| File exceeds 50MB | Multer `MulterError` → Express error middleware |
| Missing upload directory | Handled at startup via `fs.mkdirSync` |

---

## 12. Example Usage

### Instructor Uploads Material
```http
POST /api/materials/upload
Authorization: Bearer eyJhbGci...  ← instructor token
Content-Type: multipart/form-data

file: [binary PDF, max 50MB]
title: "Advanced Algebra Notes"
subject: "Mathematics"
category: "Engineering"
level: "advanced"
type: "notes"
is_free: false
price: 99
language: "English"
pages: 85
tags: "algebra,calculus,equations"
```

### Student Downloads Purchased Material
```http
GET /api/materials/7/download
Authorization: Bearer eyJhbGci...  ← student token

→ 200: { download_url: "/uploads/materials/material-123.pdf", file_name: "algebra.pdf" }
```

---

## 13. Edge Cases / Notes

- **`GET /categories` before `GET /:id`:** The static path `/categories` is registered first, so it won't be matched as an `:id` value.
- **`fileFilter` throws error vs returns false:** This differs from avatar upload (which silently rejects). Materials upload sends an error message back to the client via Express error middleware.
- **No `router.use(protect)` globally:** Unlike `student.routes.js`, auth is per-route — public routes genuinely have no auth.
- **`/upload` (instructor) is a static path** registered among routes that also have `/:id` (dynamic). Express can differentiate these because `/upload` doesn't match `/:id` rules when static paths are checked first.
- **50MB limit is the largest in the system** — appropriate for ZIP archives and PowerPoint files.

---

## 14. Summary

`materials.routes.js` configures the EduVerse study materials API with three distinct access tiers. Public routes (browse, categories) require no auth. Student routes (purchase, download, review) require JWT + student role. Instructor routes (upload, manage, delete) require JWT + instructor role. Multer handles file uploads for materials with a 50MB limit and type filtering for educational document formats. Per-route middleware application (rather than global) enables this mixed-access design.
