# `auth.routes.js` — Authentication Route Definitions

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `auth.routes.js` |
| **Location** | `modules/auth/auth.routes.js` |
| **File Type** | Route Definition |
| **Project** | EduVerse |

**Purpose:** This file defines and registers all HTTP routes for the EduVerse authentication system. It connects URL paths and HTTP methods to their corresponding controller functions, applying middleware where needed.

---

## 2. Responsibility

This file is the routing map for authentication. It:
- Declares which URL paths exist for auth operations.
- Associates each path + HTTP method combination with a controller function.
- Applies the `protect` middleware selectively to routes that require authentication.
- Exports the configured router to be mounted in the main Express app.

**Why this file exists:** Separation of concerns — routing configuration is isolated from controller logic and business logic.

---

## 3. Imports / Dependencies

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework — used to create a `Router` instance |
| `router` | `express.Router()` | The Express router that collects all auth routes |
| `authController` | `./auth.controller` | Controller functions handling each auth operation |
| `protect` | `./auth.middleware` | JWT authentication middleware for protected routes |

---

## 4. Core Logic Breakdown

The file follows a simple pattern:
1. Create an Express router.
2. Register public routes (no auth required).
3. Register protected routes (require `protect` middleware).
4. Export the router.

The router is not mounted here — it is imported and mounted at a base path (e.g., `/api/auth`) in the main application entry point.

---

## 5. Route Definitions

### Public Routes (No Authentication Required)

| Method | Path | Controller | Description |
|---|---|---|---|
| POST | `/register` | `authController.register` | Create a new user account |
| POST | `/verify-email` | `authController.verifyEmail` | Verify email with token from email link |
| POST | `/resend-verification` | `authController.resendVerification` | Resend the verification email |
| POST | `/login` | `authController.login` | Authenticate and receive tokens |
| POST | `/refresh` | `authController.refreshToken` | Exchange refresh token for new access token |
| POST | `/forgot-password` | `authController.forgotPassword` | Request a password reset email |
| POST | `/reset-password` | `authController.resetPassword` | Reset password using email token |

### Protected Routes (JWT Required)

| Method | Path | Middleware | Controller | Description |
|---|---|---|---|---|
| POST | `/logout` | `protect` | `authController.logout` | Invalidate refresh token(s) |
| GET | `/me` | `protect` | `authController.getMe` | Get current authenticated user's profile |

---

## 6. API Role

When mounted at `/api/auth` (assumed from project conventions), the full endpoint list is:

```
POST   /api/auth/register
POST   /api/auth/verify-email
POST   /api/auth/resend-verification
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/logout          ← requires Bearer token
GET    /api/auth/me              ← requires Bearer token
```

**Important note (from code comment):** The refresh token endpoint is `/refresh` (not `/refresh-token`). This was a bug fix to align with the frontend `api.js` client.

---

## 8. Data Flow

```
HTTP Request
      │
      ▼
Express App (main entry point)
      │  app.use('/api/auth', authRouter)
      ▼
auth.routes.js (router)
      │
      ├── Public route? ──→ auth.controller.*()
      │
      └── Protected route?
              │
              ▼
          protect middleware
              │
              ├── Auth fails ──→ 401/403 JSON error
              │
              └── Auth passes ──→ auth.controller.*()
```

---

## 9. Connections

### Files That Call This File
- Main application entry point (e.g., `app.js` or `server.js`) — mounts this router at `/api/auth`.

### Files This File Depends On
- `./auth.controller` — All route handler functions
- `./auth.middleware` — The `protect` middleware

---

## 10. Middleware / Auth

| Route | Middleware Applied |
|---|---|
| All public routes | None |
| `POST /logout` | `protect` — verifies JWT, populates `req.user` |
| `GET /me` | `protect` — verifies JWT, populates `req.user` |

`protect` is applied **per-route**, not globally to the router, meaning unauthenticated users can still access login, registration, etc.

---

## 11. Error Handling

This file contains no error handling logic. Errors are handled by:
- `protect` middleware — returns JSON errors for auth failures.
- `auth.controller.js` — catches service errors and calls `next(err)`.
- Global Express error middleware — formats and sends final error response.

---

## 12. Example Usage

### How this router is mounted (assumed app.js pattern):
```js
const authRoutes = require('./modules/auth/auth.routes');
app.use('/api/auth', authRoutes);
```

### Example client calls:
```http
# Register
POST /api/auth/register
{ "name": "Jane", "email": "jane@example.com", "password": "pass123", "role": "student" }

# Login
POST /api/auth/login
{ "email": "jane@example.com", "password": "pass123" }

# Get current user (requires token)
GET /api/auth/me
Authorization: Bearer eyJhbGci...

# Refresh access token
POST /api/auth/refresh
{ "refresh_token": "eyJhbGci..." }

# Logout (requires token)
POST /api/auth/logout
Authorization: Bearer eyJhbGci...
{ "refresh_token": "eyJhbGci..." }
```

---

## 13. Edge Cases / Notes

- **`/refresh` path:** The comment in the file explicitly notes this was changed from `/refresh-token` to `/refresh` to match the frontend. This is a reminder that route paths must be kept in sync with the API client.
- **No global `router.use(protect)`:** Auth middleware is only applied to routes that need it, which is correct — login and register must be public.
- **No `restrictTo` calls:** Auth routes don't restrict by role — any authenticated user can call `/logout` and `/me` regardless of role.

---

## 14. Summary

`auth.routes.js` is the routing configuration file for EduVerse's auth system. It maps 9 HTTP endpoints to their controller functions, applies JWT protection only to the 2 routes that require an authenticated session (`/logout` and `/me`), and exports the configured Express router for mounting in the main application. It contains no logic — only route declarations and middleware wiring.
