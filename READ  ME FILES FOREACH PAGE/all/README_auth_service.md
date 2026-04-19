# `auth.service.js` — Authentication Business Logic

## 1. File Overview

| Property | Details |
|---|---|
| **File Name** | `auth.service.js` |
| **Location** | `modules/auth/auth.service.js` |
| **File Type** | Service Layer (Business Logic) |
| **Project** | EduVerse |

**Purpose:** This file implements all authentication-related business logic for EduVerse — registration, email verification, login, token management, and password operations. It is the brain of the auth system, sitting between the controller (HTTP layer) and the database.

---

## 2. Responsibility

The auth service handles:
- Creating new user accounts with hashed passwords
- Sending verification emails with unique tokens
- Verifying email ownership before allowing login
- Issuing short-lived JWT access tokens and long-lived refresh tokens
- Rotating/refreshing access tokens securely
- Logging users out by invalidating refresh tokens
- Password reset via secure time-limited email tokens

**Why this file exists:** To keep all auth business logic separate from HTTP handling (controller) and database connection (db.js), following the Service-Controller pattern.

---

## 3. Imports / Dependencies

| Import | Package | Purpose |
|---|---|---|
| `bcryptjs` | `bcryptjs` | Hashing passwords and comparing plaintext against stored hashes |
| `jsonwebtoken` | `jsonwebtoken` | Signing and verifying JWT access and refresh tokens |
| `uuid` (v4) | `uuid` | Generating unique, unpredictable tokens for email verification and password reset |
| `db` | `../../config/db` | MySQL connection pool for all database operations |
| `sendMail`, `templates` | `../../config/mailer` | Sending transactional emails (verification, password reset) |
| `AppError` | `../../shared/errorHandler` | Structured application error class for consistent error propagation |

---

## 4. Core Logic Breakdown

The file is structured as a set of independent async functions, each handling one auth operation. Each function:
1. Validates preconditions (existence, token validity, etc.)
2. Performs database operations
3. Returns a result object or throws an `AppError`

### Helper Functions
Two private token generators are defined at the top:

```js
generateAccessToken(user)   // Short-lived JWT (default 15m)
generateRefreshToken(user)  // Long-lived JWT (default 7d)
```

Both are only called internally within the module.

---

## 5. Functions / Methods

### `generateAccessToken(user)`
| Property | Details |
|---|---|
| **Type** | Helper (not exported) |
| **Parameters** | `user` — object with `id`, `email`, `role` |
| **Returns** | Signed JWT string |

Signs a JWT containing `{ id, email, role }` using `JWT_SECRET`. Expiry from `JWT_EXPIRES_IN` env variable, defaulting to `'15m'`.

---

### `generateRefreshToken(user)`
| Property | Details |
|---|---|
| **Type** | Helper (not exported) |
| **Parameters** | `user` — object with `id` |
| **Returns** | Signed JWT string |

Signs a JWT containing only `{ id }` using `JWT_REFRESH_SECRET`. Expiry from `JWT_REFRESH_EXPIRES_IN`, defaulting to `'7d'`. Contains minimal payload by design — refresh tokens do not carry role info.

---

### `register(data)`
| Property | Details |
|---|---|
| **Parameters** | `data` — full registration form body (name, email, password, role, phone, etc.) |
| **Returns** | `{ message, email, role }` |

**Logic:**
1. Checks if email already exists → throws `EMAIL_EXISTS` (409) if so.
2. Hashes password with bcrypt (`BCRYPT_ROUNDS` env, default 12).
3. Inserts into `users` table (email, phone, password_hash, role).
4. Inserts into `user_profiles` table (name, dob, city, state).
5. Generates a UUID verification token, stores it in `email_verifications` with 24-hour expiry.
6. Sends a verification email via the mailer with the token embedded in a frontend URL.

**Edge case:** Many extra registration fields (e.g., `institute_code`, `subject`, `linkedin`) are destructured but not currently inserted — they are present in the signature for future use or role-specific handling not shown here.

---

### `verifyEmail(token)`
| Property | Details |
|---|---|
| **Parameters** | `token` — UUID string from email link |
| **Returns** | `{ message, email }` |

**Logic:**
1. Looks up the token in `email_verifications` joined with `users` and `user_profiles`.
2. Throws `INVALID_TOKEN` (400) if not found.
3. Checks `expires_at` — throws `TOKEN_EXPIRED` (400) if past expiry.
4. Sets `users.is_verified = 1`.
5. Deletes the used token from `email_verifications`.

---

### `resendVerification(email)`
| Property | Details |
|---|---|
| **Parameters** | `email` — string |
| **Returns** | `{ message }` |

**Logic:**
1. Looks up user by email — throws `USER_NOT_FOUND` (404) if not found.
2. Throws `ALREADY_VERIFIED` (400) if already verified.
3. Deletes old verification tokens for the user.
4. Creates a new token with a fresh 24-hour expiry.
5. Sends a new verification email.

---

### `login(email, password)`
| Property | Details |
|---|---|
| **Parameters** | `email` — string, `password` — plaintext string |
| **Returns** | `{ token, refresh_token, expires_at, user }` |

**Logic:**
1. Fetches user + profile by email.
2. Throws `INVALID_CREDENTIALS` (401) if not found (generic message avoids email enumeration).
3. Compares password with bcrypt — throws `INVALID_CREDENTIALS` if mismatch.
4. Checks `is_active` — throws `ACCOUNT_SUSPENDED` (403) if inactive.
5. Checks `is_verified` — throws `EMAIL_NOT_VERIFIED` (403) if unverified.
6. Generates both access and refresh tokens.
7. Saves refresh token to `refresh_tokens` table with 7-day expiry.
8. Returns both tokens and user info.

---

### `refreshToken(token)`
| Property | Details |
|---|---|
| **Parameters** | `token` — refresh JWT string |
| **Returns** | `{ token, expires_at }` |

**Logic:**
1. Verifies the refresh JWT signature using `JWT_REFRESH_SECRET`.
2. Checks the token exists in the `refresh_tokens` DB table (prevents reuse of deleted tokens).
3. Checks DB-stored expiry (double-check beyond JWT expiry).
4. Fetches fresh user data from DB.
5. Issues a new access token.

**Note:** Does NOT rotate the refresh token itself — the same refresh token is reused until it expires or the user logs out.

---

### `logout(userId, token)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer or null, `token` — refresh token string or null |
| **Returns** | `{ message }` |

**Logic:**
- If `token` is provided → deletes only that specific refresh token (single device logout).
- If only `userId` is provided → deletes ALL refresh tokens for that user (all devices logout).

---

### `getMe(userId)`
| Property | Details |
|---|---|
| **Parameters** | `userId` — integer |
| **Returns** | Full user profile object |

Fetches joined data from `users` + `user_profiles`. Returns a flattened object with all profile fields. Throws `USER_NOT_FOUND` (404) if the user no longer exists.

---

### `forgotPassword(email)`
| Property | Details |
|---|---|
| **Parameters** | `email` — string |
| **Returns** | `{ message }` (same message regardless of whether email exists) |

**Logic:**
1. Looks up user — returns the same generic message if not found (prevents email enumeration).
2. Deletes any existing reset tokens for the user.
3. Generates a UUID reset token with 1-hour expiry.
4. Stores token in `password_resets`.
5. Sends password reset email with token in frontend URL.

---

### `resetPassword(token, password)`
| Property | Details |
|---|---|
| **Parameters** | `token` — UUID string, `password` — new plaintext password |
| **Returns** | `{ message }` |

**Logic:**
1. Looks up token in `password_resets` where `used = 0`.
2. Throws `INVALID_TOKEN` (400) if not found.
3. Checks `expires_at` — throws `TOKEN_EXPIRED` (400) if expired.
4. Hashes the new password.
5. Updates `users.password_hash`.
6. Marks the token as `used = 1` in `password_resets`.
7. Deletes all refresh tokens for the user (forces re-login on all devices after password change).

---

## 6. API Role

This file is consumed by `auth.controller.js`, which maps these functions to the following routes:

| Controller Function | Service Function | HTTP Route |
|---|---|---|
| `register` | `register()` | `POST /api/auth/register` |
| `verifyEmail` | `verifyEmail()` | `POST /api/auth/verify-email` |
| `resendVerification` | `resendVerification()` | `POST /api/auth/resend-verification` |
| `login` | `login()` | `POST /api/auth/login` |
| `refreshToken` | `refreshToken()` | `POST /api/auth/refresh` |
| `logout` | `logout()` | `POST /api/auth/logout` |
| `getMe` | `getMe()` | `GET /api/auth/me` |
| `forgotPassword` | `forgotPassword()` | `POST /api/auth/forgot-password` |
| `resetPassword` | `resetPassword()` | `POST /api/auth/reset-password` |

---

## 8. Data Flow

```
HTTP Request Body
      │
      ▼
auth.controller.js  →  auth.service.js
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                  db.js    mailer   bcrypt/JWT
                    │
                    ▼
              MySQL Tables:
              users, user_profiles,
              email_verifications,
              refresh_tokens,
              password_resets
                    │
                    ▼
             Result Object  →  controller  →  HTTP Response
```

---

## 9. Connections

### Files That Call This File
- `modules/auth/auth.controller.js`

### Files This File Depends On
- `../../config/db` — Database pool
- `../../config/mailer` — Email sending
- `../../shared/errorHandler` — `AppError` class

---

## 11. Error Handling

All errors are thrown as `AppError` instances with a message, HTTP status code, and error code:

| Scenario | Code | HTTP Status |
|---|---|---|
| Email already exists | `EMAIL_EXISTS` | 409 |
| Invalid/expired verification token | `INVALID_TOKEN` / `TOKEN_EXPIRED` | 400 |
| Already verified | `ALREADY_VERIFIED` | 400 |
| Wrong credentials | `INVALID_CREDENTIALS` | 401 |
| Account suspended | `ACCOUNT_SUSPENDED` | 403 |
| Email not verified | `EMAIL_NOT_VERIFIED` | 403 |
| Invalid/expired refresh token | `INVALID_REFRESH_TOKEN` / `REFRESH_TOKEN_EXPIRED` | 401 |
| User not found | `USER_NOT_FOUND` | 404 |
| Invalid/expired reset token | `INVALID_TOKEN` / `TOKEN_EXPIRED` | 400 |

Errors bubble up to `auth.controller.js` which passes them to Express's `next(err)` global error handler.

---

## 12. Example Usage

```js
// Login flow
const result = await authService.login('student@example.com', 'mypassword');
// result = {
//   token: 'eyJ...',
//   refresh_token: 'eyJ...',
//   expires_at: Date,
//   user: { id, name, email, role, avatar }
// }

// Refresh access token
const refreshed = await authService.refreshToken(result.refresh_token);
// refreshed = { token: 'eyJ...', expires_at: Date }
```

---

## 13. Edge Cases / Notes

- **Email enumeration protection:** `forgotPassword` always returns the same message, regardless of whether the email exists.
- **Security after password change:** All existing refresh tokens are deleted on `resetPassword`, forcing all sessions to re-authenticate.
- **Bcrypt rounds** are read from `BCRYPT_ROUNDS` env at runtime — allows tuning without code changes.
- **Refresh token is DB-backed:** Even if the JWT is valid, the token must exist in the `refresh_tokens` table. This allows server-side revocation.
- **`register()` does not verify role-specific data** (e.g., instructor qualifications) — this is left for profile completion flows.

---

## 14. Summary

`auth.service.js` is the complete authentication engine for EduVerse. It handles the full auth lifecycle: registration with email verification, secure login with dual-token (access + refresh) issuance, token refresh, multi-device logout, and password reset via email. All sensitive data (passwords, tokens) is properly hashed or stored securely. Errors are always thrown as structured `AppError` instances for consistent API responses.
