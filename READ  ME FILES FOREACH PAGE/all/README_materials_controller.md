# `materials.controller.js` — Study Materials HTTP Request Handler

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `materials.controller.js` |
| **Location** | `modules/materials/materials.controller.js` |
| **File Type** | Controller (HTTP Request Handler) |
| **Project** | EduVerse |

**Purpose:** This file handles all HTTP requests related to study materials in EduVerse. It covers browsing materials (public), purchasing free and paid materials (student), downloading purchased materials (student), submitting reviews (student), uploading materials (instructor), and deleting materials (instructor).

---

## 2. Responsibility

The materials controller:
- Parses incoming request data (params, query strings, body, uploaded files).
- Validates specific field constraints (e.g., rating range 1–5).
- Delegates all business logic to `materials.service.js`.
- Returns standardized success or error HTTP responses.
- Passes unexpected errors to Express's global error handler.

**Why this file exists:** Separates HTTP request/response handling from business logic and DB operations in the materials module.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `service` | `./materials.service` | All materials business logic and database operations |
| `sendSuccess` | `../../shared/errorHandler` | Sends standardized success JSON responses |
| `sendError` | `../../shared/errorHandler` | Sends standardized error JSON responses inline |

---

## 4. Core Logic Breakdown

Every function follows the same delegation pattern:
```
try {
  [extract params from req]
  [optional: validate fields → sendError]
  const result = await service.functionName(params);
  return sendSuccess(res, statusCode, message, result);
} catch (err) { next(err); }
```

No business logic exists in the controller — it purely bridges HTTP requests to the service layer.

---

## 5. Functions / Methods

### `getMaterials(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/materials/` |
| **Auth Required** | No (public) |
| **Parameters** | `req.query` — filter/sort/pagination options |
| **Response** | 200 with `{ materials, pagination }` |

Passes the entire `req.query` object to `service.getMaterials()`. The service handles all filter/sort/pagination parsing. No validation in controller.

---

### `getMaterial(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/materials/:id` |
| **Auth Required** | Optional (via `protect` in routes) |
| **Parameters** | `req.params.id`, `req.user` (optional) |
| **Response** | 200 with full material object including reviews |

**Special handling:**
```js
const studentId = req.user ? req.user.id : null;
```
Passes `null` as `studentId` if the user is not authenticated. This allows the service to conditionally include the "purchased" status in the response.

---

### `purchaseMaterial(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/materials/:id/purchase` |
| **Auth Required** | Yes — student only |
| **Parameters** | `req.params.id`, `req.user.id` |
| **Response** | 200 with purchase result (free: immediate access; paid: payment details) |

---

### `confirmPurchase(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/materials/:id/confirm-purchase` |
| **Auth Required** | Yes — student only |
| **Parameters** | `req.params.id`, `req.user.id`, `req.body.payment_id`, `req.body.amount_paid` |
| **Response** | 200 with `{ success: true, message }` |

Called after a successful payment gateway transaction to record the purchase in the database.

---

### `getDownloadUrl(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/materials/:id/download` |
| **Auth Required** | Yes — student only |
| **Parameters** | `req.params.id`, `req.user.id` |
| **Response** | 200 with `{ download_url, file_name }` |

---

### `getMyPurchases(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/materials/my/purchases` |
| **Auth Required** | Yes — student only |
| **Parameters** | `req.user.id` |
| **Response** | 200 with array of purchased materials |

---

### `addReview(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/materials/:id/review` |
| **Auth Required** | Yes — student only |
| **Parameters** | `req.params.id`, `req.user.id`, `req.body.rating`, `req.body.review_text` |
| **Response** | 200 with `{ message }` |

**Controller-level validation:**
```js
if (!rating || rating < 1 || rating > 5) {
  return sendError(res, 400, 'Rating must be between 1 and 5.', 'INVALID_RATING');
}
```
Only controller function that validates a non-presence constraint (value range). Returns immediately with `400 INVALID_RATING` if rating is missing or out of bounds.

---

### `uploadMaterial(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/materials/upload` |
| **Auth Required** | Yes — instructor only |
| **Parameters** | `req.user.id`, `req.body` (title, description, subject, etc.), `req.file` (multer) |
| **Response** | 201 with `{ id, message }` |

Passes user ID, the full request body, and the multer file object to the service.

---

### `getMyMaterials(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/materials/my/materials` |
| **Auth Required** | Yes — instructor only |
| **Parameters** | `req.user.id` |
| **Response** | 200 with array of instructor's uploaded materials |

---

### `deleteMaterial(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | DELETE |
| **Route** | `/api/materials/:id` |
| **Auth Required** | Yes — instructor only |
| **Parameters** | `req.params.id`, `req.user.id` |
| **Response** | 200 with `{ message }` |

The service handles ownership verification — only the instructor who uploaded the material can delete it.

---

### `getCategories(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/materials/categories` |
| **Auth Required** | No (public) |
| **Parameters** | None |
| **Response** | 200 with array of category strings |

---

## 6. API Role

| Controller Function | Method | Path | Auth |
|---|---|---|---|
| `getMaterials` | GET | `/` | Public |
| `getCategories` | GET | `/categories` | Public |
| `getMaterial` | GET | `/:id` | Optional auth |
| `purchaseMaterial` | POST | `/:id/purchase` | Student |
| `confirmPurchase` | POST | `/:id/confirm-purchase` | Student |
| `getDownloadUrl` | GET | `/:id/download` | Student |
| `getMyPurchases` | GET | `/my/purchases` | Student |
| `addReview` | POST | `/:id/review` | Student |
| `uploadMaterial` | POST | `/upload` | Instructor |
| `getMyMaterials` | GET | `/my/materials` | Instructor |
| `deleteMaterial` | DELETE | `/:id` | Instructor |

---

## 8. Data Flow

```
HTTP Request
      │
      ▼
[Auth middleware if applicable]
      │
      ▼
materials.controller.*()
      │
      ├── Extract: req.params / req.body / req.query / req.file / req.user
      │
      ├── Validate (rating range only for addReview)
      │
      ▼
materials.service.*()
      │
      ▼
MySQL DB
      │
      ▼
sendSuccess / sendError  →  HTTP JSON Response
```

---

## 9. Connections

### Files That Call This File
- `modules/materials/materials.routes.js`

### Files This File Depends On
- `./materials.service` — All business logic
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

---

## 10. Middleware / Auth

Middleware is configured in `materials.routes.js`:
- `protect` — applied per-route to protected endpoints
- `restrictTo('student')` — for purchase, download, review routes
- `restrictTo('instructor')` — for upload, getMyMaterials, delete routes
- `upload.single('file')` — multer applied to the upload route

The `getMaterial` route uses `protect` but not `restrictTo`, so any authenticated user (or unauthenticated) can view material details.

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Invalid rating (missing or out of 1–5 range) | Inline `sendError(res, 400, ..., 'INVALID_RATING')` |
| Service throws `AppError` | `catch(err)` → `next(err)` |
| Unexpected errors | `catch(err)` → `next(err)` |

---

## 12. Example Usage

### Browse Materials with Filters
```http
GET /api/materials?search=algebra&type=notes&is_free=true&sort=newest&page=1&limit=12
```

### Purchase a Free Material
```http
POST /api/materials/5/purchase
Authorization: Bearer eyJhbGci...

→ 200: { success: true, free: true, message: "Material added to your library." }
```

### Upload Material (Instructor)
```http
POST /api/materials/upload
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

title: "Algebra Notes Chapter 1"
subject: "Mathematics"
type: "notes"
is_free: false
price: 49.99
file: [binary PDF]
```

### Add Review
```http
POST /api/materials/5/review
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{ "rating": 4, "review_text": "Very helpful material!" }
```

---

## 13. Edge Cases / Notes

- **`getMaterial` with optional auth:** The controller checks `req.user` before reading `req.user.id` — prevents a crash when the route is accessed without a token.
- **`rating` validation:** The check `!rating` treats `0` as falsy — correctly rejects 0 as an invalid rating since the minimum is 1.
- **`uploadMaterial` passes `req.file` directly:** The service receives the full multer file object and is responsible for extracting `filename`, `size`, and `originalname`.
- **`deleteMaterial` ownership:** The controller does not check ownership — it passes both `materialId` and `instructorId` to the service, which performs the ownership check in its SQL query.

---

## 14. Summary

`materials.controller.js` handles all HTTP request/response operations for the EduVerse study materials module. It supports 11 distinct operations across public, student, and instructor access levels. The controller performs minimal validation (only rating range for reviews), delegates all logic to the service layer, and formats uniform JSON responses. File upload data from multer (`req.file`) is passed directly to the service for processing.
