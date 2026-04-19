# app.js — Express Application

## Overview

`app.js` is the **core Express application** for EduVerse. It configures all middleware in the correct order, mounts all 18+ API route modules, serves static uploaded files, and registers global error handling. It does **not** start the HTTP server — that is done by `server.js`.

**File path:** `backend/app.js`

---

## Middleware Stack (in execution order)

The order of middleware registration is critical and must not be changed. Each layer is described below.

### 1. Helmet — Security Headers
```js
app.use(helmet());
```
Sets secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.) to protect against common web vulnerabilities.

---

### 2. CORS — Cross-Origin Resource Sharing
```js
app.use(cors({ origin: ..., credentials: true, ... }));
```

| Setting | Value |
|---|---|
| Default allowed origins | `localhost:5500`, `localhost:3000`, `127.0.0.1:5500`, `127.0.0.1:3000` |
| Extra origins | Configurable via `CORS_ORIGINS` env var (comma-separated) |
| Credentials | `true` (supports cookies and Authorization headers) |
| Methods | GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD |
| Allowed headers | `Content-Type`, `Authorization` |

Server-to-server requests and Postman (no `Origin` header) are always allowed.

---

### 3. Rate Limiting
Two separate rate limiters are applied:

| Route Prefix | Limit | Window |
|---|---|---|
| `/api` | 300 requests | 15 minutes |
| `/api/v1/auth` | 30 requests | 15 minutes |

The stricter auth limit prevents brute-force login attacks. All rate limit responses return JSON:
```json
{ "success": false, "message": "Too many requests. Please try again later." }
```

---

### 4. Body Parsers *(must come before all routes)*
```js
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```
- Parses `application/json` bodies up to 10 MB
- Parses `application/x-www-form-urlencoded` bodies up to 10 MB
- **Multipart/form-data** (file uploads) is handled per-route by Multer — not here

---

### 5. Request Logging (Development only)
```js
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
```
Morgan logs HTTP requests in the `dev` format (colored method, URL, status, response time) only in non-production environments.

---

### 6. Static File Serving — Uploads
```js
app.use('/uploads', express.static(..., {
  acceptRanges: true,
  setHeaders: ...
}));
```

| URL Prefix | Disk Path | Cache Policy |
|---|---|---|
| `/uploads/thumbnails/*` | `../uploads/thumbnails/` | `Cache-Control: public, max-age=86400` (24 hours) |
| `/uploads/videos/*` | `../uploads/videos/` | `Cache-Control: no-cache` |

`acceptRanges: true` and `Accept-Ranges: bytes` header enable browser `<video>` seeking (byte-range requests).

---

### 7. Health Check Endpoint
```
GET /health
```
Returns a JSON status response — no authentication required. Used by Docker health checks, load balancers, and monitoring tools.

**Response:**
```json
{
  "success": true,
  "message": "EduVerse API is running.",
  "version": "3.0.0",
  "time": "2025-01-01T00:00:00.000Z"
}
```

---

### 8. API Routes — All 18 Modules

All routes are mounted under `/api/v1/`:

| Prefix | Module file | Description |
|---|---|---|
| `/api/v1/auth` | `modules/auth/auth.routes` | Registration, login, token refresh, password reset |
| `/api/v1/student` | `modules/student/student.routes` | Student dashboard, courses, progress |
| `/api/v1/instructor` | `modules/instructor/instructor.routes` | Course builder, videos, quizzes, live sessions |
| `/api/v1/institute` | `modules/institute/institute.routes` | Class/fee/attendance management |
| `/api/v1/admin` | `modules/superadmin/superadmin.routes` | Platform-wide admin operations |
| `/api/v1/parent` | `modules/parent/parent.routes` | Child monitoring portal |
| `/api/v1/courses` | `modules/courses/courses.routes` | Public course catalog, enrollment |
| `/api/v1/payments` | `modules/payments/payments.routes` | Razorpay/Stripe payment processing |
| `/api/v1/materials` | `modules/materials/materials.routes` | Study materials marketplace |
| `/api/v1/quizzes` | `modules/quizzes/quizzes.routes` | Quiz attempts and results |
| `/api/v1/messages` | `modules/messages/messages.routes` | Direct messaging / chat rooms |
| `/api/v1/notifications` | `modules/notifications/notifications.routes` | In-app notifications |
| `/api/v1/certificates` | `modules/certificates/certificates.routes` | Certificate generation and verification |
| `/api/v1/attendance` | `modules/attendance/attendance.routes` | Attendance tracking |
| `/api/v1/assignments` | `modules/assignments/assignments.routes` | Assignment submission and grading |
| `/api/v1/discussions` | `modules/discussions/discussions.routes` | Course discussion forums |
| `/api/v1/live-sessions` | `modules/live-sessions/live-sessions.routes` | Live session management |
| `/api/v1/videos` | `modules/videos/videos.routes` | Video progress, notes, bookmarks |
| `/api/v1/reports` | `modules/reports/reports.routes` | Analytics reports (all roles) |

---

### 9. 404 Handler *(after all routes)*
```js
app.use(notFoundHandler);
```
Catches any request that did not match any registered route. Returns a JSON 404 response — never HTML. Must be declared after all route registrations.

---

### 10. Global Error Handler *(must be last)*
```js
app.use(globalErrorHandler);
```
Catches all errors thrown or passed via `next(err)` in route handlers. Always returns a JSON response — never an empty body. Must be the very last `app.use()` call.

---

## Infrastructure Notes

### Server.js Timeouts (for large video uploads)
```js
server.timeout          = 6 * 60 * 60 * 1000;  // 6 hours
server.keepAliveTimeout = 65_000;               // 65 s
server.headersTimeout   = 66_000;               // 66 s
```

### Nginx Reverse Proxy (recommended settings)
```nginx
client_max_body_size       50G;
proxy_request_buffering    off;
proxy_read_timeout         3600s;
proxy_send_timeout         3600s;
```

### Multer (in instructor.routes.js)
```js
const videoUpload = multer({
  storage: makeStorage('videos'),   // diskStorage — never RAM-buffered
  limits:  { fileSize: 50 * 1024 ** 3 },  // 50 GB hard limit
});
```

### Frontend Upload (course-builder.html)
- Uses `XMLHttpRequest` (not `fetch`) so `xhr.upload.onprogress` fires correctly
- `xhr.timeout = 0` — no client-side timeout for large files
- Displays real-time progress %, upload speed, and ETA

---

## Module Exports

```js
module.exports = app;
```
`app` is imported by `server.js` which wraps it in `http.createServer(app)`.

---

## Dependencies

| Package | Purpose |
|---|---|
| `express` | Web framework |
| `cors` | CORS middleware |
| `helmet` | Security headers |
| `express-rate-limit` | Rate limiting |
| `morgan` | HTTP request logging |
| `path` | Path resolution for static files |
| `./config/env` | Environment variable validation |
| `./shared/errorHandler` | `notFoundHandler`, `globalErrorHandler` |

---

## Related Files

- `server.js` — starts the HTTP server using this app
- `shared/errorHandler.js` — `notFoundHandler`, `globalErrorHandler`, `AppError`, `sendSuccess`, `sendError`
- `config/env.js` — validates required env vars on startup
- `modules/*/` — individual route modules
