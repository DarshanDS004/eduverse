# `auth.controller.js` — Authentication HTTP Request Handler

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `auth.controller.js` |
| **Location** | `modules/auth/auth.controller.js` |
| **File Type** | Controller (HTTP Request Handler) |
| **Project** | EduVerse |

**Purpose:** This file acts as the HTTP interface for all authentication operations. It receives incoming HTTP requests, performs lightweight input validation, delegates business logic to `auth.service.js`, and sends formatted HTTP responses back to the client.

---

## 2. Responsibility

The controller's job is narrow and deliberate:
- **Parse** request body parameters.
- **Validate** that required fields are present (early rejection before hitting the service).
- **Delegate** all real work to the service layer.
- **Format** and **send** the HTTP response using `sendSuccess` or `sendError`.
- **Forward** unexpected errors to Express's global error handler via `next(err)`.

**Why this file exists:** Following the MVC/Service pattern, the controller keeps HTTP concerns (status codes, request parsing, response formatting) out of the business logic layer.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `authService` | `./auth.service` | All authentication business logic |
| `sendSuccess` | `../../shared/errorHandler` | Sends a standardized success JSON response |
| `sendError` | `../../shared/errorHandler` | Sends a standardized error JSON response without throwing |

---

## 4. Core Logic Breakdown

Every exported function in this file follows the same 3-step pattern:

```
1. Extract fields from req.body / req.user
2. (Optional) validate presence of required fields → sendError if missing
3. Call authService.functionName(params)
4. Return sendSuccess(res, statusCode, message, data)
5. On error: next(err) — passes to global error middleware
```

All functions are wrapped in `try/catch`. Caught errors are passed to `next(err)`, which triggers Express's central error handler (not defined in this file).

---

## 5. Functions / Methods

### `register(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/register` |
| **Parameters** | `req.body` — full registration data |
| **Response** | 201 with `{ message, email, role }` |

Passes the entire `req.body` to `authService.register()`. No field-level validation is done here — it is handled inside the service. Returns `201 Created` on success.

---

### `verifyEmail(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/verify-email` |
| **Parameters** | `req.body.token` — UUID verification token |
| **Response** | 200 with `{ message, email }` |

Validates that `token` is present — returns `400 MISSING_TOKEN` if not. Delegates to `authService.verifyEmail(token)`.

---

### `resendVerification(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/resend-verification` |
| **Parameters** | `req.body.email` — email string |
| **Response** | 200 with `{ message }` |

Validates `email` is present — returns `400 MISSING_EMAIL` if not. Delegates to `authService.resendVerification(email)`.

---

### `login(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/login` |
| **Parameters** | `req.body.email`, `req.body.password` |
| **Response** | 200 with `{ token, refresh_token, expires_at, user }` |

Validates both `email` and `password` are present — returns `400 MISSING_FIELDS` if either is missing. Delegates to `authService.login(email, password)`.

---

### `refreshToken(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/refresh` |
| **Parameters** | `req.body.refresh_token` |
| **Response** | 200 with `{ token, expires_at }` |

Validates `refresh_token` presence — returns `400 MISSING_TOKEN` if absent. Delegates to `authService.refreshToken(refresh_token)`.

---

### `logout(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/logout` |
| **Auth Required** | Yes (`protect` middleware) |
| **Parameters** | `req.body.refresh_token` (optional), `req.user.id` (from JWT) |
| **Response** | 200 with `{ message }` |

No required-field validation — both `refresh_token` and `userId` are optional parameters passed to the service. The service handles logic for partial data (single vs all-device logout).

---

### `getMe(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | GET |
| **Route** | `/api/auth/me` |
| **Auth Required** | Yes (`protect` middleware) |
| **Parameters** | `req.user.id` — injected by auth middleware |
| **Response** | 200 with full user profile object |

No body validation needed — user ID comes from the verified JWT via `protect` middleware. Delegates to `authService.getMe(req.user.id)`.

---

### `forgotPassword(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/forgot-password` |
| **Parameters** | `req.body.email` |
| **Response** | 200 with generic `{ message }` |

Validates `email` is present — returns `400 MISSING_EMAIL` if not. Delegates to `authService.forgotPassword(email)`.

---

### `resetPassword(req, res, next)`
| Property | Details |
|---|---|
| **HTTP Method** | POST |
| **Route** | `/api/auth/reset-password` |
| **Parameters** | `req.body.token`, `req.body.password` |
| **Response** | 200 with `{ message }` |

Validates both `token` and `password` — returns `400 MISSING_FIELDS` if either is absent. Delegates to `authService.resetPassword(token, password)`.

---

## 6. API Role

| Controller Function | HTTP Method | Route | Auth Required |
|---|---|---|---|
| `register` | POST | `/api/auth/register` | No |
| `verifyEmail` | POST | `/api/auth/verify-email` | No |
| `resendVerification` | POST | `/api/auth/resend-verification` | No |
| `login` | POST | `/api/auth/login` | No |
| `refreshToken` | POST | `/api/auth/refresh` | No |
| `logout` | POST | `/api/auth/logout` | Yes |
| `getMe` | GET | `/api/auth/me` | Yes |
| `forgotPassword` | POST | `/api/auth/forgot-password` | No |
| `resetPassword` | POST | `/api/auth/reset-password` | No |

---

## 8. Data Flow

```
HTTP Request
     │
     ▼
auth.routes.js  →  [protect middleware?]  →  auth.controller.js
                                                      │
                                          Field validation
                                                      │
                                              authService.*()
                                                      │
                                          sendSuccess / sendError
                                                      │
                                              HTTP Response
```

---

## 9. Connections

### Files That Call This File
- `modules/auth/auth.routes.js` — registers each controller function to Express routes.

### Files This File Depends On
- `./auth.service` — all business logic
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

---

## 10. Middleware / Auth

- **`protect`** middleware is applied at the route level (in `auth.routes.js`) for `logout` and `getMe`. By the time these controller functions execute, `req.user` is already populated with `{ id, role, email }`.
- No additional middleware is applied within this controller itself.

---

## 11. Error Handling

| Scenario | Handling |
|---|---|
| Missing required fields | Inline `sendError(res, 400, message, code)` — immediately returns without calling service |
| Service throws `AppError` | Caught by `catch(err)` → passed to `next(err)` → handled by global error middleware |
| Unexpected runtime error | Same — caught and forwarded to `next(err)` |

The controller never constructs or throws `AppError` itself — it only uses `sendError` for simple field validation before reaching the service.

---

## 12. Example Usage

### Login Request
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "securePassword123"
}
```

### Success Response
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "expires_at": "2026-04-18T10:15:00.000Z",
    "user": {
      "id": 42,
      "name": "Jane Doe",
      "email": "student@example.com",
      "role": "student",
      "avatar": null
    }
  }
}
```

### Missing Fields Error Response
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Email and password are required.",
  "code": "MISSING_FIELDS"
}
```

---

## 13. Edge Cases / Notes

- **`logout` accepts no required fields:** Both `refresh_token` and `userId` are optional — the service gracefully handles partial data.
- **`register` does no field validation in the controller:** All validation (required fields, email format, role validity) is handled in the service layer.
- **`getMe` has no body:** It derives the user ID entirely from `req.user.id`, set by JWT middleware.
- **Generic `try/catch` on every function** means any unhandled exception (including DB errors) reaches the global error handler cleanly.

---

## 14. Summary

`auth.controller.js` is the thin HTTP handler layer for EduVerse authentication. It validates required inputs, delegates all logic to `auth.service.js`, and formats uniform success/error responses. It contains no business logic of its own — its only concern is managing the HTTP boundary between the client and the service layer.
