# env.js — Environment Variable Validator

> **EduVerse** | `config/env.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Required Variables](#3-required-variables)
4. [Optional Warned Variables](#4-optional-warned-variables)
5. [Security Checks](#5-security-checks)
6. [Default Value Injection](#6-default-value-injection)
7. [Validation Logic](#7-validation-logic)
8. [Usage](#8-usage)
9. [Error Output](#9-error-output)
10. [Environment Variables Reference](#10-environment-variables-reference)
11. [Possible Improvements](#11-possible-improvements)

---

## 1. Overview

`env.js` is a **startup validation module** that checks all required environment variables are present and correctly configured before the server accepts any connections. If validation fails, the process exits immediately with a clear, actionable error message.

**File location:** `config/env.js`

---

## 2. Purpose & Problem Solved

Without this module, a missing environment variable (e.g., `DB_PASSWORD`) would cause a cryptic runtime crash — potentially mid-request, after the server has already started and is serving traffic. Examples of bad failure modes:

- Missing `JWT_SECRET` → authentication silently broken
- Missing `DB_HOST` → database connection pool crash on first request
- Missing `MAIL_PASS` → emails fail silently, users don't receive verifications
- Weak `JWT_SECRET` → security vulnerability

`env.js` catches all of these **before the server starts**, at a single clear checkpoint.

---

## 3. Required Variables

The server will **immediately exit with code 1** if any of these are missing or empty:

| Variable | Purpose |
|---|---|
| `DB_HOST` | MySQL database hostname |
| `DB_USER` | MySQL database username |
| `DB_PASSWORD` | MySQL database password |
| `DB_NAME` | MySQL database name |
| `JWT_SECRET` | Secret key for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens |

**Exit message format:**
```
❌  EduVerse startup failed — missing required environment variables:

    • DB_HOST
    • JWT_SECRET

    Copy .env.example to .env and fill in all required values.
```

---

## 4. Optional Warned Variables

The server starts but logs a `⚠️` warning if any of these are missing:

| Variable | Impact if Missing |
|---|---|
| `MAIL_USER` | Emails cannot be sent (verification, reset password, notifications all fail) |
| `MAIL_PASS` | Same as above |
| `RAZORPAY_KEY_ID` | Payment processing disabled |
| `RAZORPAY_KEY_SECRET` | Payment processing disabled |
| `RAZORPAY_WEBHOOK_SECRET` | Payment webhook verification disabled |
| `FRONTEND_URL` | Email links and certificate verify URLs will point to `http://localhost:5500` |

---

## 5. Security Checks

After required variable presence is confirmed, additional security validations run:

### JWT Secret Length Check
```javascript
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  [env] JWT_SECRET is too short — use at least 32 characters for security.');
}

if (process.env.JWT_REFRESH_SECRET.length < 32) {
  console.warn('⚠️  [env] JWT_REFRESH_SECRET is too short — use at least 32 characters for security.');
}
```

Short JWT secrets are susceptible to brute-force attacks. 32 characters is the minimum recommended length; 64+ characters is ideal for production.

---

## 6. Default Value Injection

After validation, safe defaults are injected for optional variables that have not been set:

| Variable | Default Value | Notes |
|---|---|---|
| `PORT` | `5000` | HTTP server port |
| `NODE_ENV` | `development` | Affects SMS mock mode, error verbosity |
| `JWT_EXPIRES_IN` | `15m` | Short-lived access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Long-lived refresh token expiry |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost factor |
| `DB_PORT` | `3306` | MySQL default port |
| `MAIL_HOST` | `smtp.gmail.com` | Default SMTP server |
| `MAIL_PORT` | `587` | STARTTLS port |
| `FRONTEND_URL` | `http://localhost:5500` | Used in email links |
| `STORAGE_DRIVER` | `local` | File storage driver |

Defaults are only set if the variable is not already defined — existing values are never overwritten.

---

## 7. Validation Logic

```javascript
function validate() {
  // 1. Check all REQUIRED variables
  const missing = REQUIRED.filter(key =>
    !process.env[key] || process.env[key].trim() === ''
  );

  if (missing.length > 0) {
    // Print missing vars and exit
    process.exit(1);
  }

  // 2. Warn about OPTIONAL variables
  OPTIONAL_WARN.forEach(key => {
    if (!process.env[key] || process.env[key].trim() === '') {
      console.warn(`⚠️  [env] Optional variable not set: ${key}`);
    }
  });

  // 3. Security checks
  // (JWT secret length warnings)

  // 4. Inject defaults
  if (!process.env.PORT) process.env.PORT = '5000';
  // ...

  console.log('✅ Environment variables validated.');
}

validate(); // Called immediately on require()
```

The `validate()` function is called at module load time — simply `require('./config/env')` triggers the full validation.

---

## 8. Usage

**Must be the very first `require` in `server.js`:**

```javascript
// server.js
require('./config/env');     // ← FIRST LINE — validates all env vars

const express = require('express');
const db      = require('./config/db');
// ... rest of server setup
```

**Exported API:**
```javascript
const { validate } = require('./config/env');
// validate() can be called again if needed (idempotent)
```

---

## 9. Error Output

### Successful startup:
```
✅ Environment variables validated.
```

### Missing required variables:
```
❌  EduVerse startup failed — missing required environment variables:

    • DB_HOST
    • JWT_SECRET
    • JWT_REFRESH_SECRET

    Copy .env.example to .env and fill in all required values.
```
Process exits with code 1.

### Optional variable warnings:
```
⚠️  [env] Optional variable not set: MAIL_USER
⚠️  [env] Optional variable not set: RAZORPAY_KEY_ID
```

### Security warnings:
```
⚠️  [env] JWT_SECRET is too short — use at least 32 characters for security.
```

---

## 10. Environment Variables Reference

### `.env.example`

```env
# ─────────────────────────────────────────────
# DATABASE (REQUIRED)
# ─────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password_here
DB_NAME=eduverse

# ─────────────────────────────────────────────
# JWT SECRETS (REQUIRED — min 32 characters each)
# ─────────────────────────────────────────────
JWT_SECRET=use_a_very_long_random_string_here_at_least_32_chars
JWT_REFRESH_SECRET=another_very_long_random_string_here_at_least_32_chars

# ─────────────────────────────────────────────
# SERVER (OPTIONAL — defaults provided)
# ─────────────────────────────────────────────
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5500
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# ─────────────────────────────────────────────
# EMAIL (OPTIONAL — warns if missing)
# ─────────────────────────────────────────────
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your@gmail.com
MAIL_PASS=your_app_password
MAIL_FROM=EduVerse <noreply@eduverse.com>

# ─────────────────────────────────────────────
# PAYMENTS (OPTIONAL — warns if missing)
# ─────────────────────────────────────────────
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# ─────────────────────────────────────────────
# STORAGE (OPTIONAL — defaults to local)
# ─────────────────────────────────────────────
STORAGE_DRIVER=local
```

---

## 11. Possible Improvements

1. **Schema validation** — Use a library like `joi` or `zod` to validate not just presence but also format (e.g., ensure `PORT` is a number, `MAIL_PORT` is between 1–65535, `NODE_ENV` is one of `development|production|test`).

2. **`.env` file auto-loading** — Integrate `dotenv` loading directly in this file so developers don't need a separate `require('dotenv').config()` call in `server.js`.

3. **Production stricter checks** — When `NODE_ENV=production`, enforce additional requirements: `REDIS_HOST` must be set, `MAIL_USER` must be set, `FRONTEND_URL` must not be localhost.

4. **Secret rotation warning** — Check if JWT secrets match known weak/default values and warn loudly.

5. **Config object export** — Instead of relying on `process.env` throughout the codebase, export a typed config object:
   ```javascript
   module.exports.config = {
     port:    parseInt(process.env.PORT),
     db:      { host: process.env.DB_HOST, ... },
     jwt:     { secret: process.env.JWT_SECRET, ... },
   };
   ```
   This makes configuration testable and provides a single source of truth.
