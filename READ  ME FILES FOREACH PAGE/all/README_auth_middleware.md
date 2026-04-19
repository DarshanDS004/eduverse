# `auth.middleware.js` — JWT Authentication & Role-Based Access Control

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `auth.middleware.js` |
| **Location** | `modules/auth/auth.middleware.js` |
| **File Type** | Middleware |
| **Project** | EduVerse |

**Purpose:** This file provides Express middleware for protecting routes. It verifies JWT access tokens, confirms user existence and account status in the database, and enforces role-based access control. It is used on every protected route in the EduVerse API.

---

## 2. Responsibility

Three distinct pieces of middleware are exported:

| Middleware | Role |
|---|---|
| `protect` | Verifies JWT, confirms user exists and is active, populates `req.user` |
| `restrictTo(...roles)` | Checks that the authenticated user has an allowed role |
| `optionalAuth` | Decodes JWT if present but never rejects — used on semi-public routes |

**Why this file exists:** To centralize authentication logic in one place, so every route doesn't have to reimplement token extraction and DB verification.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `jsonwebtoken` | `jsonwebtoken` | Verifying JWT signatures and decoding payloads |
| `AppError` | `../../shared/errorHandler` | Structured error class (used in type checks if needed) |
| `sendError` | `../../shared/errorHandler` | Sends standardized JSON error responses |
| `db` | `../../config/db` | MySQL pool — used to verify user still exists and is active |

---

## 4. Core Logic Breakdown

### Private Helper: `_sendAuthError(res, status, message, code)`

```js
function _sendAuthError(res, status, message, code) {
  try {
    return sendError(res, status, message, code);
  } catch (_) {
    return res.status(status).json({ success: false, message, code });
  }
}
```

This helper wraps `sendError` with an inner try/catch. If the shared `sendError` helper is somehow misconfigured or throws, the fallback `res.status().json()` ensures the response body is **never empty**. This is a defensive pattern that guarantees JSON output under all failure conditions.

---

## 5. Functions / Methods

### `protect(req, res, next)`
| Property | Details |
|---|---|
| **Type** | `async` Express middleware |
| **Parameters** | `req`, `res`, `next` |
| **Returns** | Calls `next()` on success, or sends JSON error response |

**Step-by-step logic:**

**Step 1 — Token Extraction:**
```js
const authHeader = req.headers.authorization;
// Must start with "Bearer "
const token = authHeader.split(' ')[1];
```
- Returns `401 NO_TOKEN` if `Authorization` header is missing or doesn't start with `'Bearer '`.
- Guards against frontend bugs: if token string is literally `"null"` or `"undefined"`, returns `401 INVALID_TOKEN`.

**Step 2 — JWT Verification (isolated try/catch):**
```js
decoded = jwt.verify(token, process.env.JWT_SECRET);
```
- Inner `try/catch` catches only JWT-specific errors.
- `TokenExpiredError` → `401 TOKEN_EXPIRED`
- Any other JWT error → `401 INVALID_TOKEN`
- The isolation means JWT errors don't get swallowed by the outer catch.

**Step 3 — Database Verification:**
```js
SELECT id, role, email, is_active FROM users WHERE id = decoded.id
```
- Confirms the user still exists in DB (handles deleted accounts).
- Returns `401 USER_NOT_FOUND` if user is gone.

**Step 4 — Account Status Check:**
- Returns `403 ACCOUNT_INACTIVE` if `user.is_active = 0`.
- This check happens **after** DB verification, not from the JWT payload — role/status changes take effect immediately.

**Step 5 — Attach User to Request:**
```js
req.user = { id: user.id, role: user.role, email: user.email };
```
- User data is sourced **from DB**, not from the JWT payload — ensures freshness (e.g., role changes are reflected immediately).

**Outer catch block:** Handles DB connectivity errors or unexpected failures, always returns `500 AUTH_ERROR` with JSON body — never leaves the response empty.

---

### `restrictTo(...roles)`
| Property | Details |
|---|---|
| **Type** | Factory function returning Express middleware |
| **Parameters** | `...roles` — one or more role strings (e.g., `'student'`, `'instructor'`) |
| **Returns** | Middleware function |

**Usage:** Must be used **after** `protect` (requires `req.user` to be set).

```js
router.get('/admin', protect, restrictTo('admin', 'superadmin'), handler);
```

**Logic:**
1. If `req.user` is not set → `401 NOT_AUTHENTICATED` (defensive check).
2. If `req.user.role` is not in the allowed `roles` array → `403 FORBIDDEN`.
3. Error message includes the required roles: `"Access denied. Required role: student or instructor."` — this is more informative than a silent 403.
4. If role matches → calls `next()`.

---

### `optionalAuth(req, res, next)`
| Property | Details |
|---|---|
| **Type** | `async` Express middleware |
| **Parameters** | `req`, `res`, `next` |
| **Returns** | Always calls `next()` — never rejects |

**Purpose:** Used on public routes where logged-in users get enriched data (e.g., "have I purchased this material?") but anonymous access is also valid.

**Logic:**
1. If no `Authorization` header → silently calls `next()` (continues as guest).
2. If token is present but invalid/expired → silently calls `next()` (continues as guest, no error).
3. If token is valid → fetches user from DB (same as `protect`).
4. Only populates `req.user` if the user exists **and** `is_active = 1`.
5. Any DB error → logs it, silently calls `next()` (never blocks the request).

**Key difference from `protect`:** This middleware **never sends an error response** — every code path ends with `next()`.

---

## 6. API Role

This middleware is applied at the route level in:

| File | Usage |
|---|---|
| `auth.routes.js` | `protect` on `/logout` and `/me` |
| `student.routes.js` | `protect` + `restrictTo('student')` on all routes |
| `materials.routes.js` | `protect` on authenticated routes; `restrictTo` for student/instructor separation |

---

## 8. Data Flow

```
HTTP Request
      │
      ▼
Extract Bearer token from Authorization header
      │
      ├── Missing/invalid format ──→ 401 NO_TOKEN / INVALID_TOKEN
      │
      ▼
jwt.verify(token, JWT_SECRET)
      │
      ├── Expired ──→ 401 TOKEN_EXPIRED
      ├── Invalid ──→ 401 INVALID_TOKEN
      │
      ▼
DB lookup: SELECT FROM users WHERE id = decoded.id
      │
      ├── Not found ──→ 401 USER_NOT_FOUND
      ├── Inactive ──→ 403 ACCOUNT_INACTIVE
      │
      ▼
req.user = { id, role, email }
      │
      ▼
next() ──→ Route handler
```

---

## 9. Connections

### Files That Call This File
- `modules/auth/auth.routes.js`
- `modules/student/student.routes.js`
- `modules/materials/materials.routes.js`

### Files This File Depends On
- `jsonwebtoken` — JWT verification
- `../../config/db` — User existence/status check
- `../../shared/errorHandler` — `sendError`, `AppError`

---

## 10. Middleware / Auth

This file **is** the authentication middleware. Key security properties:

| Property | Behavior |
|---|---|
| Token source | `Authorization: Bearer <token>` header only |
| User data source | Database (not JWT payload) |
| Role data source | Database (not JWT payload) |
| Token string sanitization | Rejects literal `"null"` / `"undefined"` strings |
| Account status | Checked on every request |

---

## 11. Error Handling

| Scenario | Code | HTTP |
|---|---|---|
| No Authorization header | `NO_TOKEN` | 401 |
| Token is `"null"` or `"undefined"` string | `INVALID_TOKEN` | 401 |
| JWT expired | `TOKEN_EXPIRED` | 401 |
| JWT signature invalid | `INVALID_TOKEN` | 401 |
| User deleted from DB | `USER_NOT_FOUND` | 401 |
| Account deactivated | `ACCOUNT_INACTIVE` | 403 |
| `req.user` missing in `restrictTo` | `NOT_AUTHENTICATED` | 401 |
| Wrong role | `FORBIDDEN` | 403 |
| Unexpected DB error | `AUTH_ERROR` | 500 |

All errors are returned as JSON — never as empty responses, thanks to `_sendAuthError`.

---

## 12. Example Usage

### Protecting a Route
```js
const { protect, restrictTo, optionalAuth } = require('../auth/auth.middleware');

// Only authenticated students
router.get('/my-courses', protect, restrictTo('student'), handler);

// Authenticated instructors only
router.post('/upload', protect, restrictTo('instructor'), handler);

// Public but enriched for logged-in users
router.get('/materials/:id', optionalAuth, handler);
```

### What `req.user` looks like after `protect`
```js
req.user = {
  id: 42,
  role: 'student',
  email: 'student@example.com'
}
```

---

## 13. Edge Cases / Notes

- **"null" token string:** Browsers/frontends sometimes send the string `"null"` when the token variable is unset. The explicit check `token === 'null'` handles this common bug.
- **DB-sourced role:** Even if a JWT is valid and unexpired, if the user's role was changed in the DB (e.g., demoted from instructor to student), the new role is reflected immediately on the next request.
- **`optionalAuth` never blocks:** Even a DB failure in `optionalAuth` is swallowed — the request continues as anonymous. This is intentional for robustness on public routes.
- **Nested try/catch in `protect`:** The inner try/catch is specifically for JWT errors so they don't get misclassified as generic server errors by the outer catch.

---

## 14. Summary

`auth.middleware.js` is the security gatekeeper for EduVerse's API. `protect` validates Bearer JWTs and confirms user status from the database on every protected request. `restrictTo` enforces role-based access. `optionalAuth` enriches public requests for logged-in users without ever blocking them. All paths return well-formed JSON — no silent failures or empty response bodies.
