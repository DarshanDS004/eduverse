# `certificates.routes.js` — Certificates Route Definitions

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `certificates.routes.js` |
| **Location** | `modules/certificates/certificates.routes.js` |
| **File Type** | Route Definition |
| **Project** | EduVerse |

**Purpose:** Defines all HTTP routes for the EduVerse certificates module. It maps URL paths to controller functions and applies authentication middleware — notably using `router.use()` to protect all routes in bulk after first registering the one public endpoint.

---

## 2. Responsibility

- Register the public certificate verification endpoint (no auth).
- Apply `protect` + `restrictTo('student')` globally to all remaining routes.
- Map student certificate routes to their controller functions.
- Export the configured router for app-level mounting.

**Why this file exists:** Isolates routing configuration from controller and service logic, consistent with the rest of EduVerse's module structure.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework, provides `Router()` |
| `controller` | `./certificates.controller` | Route handler functions |
| `protect` | `../auth/auth.middleware` | JWT verification middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control middleware |

---

## 4. Core Logic Breakdown

This file uses a deliberate **middleware ordering** pattern that is worth understanding carefully:

```js
// Step 1: Register the PUBLIC route BEFORE the global middleware
router.get('/verify/:code', controller.verify);  // ← No auth

// Step 2: Apply auth middleware to all subsequent routes
router.use(protect, restrictTo('student'));

// Step 3: Register protected routes (they inherit the router.use middleware)
router.get('/',             controller.list);
router.get('/:id',          controller.detail);
router.get('/:id/download', controller.download);
```

**Why this order matters:** In Express, `router.use()` only applies to routes registered **after** it in the file. By registering `/verify/:code` first (before `router.use(protect, restrictTo('student'))`), that route is not subject to the auth middleware. All routes registered after the `router.use()` call are automatically protected.

This is a clean, concise pattern for modules with one public route and multiple protected ones.

---

## 5. Route Definitions

| Method | Path | Auth | Controller | Description |
|---|---|---|---|---|
| GET | `/verify/:code` | **None (public)** | `controller.verify` | Publicly verify a certificate by code |
| GET | `/` | `protect` + `restrictTo('student')` | `controller.list` | List all student's certificates |
| GET | `/:id` | `protect` + `restrictTo('student')` | `controller.detail` | Get a single certificate's details |
| GET | `/:id/download` | `protect` + `restrictTo('student')` | `controller.download` | Get download URL for a certificate |

---

## 6. API Role

When mounted at `/api/certificates` (assumed):

```
GET  /api/certificates/verify/:code   ← Public — no token needed
GET  /api/certificates/               ← Student only
GET  /api/certificates/:id            ← Student only
GET  /api/certificates/:id/download   ← Student only
```

All routes are read-only (`GET`). There are no `POST`, `PATCH`, or `DELETE` routes — certificate creation is handled automatically by `student.service.js` (`_issueCertificateIfNotExists`) when a student reaches 100% course completion.

---

## 7. Critical Route Ordering

```js
router.get('/verify/:code', controller.verify);  // MUST be first
router.use(protect, restrictTo('student'));        // MUST be before protected routes
router.get('/', controller.list);
router.get('/:id', controller.detail);
router.get('/:id/download', controller.download);
```

**`/verify/:code` vs `/:id`:** The `/verify/:code` path is a static prefix (`/verify/`) followed by a param. Express can distinguish this from `/:id` because `/verify/...` has two path segments while `/:id` has one. There is no route conflict here.

**`/:id` vs `/:id/download`:** These are registered in the correct order. `/:id/download` is registered after `/:id` — Express matches routes in order, and since `/download` is a static suffix, Express correctly routes `GET /:id/download` to `controller.download` rather than `controller.detail`.

---

## 8. Data Flow

```
HTTP Request
      │
      ├── GET /verify/:code
      │         │
      │         ▼
      │    No middleware → controller.verify()
      │
      └── All other routes
                │
                ▼
          router.use: protect (JWT check)
                │
                ▼
          router.use: restrictTo('student')
                │
                ▼
          controller.list / .detail / .download
```

---

## 9. Connections

### Files That Call This File
- Main app entry point (e.g., `app.js`) — mounts at `/api/certificates`.

### Files This File Depends On
- `./certificates.controller` — Route handlers
- `../auth/auth.middleware` — `protect`, `restrictTo`

---

## 10. Middleware / Auth

| Route | Middleware |
|---|---|
| `GET /verify/:code` | **None** — intentionally public |
| `GET /` | `protect` → `restrictTo('student')` |
| `GET /:id` | `protect` → `restrictTo('student')` |
| `GET /:id/download` | `protect` → `restrictTo('student')` |

The `router.use(protect, restrictTo('student'))` call passes **both** middlewares in one call — Express runs them in order: `protect` first (JWT verification), then `restrictTo('student')` (role check).

---

## 11. Error Handling

No error handling is defined in this file. Errors propagate from:
- `protect` — sends `401` JSON for auth failures.
- `restrictTo` — sends `403` JSON for role failures.
- `certificates.controller.*` — calls `next(err)` for service errors.
- Global Express error handler — formats the final error response.

---

## 12. Example Usage

### How this router is mounted (assumed):
```js
const certRoutes = require('./modules/certificates/certificates.routes');
app.use('/api/certificates', certRoutes);
```

### Client calls:
```http
# Public verification (no token needed)
GET /api/certificates/verify/EV-A1B2C3-5

# Student lists their certificates
GET /api/certificates/
Authorization: Bearer eyJhbGci...

# Student gets certificate detail
GET /api/certificates/3
Authorization: Bearer eyJhbGci...

# Student gets download URL
GET /api/certificates/3/download
Authorization: Bearer eyJhbGci...
```

---

## 13. Edge Cases / Notes

- **`router.use()` positional behavior:** This is an Express-specific subtlety — `router.use()` only affects routes defined after it in the same file. Developers unfamiliar with this could accidentally register protected routes before the `router.use()` call and wonder why they aren't protected.
- **No write routes:** Certificates cannot be created, modified, or deleted via this API — certificate creation is an automated side effect of course completion in `student.service.js`.
- **`/verify/:code` is truly public:** There is zero authentication on this route by design — it's meant to be shared externally (e.g., on a resume, LinkedIn, or embedded in a QR code).
- **Only students can access their own certificates:** `restrictTo('student')` blocks instructors and admin users from accessing student certificate data through these routes.

---

## 14. Summary

`certificates.routes.js` is a compact, well-structured route file for EduVerse's certificate system. It uses Express's positional `router.use()` to cleanly separate one public route (`/verify/:code`) from three student-only protected routes (`/`, `/:id`, `/:id/download`). All routes are read-only — no write operations are exposed here. The file is notable for its clean use of the pre-middleware public route pattern.
