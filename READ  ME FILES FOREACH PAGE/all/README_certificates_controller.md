# `certificates.controller.js` — Certificates HTTP Request Handler

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `certificates.controller.js` |
| **Location** | `modules/certificates/certificates.controller.js` |
| **File Type** | Controller (HTTP Request Handler) |
| **Project** | EduVerse |

**Purpose:** This file handles all HTTP requests for the EduVerse certificates module. It is an intentionally minimal controller — each exported function is a one-liner that delegates directly to `certificates.service.js` and returns the result via `sendSuccess`. It covers listing student certificates, viewing a single certificate, getting a download URL, and publicly verifying a certificate by its unique code.

---

## 2. Responsibility

- Extract required parameters from `req.user`, `req.params`.
- Delegate all business logic and DB operations to `certificates.service.js`.
- Return standardized HTTP responses via `sendSuccess`.
- Forward any thrown errors to Express's global error handler via `next(err)`.

**Why this file exists:** Maintains the separation between HTTP handling (controller) and business logic (service), consistent with other EduVerse modules like auth and materials.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `service` | `./certificates.service` | All certificate business logic and DB queries |
| `sendSuccess` | `../../shared/errorHandler` | Sends standardized JSON success responses |

Note: `sendError` is **not imported** — no inline field validation is performed in this controller. All error conditions are handled by the service throwing `AppError` instances.

---

## 4. Core Logic Breakdown

This controller is exceptionally concise. All four functions follow the same single pattern:

```js
async function name(req, res, next) {
  try {
    return sendSuccess(res, 200, 'Message.', await service.function(params));
  } catch (err) { next(err); }
}
```

The `await service.*()` call is inlined directly inside `sendSuccess` — there is no intermediate variable. If the service throws, the `catch` block forwards the error to `next(err)`.

---

## 5. Functions / Methods

### `list(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/certificates/` |
| **Auth** | Yes — student only |
| **Parameters** | `req.user.id` — from JWT middleware |
| **Response** | 200 `'Certificates fetched.'` with array of certificate objects |

Calls `service.listCertificates(req.user.id)`. Returns all certificates earned by the authenticated student.

---

### `detail(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/certificates/:id` |
| **Auth** | Yes — student only |
| **Parameters** | `req.params.id` — certificate ID, `req.user.id` |
| **Response** | 200 `'Certificate fetched.'` with single certificate object |

Calls `service.getCertificate(req.params.id, req.user.id)`. The service enforces that the certificate belongs to the requesting student — `req.user.id` is passed as an ownership guard.

---

### `download(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/certificates/:id/download` |
| **Auth** | Yes — student only |
| **Parameters** | `req.params.id`, `req.user.id` |
| **Response** | 200 `'Download URL generated.'` with `{ download_url, certificate_code, title }` |

Calls `service.getDownloadUrl(req.params.id, req.user.id)`. Returns a download URL if the certificate exists and belongs to the student — does not redirect to the file or stream it.

---

### `verify(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/certificates/verify/:code` |
| **Auth** | No — public endpoint |
| **Parameters** | `req.params.code` — certificate code string |
| **Response** | 200 `'Certificate verified.'` with `{ valid: true, certificate }` |

Calls `service.verifyCertificate(req.params.code)`. The only public-facing endpoint in the module — allows anyone (employers, institutions) to verify a certificate's authenticity by its code.

---

## 6. API Role

| Function | Method | Route | Auth |
|---|---|---|---|
| `verify` | GET | `/api/certificates/verify/:code` | Public |
| `list` | GET | `/api/certificates/` | Student only |
| `detail` | GET | `/api/certificates/:id` | Student only |
| `download` | GET | `/api/certificates/:id/download` | Student only |

---

## 8. Data Flow

```
HTTP Request
      │
      ▼
[protect + restrictTo('student') — except verify]
      │
      ▼
certificates.controller.*(req, res, next)
      │
      │  req.user.id OR req.params.id OR req.params.code
      ▼
certificates.service.*()
      │
      ▼
MySQL query result or AppError thrown
      │
      ├── Success → sendSuccess(res, 200, message, data)
      └── Error   → next(err) → global error handler
```

---

## 9. Connections

### Files That Call This File
- `modules/certificates/certificates.routes.js`

### Files This File Depends On
- `./certificates.service` — All business logic
- `../../shared/errorHandler` — `sendSuccess`

---

## 10. Middleware / Auth

Middleware is applied in `certificates.routes.js`, not in this file:
- `protect` + `restrictTo('student')` applied globally to all routes except `verify`.
- `verify` has no middleware — it is explicitly registered before the `router.use(protect, restrictTo('student'))` call in the routes file.

By the time any controller function runs, `req.user` is guaranteed to be populated for protected routes.

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Certificate not found | Service throws `AppError(404, 'NOT_FOUND')` → `next(err)` → global handler |
| Certificate belongs to a different student | Service query returns no result → same `AppError(404)` |
| Invalid/expired JWT | `protect` middleware (in routes) rejects before controller is reached |
| Non-student role | `restrictTo('student')` rejects before controller is reached |
| DB error | Caught by `catch(err)` → `next(err)` |

No inline `sendError` calls exist in this controller — all error paths go through `next(err)`.

---

## 12. Example Usage

### List Certificates
```http
GET /api/certificates/
Authorization: Bearer eyJhbGci...  ← student token

→ 200:
{
  "success": true,
  "message": "Certificates fetched.",
  "data": [
    {
      "id": 3,
      "title": "Introduction to Algebra",
      "certificate_code": "EV-A1B2C3D4-5",
      "issued_at": "2026-03-15T10:00:00.000Z",
      "file_url": null,
      "course_title": "Algebra Fundamentals",
      "instructor_name": "Dr. Smith"
    }
  ]
}
```

### Public Certificate Verification
```http
GET /api/certificates/verify/EV-A1B2C3D4-5

→ 200:
{
  "success": true,
  "message": "Certificate verified.",
  "data": {
    "valid": true,
    "certificate": {
      "certificate_code": "EV-A1B2C3D4-5",
      "issued_at": "2026-03-15T10:00:00.000Z",
      "title": "Introduction to Algebra",
      "student_name": "Jane Doe",
      "course_title": "Algebra Fundamentals"
    }
  }
}
```

---

## 13. Edge Cases / Notes

- **No `sendError` imported:** The controller assumes the service always throws `AppError` for error cases rather than returning a falsy value. If the service is ever refactored to return `null` instead of throwing, errors would be silently swallowed.
- **Inline `await` in `sendSuccess`:** The pattern `sendSuccess(res, 200, msg, await service.fn())` means if `service.fn()` throws, the error is caught by `catch(err)` before `sendSuccess` is ever called. This is correct behavior.
- **`verify` is truly public:** No auth middleware of any kind is on the verify route. It's designed for external verification (e.g., an employer scanning a QR code linking to the verification URL).
- **Download URL, not file stream:** `download` returns a URL string, not a binary stream. The actual file serving is handled by Express's static file middleware or a CDN — this controller doesn't stream files.

---

## 14. Summary

`certificates.controller.js` is the minimal HTTP handler layer for EduVerse's certificates module. It exports four concise functions — `list`, `detail`, `download`, and `verify` — each delegating directly to the service layer with zero business logic. Error handling relies entirely on the service throwing structured `AppError` instances. The `verify` function is the only public-facing certificate endpoint, enabling anyone to authenticate a certificate by its unique code.
