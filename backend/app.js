/**
 * EduVerse — Express App (Merged & Complete)
 * app.js
 *
 * Merges both versions of app.js:
 *  - All 18 modules registered (Doc 1)
 *  - Correct middleware ordering with explanatory comments (Doc 2)
 *  - Helmet + strict CORS whitelist + rate limiting (Doc 1)
 *  - notFoundHandler + globalErrorHandler from shared/errorHandler (Doc 2 pattern)
 *  - Large video upload support — Accept-Ranges, smart caching (Doc 1)
 *  - Morgan gated on NODE_ENV !== 'production' (Doc 1 pattern, cleaner)
 *
 * Middleware order (CRITICAL — do not reorder):
 *   1. Security (Helmet, CORS)
 *   2. Rate limiting
 *   3. Body parsers   ← MUST come before all routes
 *   4. Request logging
 *   5. Static files
 *   6. Health check
 *   7. API routes
 *   8. 404 handler    ← MUST come after all routes
 *   9. Global error handler ← MUST be last
 */

'use strict';

require('./config/env');   // validate env vars on startup
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan    = require('morgan');
const path      = require('path');

const { notFoundHandler, globalErrorHandler } = require('./shared/errorHandler');

const app = express();

/* ══════════════════════════════════════════════════════════════
   1. SECURITY — Helmet sets safe HTTP headers
══════════════════════════════════════════════════════════════ */
app.use(helmet());

/* ══════════════════════════════════════════════════════════════
   2. CORS
   - Default origins cover local dev (ports 3000, 5500)
   - Extra origins can be added via CORS_ORIGINS env var (comma-separated)
   - Credentials enabled for cookie/token auth
══════════════════════════════════════════════════════════════ */
app.use(cors({
  origin: function (origin, callback) {
    const defaults = [
      'http://localhost:5500', 'http://127.0.0.1:5500',
      'http://localhost:3000', 'http://127.0.0.1:3000',
      'http://127.0.0.1:59304',
    ];
    const extra = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const allowed = [...new Set([...defaults, ...extra])];

    // Allow server-to-server / Postman requests (no origin header)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control', 'Pragma'],
}));

/* ══════════════════════════════════════════════════════════════
   3. RATE LIMITING
   - General API: 300 req / 15 min
   - Auth endpoints: 30 req / 15 min (brute-force protection)
══════════════════════════════════════════════════════════════ */
app.use('/api', rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

app.use('/api/v1/auth', rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many auth attempts. Please try again later.' },
}));

/* ══════════════════════════════════════════════════════════════
   4. BODY PARSERS — MUST be registered before all route handlers.
   These parse JSON and URL-encoded bodies.
   Multer handles multipart/form-data (file uploads) per route — not here.
══════════════════════════════════════════════════════════════ */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ══════════════════════════════════════════════════════════════
   5. REQUEST LOGGING — development only
══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

/* ══════════════════════════════════════════════════════════════
   6. STATIC FILES — large video support
   - acceptRanges: true  → enables <video> seeking in browser
   - Thumbnails cached for 24 h (immutable after upload)
   - Videos: no-cache (may be replaced/updated)
   - Uploads folder: E:\Ds_projects\eduverse\uploads  (Windows)
══════════════════════════════════════════════════════════════ */
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  acceptRanges: true,
  setHeaders: function (res, filePath) {
    res.setHeader('Accept-Ranges', 'bytes');

    if (filePath.includes('/thumbnails/') || filePath.includes('\\thumbnails\\')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else if (filePath.includes('/videos/') || filePath.includes('\\videos\\')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

/* ══════════════════════════════════════════════════════════════
   7. HEALTH CHECK
══════════════════════════════════════════════════════════════ */
app.get('/health', function (req, res) {
  res.json({
    success: true,
    message: 'EduVerse API is running.',
    version: '3.0.0',
    time:    new Date().toISOString(),
  });
});

/* ══════════════════════════════════════════════════════════════
   8. API ROUTES — v1
   All 18 modules. Comment out any that are not yet built.
══════════════════════════════════════════════════════════════ */

/* Auth */
app.use('/api/v1/auth',          require('./modules/auth/auth.routes'));

/* Student */
app.use('/api/v1/student',       require('./modules/student/student.routes'));

/* Instructor */
app.use('/api/v1/instructor',    require('./modules/instructor/instructor.routes'));

/* Institute */
app.use('/api/v1/institute',     require('./modules/institute/institute.routes'));

/* Super Admin */
app.use('/api/v1/admin',         require('./modules/superadmin/superadmin.routes'));

/* Parent */
app.use('/api/v1/parent',        require('./modules/parent/parent.routes'));

/* Courses (public catalog + enrollment) */
app.use('/api/v1/courses',       require('./modules/courses/courses.routes'));

/* Payments */
app.use('/api/v1/payments',      require('./modules/payments/payments.routes'));

/* Study Materials */
app.use('/api/v1/materials',     require('./modules/materials/materials.routes'));

/* Quizzes */
app.use('/api/v1/quizzes',       require('./modules/quizzes/quizzes.routes'));

/* Messages */
app.use('/api/v1/messages',      require('./modules/messages/messages.routes'));

/* Notifications */
app.use('/api/v1/notifications', require('./modules/notifications/notifications.routes'));

/* Certificates */
app.use('/api/v1/certificates',  require('./modules/certificates/certificates.routes'));

/* Attendance */
app.use('/api/v1/attendance',    require('./modules/attendance/attendance.routes'));

/* Assignments */
app.use('/api/v1/assignments',   require('./modules/assignments/assignments.routes'));

/* Discussions */
app.use('/api/v1/discussions',   require('./modules/discussions/discussions.routes'));

/* Live Sessions */
app.use('/api/v1/live-sessions', require('./modules/live-sessions/live-sessions.routes'));

/* Videos — progress, notes, bookmarks */
app.use('/api/v1/videos',        require('./modules/videos/videos.routes'));

/* Reports — all roles */
app.use('/api/v1/reports',       require('./modules/reports/reports.routes'));

/* ══════════════════════════════════════════════════════════════
   9. 404 HANDLER — MUST be after all route definitions.
   Catches any request that didn't match a route above.
══════════════════════════════════════════════════════════════ */
app.use(notFoundHandler);

/* ══════════════════════════════════════════════════════════════
   10. GLOBAL ERROR HANDLER — MUST be last.
   Catches all errors thrown/passed via next(err) in route handlers.
   Always sends a JSON response — never an empty body.
══════════════════════════════════════════════════════════════ */
app.use(globalErrorHandler);

module.exports = app;

/*
 * ══════════════════════════════════════════════════════════════════════
 * INFRASTRUCTURE NOTES (apply to server.js and proxy config)
 * ══════════════════════════════════════════════════════════════════════
 *
 * ── server.js — increase HTTP timeout for large video uploads ──
 *
 *   const http   = require('http');
 *   const app    = require('./app');
 *   const server = http.createServer(app);
 *
 *   server.timeout          = 6 * 60 * 60 * 1000;  // 6 hours
 *   server.keepAliveTimeout = 65 * 1000;            // 65s (> AWS ALB default)
 *
 *   server.listen(process.env.PORT || 5000);
 *
 *
 * ── Nginx config (if using Nginx as reverse proxy) ──
 *
 *   client_max_body_size       50G;
 *   client_body_timeout        3600s;
 *   proxy_read_timeout         3600s;
 *   proxy_send_timeout         3600s;
 *   proxy_connect_timeout      60s;
 *   proxy_request_buffering    off;
 *   proxy_buffering            off;
 *
 *   location /api/ {
 *     proxy_pass         http://localhost:5000;
 *     proxy_http_version 1.1;
 *     proxy_set_header   Upgrade $http_upgrade;
 *     proxy_set_header   Connection 'upgrade';
 *     proxy_set_header   Host $host;
 *     proxy_cache_bypass $http_upgrade;
 *     proxy_request_buffering off;
 *   }
 *
 *   location /uploads/ {
 *     alias /path/to/eduverse/uploads/;
 *     add_header Accept-Ranges bytes;
 *     add_header Cache-Control "no-cache" always;
 *   }
 *
 *
 * ── Multer disk storage (in instructor.routes.js) ──
 *
 *   const videoUpload = multer({
 *     storage: makeStorage('videos'),        // diskStorage — never in RAM
 *     limits:  { fileSize: 50 * 1024**3 },   // 50 GB hard limit
 *   });
 *
 *
 * ── Frontend upload (course-builder.html) ──
 *
 *   - Uses XMLHttpRequest (NOT fetch) so xhr.upload.onprogress fires
 *   - xhr.timeout = 0  (no client-side timeout)
 *   - Shows real-time progress %, upload speed, and ETA
 *
 *
 * ── Windows path note ──
 *
 *   Uploads folder: E:\Ds_projects\eduverse\uploads
 *   Assumed structure:
 *     backend/modules/instructor/instructor.routes.js
 *     uploads/videos/
 *     uploads/thumbnails/
 */