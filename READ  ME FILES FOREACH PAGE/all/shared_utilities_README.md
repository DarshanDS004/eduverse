# Shared Utilities & Socket Handlers — Complete Documentation

---

# ERRORHANDLER.JS

## 1. FILE OVERVIEW

**File Name:** `errorHandler.js`  
**File Type:** Express Error Handling Utility  
**Location:** `shared/errorHandler.js`  
**Purpose:** Provide centralized, bulletproof error handling with standardized JSON responses and custom error class.

---

## 2. RESPONSIBILITY

- **Error Standardization** — Convert all errors to consistent JSON format
- **Custom Errors** — AppError class for operational errors with status codes
- **Express Integration** — Global error middleware (4-argument handler)
- **Error Type Routing** — Handle Multer, MySQL, JWT, SyntaxError, etc.
- **Response Guarantees** — Always send JSON, never empty body

---

## 3. EXPORTS

### 1. `AppError` Class

**Purpose:** Custom error class for intentional, operational errors.

**Constructor:**
```javascript
new AppError(message, statusCode, code)
```

**Parameters:**
- `message` (string) — Human-readable error message
- `statusCode` (number) — HTTP status code (default: 500)
- `code` (string) — Machine-readable error code (default: 'SERVER_ERROR')

**Properties:**
```javascript
{
  message: "Course not found.",
  statusCode: 404,
  code: "NOT_FOUND",
  isOperational: true,  // Flag for global handler
  stack: "..."          // Captured stack trace
}
```

**Usage:**
```javascript
// In service layer
if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

// In controller
try {
  const course = await service.getCourse(id);
} catch (err) {
  next(err);  // Passed to globalErrorHandler
}
```

---

### 2. `sendSuccess(res, statusCode, message, data)`

**Purpose:** Send successful response with standardized format.

**Parameters:**
- `res` (Response) — Express response object
- `statusCode` (number) — HTTP status code (default: 200)
- `message` (string) — Success message
- `data` (any, optional) — Response payload

**Returns:** Response JSON

**Guarantees:**
- Checks if headers already sent (prevents double send)
- Always includes `success: true`
- Includes `data` only if provided and not null

**Response Format:**
```json
{
  "success": true,
  "message": "Order created.",
  "data": { /* optional */ }
}
```

**Usage:**
```javascript
// Without data
return sendSuccess(res, 200, 'User deleted.');

// With data
return sendSuccess(res, 201, 'Order created.', {
  payment_id: 789,
  razorpay_order_id: "order_xyz"
});
```

---

### 3. `sendError(res, statusCode, message, code)`

**Purpose:** Send error response with standardized format.

**Parameters:**
- `res` (Response) — Express response object
- `statusCode` (number) — HTTP status code (default: 400)
- `message` (string) — Error message
- `code` (string) — Error code (default: 'ERROR')

**Returns:** Response JSON

**Response Format:**
```json
{
  "success": false,
  "message": "Course not found.",
  "code": "NOT_FOUND"
}
```

**Usage:**
```javascript
if (!course) {
  return sendError(res, 404, 'Course not found.', 'NOT_FOUND');
}

if (!email) {
  return sendError(res, 400, 'Email is required.', 'MISSING_FIELDS');
}
```

---

### 4. `globalErrorHandler(err, req, res, next)`

**Purpose:** Express error middleware (4 arguments required!) that catches ALL unhandled errors.

**CRITICAL:** Must be last middleware in Express app:
```javascript
app.use(protect);
app.use(routes);
app.use(notFoundHandler);
app.use(globalErrorHandler);  // LAST!
```

**Features:**

#### 1. Prevent Double Sends
```javascript
if (res.headersSent) return res.end();
```

If headers already sent, just end response (can happen in streaming).

#### 2. Error Logging
```javascript
console.error('[EduVerse Error]', {
  method: req.method,
  url: req.originalUrl,
  message: err.message,
  code: err.code,
  stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
});
```

Always logs errors for debugging.

#### 3. Error Type Routing

**Multer Errors (File Upload)**
```javascript
if (err.code === 'LIMIT_FILE_SIZE') {
  return res.status(413).json({
    success: false,
    message: 'File too large. Please upload a smaller file.',
    code: 'FILE_TOO_LARGE',
  });
}
if (err.code === 'LIMIT_UNEXPECTED_FILE') {
  return res.status(400).json({
    success: false,
    message: 'Unexpected file field. Check your upload form.',
    code: 'UNEXPECTED_FILE',
  });
}
```

**MySQL Errors (Database)**
```javascript
if (err.code === 'ER_DUP_ENTRY') {
  // Duplicate key constraint violation
  return res.status(409).json({
    success: false,
    message: 'A record with this value already exists.',
    code: 'DUPLICATE_ENTRY',
  });
}

if (err.code === 'ER_NO_REFERENCED_ROW_2') {
  // Foreign key constraint violation
  return res.status(400).json({
    success: false,
    message: 'Referenced record does not exist.',
    code: 'FOREIGN_KEY_ERROR',
  });
}

if (err.code && err.code.startsWith('ER_')) {
  // Generic MySQL error
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? 'Database error: ' + err.message
      : 'A database error occurred. Please try again.',
    code: 'DB_ERROR',
  });
}
```

**JWT Errors (Authentication)**
```javascript
if (err.name === 'JsonWebTokenError') {
  return res.status(401).json({
    success: false,
    message: 'Invalid token. Please log in again.',
    code: 'INVALID_TOKEN',
  });
}

if (err.name === 'TokenExpiredError') {
  return res.status(401).json({
    success: false,
    message: 'Your session has expired. Please log in again.',
    code: 'TOKEN_EXPIRED',
  });
}
```

**JSON Parse Errors**
```javascript
if (err instanceof SyntaxError && err.status === 400) {
  return res.status(400).json({
    success: false,
    message: 'Invalid JSON in request body.',
    code: 'INVALID_JSON',
  });
}
```

**AppError (Operational)**
```javascript
if (err.isOperational) {
  return res.status(err.statusCode || 400).json({
    success: false,
    message: err.message,
    code: err.code || 'ERROR',
  });
}
```

**Unknown Errors (Server Errors)**
```javascript
// Never expose stack trace in production
return res.status(statusCode).json({
  success: false,
  message: process.env.NODE_ENV === 'development'
    ? err.message || 'Internal server error.'
    : 'Something went wrong. Please try again.',
  code: 'SERVER_ERROR',
});
```

---

### 5. `notFoundHandler(req, res)`

**Purpose:** Catch requests to undefined routes.

**Usage:**
```javascript
// In app.js, BEFORE globalErrorHandler
app.use(protect);
app.use(routes);
app.use(notFoundHandler);  // ← Add here
app.use(globalErrorHandler);
```

**Response (404):**
```json
{
  "success": false,
  "message": "Route not found: GET /api/invalid/path",
  "code": "NOT_FOUND"
}
```

---

## 4. COMPLETE ERROR HANDLING FLOW

```
1. Request comes in
   ↓
2. Route handler executes
   ├─ Validation error → return sendError(res, 400, ...)
   ├─ Service throws AppError → caught by try-catch → next(err)
   ├─ Service throws unknown error → caught by try-catch → next(err)
   ├─ Multer error (file too large) → caught by try-catch → next(err)
   └─ Unhandled promise rejection → globalErrorHandler
   ↓
3. globalErrorHandler middleware
   ├─ Check error type
   ├─ Log error
   ├─ Route to appropriate handler
   └─ Send JSON response
   ↓
4. Client receives standardized JSON response
```

---

## 5. ERROR CODE REFERENCE

| Code | Status | Meaning |
|------|--------|---------|
| NOT_FOUND | 404 | Resource doesn't exist |
| MISSING_FIELDS | 400 | Required field missing |
| INVALID_TOKEN | 401 | JWT token invalid |
| TOKEN_EXPIRED | 401 | JWT token expired |
| FILE_TOO_LARGE | 413 | Upload exceeds size limit |
| UNEXPECTED_FILE | 400 | Unexpected file field |
| DUPLICATE_ENTRY | 409 | Unique constraint violation |
| FOREIGN_KEY_ERROR | 400 | Foreign key constraint |
| DB_ERROR | 500 | Database query error |
| INVALID_JSON | 400 | Malformed JSON body |
| SERVER_ERROR | 500 | Unknown server error |

---

## 6. KEY PATTERNS

### Pattern 1: Controller → Service → Error
```javascript
// Controller
async function getCourse(req, res, next) {
  try {
    const course = await service.getCourse(req.params.id);
    return sendSuccess(res, 200, 'Course loaded.', course);
  } catch (err) {
    next(err);  // Pass to globalErrorHandler
  }
}

// Service
async function getCourse(id) {
  const [[course]] = await db.query('SELECT * FROM courses WHERE id = ?', [id]);
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');
  return course;
}

// Client receives:
{
  "success": false,
  "message": "Course not found.",
  "code": "NOT_FOUND"
}
```

### Pattern 2: Validation in Controller
```javascript
// In controller
if (!email) {
  return sendError(res, 400, 'Email is required.', 'MISSING_FIELDS');
}

// Does NOT go to globalErrorHandler
// Responds immediately with 400
```

### Pattern 3: Multer Error
```javascript
// Multer throws with code 'LIMIT_FILE_SIZE'
// Caught by try-catch in route handler
// Passed to globalErrorHandler via next(err)
// globalErrorHandler detects err.code === 'LIMIT_FILE_SIZE'
// Responds with 413 and appropriate message
```

---

## 7. SUMMARY

**errorHandler.js** provides:

1. **AppError** — Custom error class for operational errors
2. **sendSuccess** — Standardized success response
3. **sendError** — Standardized error response
4. **globalErrorHandler** — Express error middleware (4 args)
5. **notFoundHandler** — 404 for undefined routes

**Guarantees:**
- Always sends JSON (never empty body)
- Handles 10+ error types (Multer, MySQL, JWT, etc.)
- Never exposes stack traces in production
- Prevents double-sends
- Standardized response format across all endpoints

---

# HELPERS.JS

## 1. FILE OVERVIEW

**File Name:** `helpers.js`  
**File Type:** Utility Functions Library  
**Location:** `shared/helpers.js`  
**Purpose:** Pure utility functions (no DB, no Express) used across all modules.

---

## 2. EXPORTS (50+ Functions)

### STRING UTILITIES

#### `randomString(length, charset)`
**Purpose:** Generate random alphanumeric string.

**Example:**
```javascript
randomString(8)  // → "XK9P2M7B"
randomString(16, '0123456789')  // → "4829374618293847"
```

**Use Cases:**
- Invite codes
- Temporary passwords
- Reference IDs

#### `generateCertificateCode()`
**Purpose:** Generate certificate code (EV-{16 hex}).

**Example:**
```javascript
generateCertificateCode()  // → "EV-A1B2C3D4E5F6G7H8"
```

#### `generateOTP(digits)`
**Purpose:** Generate one-time password (6 digits by default).

**Example:**
```javascript
generateOTP()    // → "482937"
generateOTP(4)   // → "4829"
```

#### `slugify(str)`
**Purpose:** Convert string to URL-safe slug.

**Example:**
```javascript
slugify("Grade 10 - Section A")  // → "grade-10-section-a"
slugify("Python 101 Course!!!")  // → "python-101-course"
```

#### `truncate(str, maxLength)`
**Purpose:** Truncate with ellipsis.

**Example:**
```javascript
truncate("Long course description...", 20)
// → "Long course descr..."
```

#### `titleCase(str)`
**Purpose:** Capitalize first letter of each word.

**Example:**
```javascript
titleCase("john doe")  // → "John Doe"
titleCase("python 101")  // → "Python 101"
```

#### `escapeHtml(str)`
**Purpose:** Sanitize HTML (basic XSS prevention).

**Example:**
```javascript
escapeHtml('<script>alert("xss")</script>')
// → "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
```

---

### NUMBER UTILITIES

#### `round(num, decimals)`
**Purpose:** Round to N decimal places.

**Example:**
```javascript
round(3.14159, 2)  // → 3.14
round(99.999, 1)   // → 100.0
```

#### `percentage(value, total, decimals)`
**Purpose:** Calculate percentage.

**Example:**
```javascript
percentage(80, 100, 1)  // → 80.0
percentage(3, 10, 2)    // → 30.00
percentage(0, 0)        // → 0 (handles zero total)
```

#### `formatCurrency(amount, currency)`
**Purpose:** Format as currency (INR by default).

**Example:**
```javascript
formatCurrency(99999)          // → "₹99,999.00"
formatCurrency(1234.5, 'USD')  // → "$1,234.50"
```

**Uses Intl.NumberFormat** — respects locale (en-IN).

#### `clamp(num, min, max)`
**Purpose:** Constrain number between min and max.

**Example:**
```javascript
clamp(5, 1, 10)   // → 5
clamp(-5, 1, 10)  // → 1 (clamped to min)
clamp(15, 1, 10)  // → 10 (clamped to max)
```

---

### DATE UTILITIES

#### `formatDate(date)`
**Purpose:** Format date to readable string (15 Jan 2025).

**Example:**
```javascript
formatDate(new Date('2025-01-15'))  // → "15 Jan 2025"
```

#### `formatDateTime(date)`
**Purpose:** Format date + time (15 Jan 2025, 10:30 AM).

**Example:**
```javascript
formatDateTime(new Date('2025-01-15T10:30:00'))
// → "15 Jan 2025, 10:30 AM"
```

#### `timeAgo(date)`
**Purpose:** Relative time string.

**Example:**
```javascript
timeAgo(Date.now() - 5 * 60 * 1000)  // → "5 minutes ago"
timeAgo(Date.now() + 2 * 24 * 60 * 60 * 1000)  // → "in 2 days"
```

**Units:** year, month, week, day, hour, minute, second, just now.

#### `isPast(date)`
**Purpose:** Check if date is in the past.

**Example:**
```javascript
isPast(new Date('2020-01-01'))  // → true
isPast(new Date('2030-01-01'))  // → false
```

#### `isWithinDays(date, days)`
**Purpose:** Check if date is within N days from now.

**Example:**
```javascript
isWithinDays(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 7)  // → true
```

#### `startOfDay(date)`
**Purpose:** Get midnight (00:00:00) for a date.

**Example:**
```javascript
startOfDay(new Date('2025-01-15T10:30:00'))
// → Date object for 2025-01-15T00:00:00
```

#### `daysAgo(n)`
**Purpose:** Get date N days ago.

**Example:**
```javascript
daysAgo(7)  // → Date object for 7 days ago
```

---

### FILE UTILITIES

#### `formatFileSize(bytes)`
**Purpose:** Format bytes for display.

**Example:**
```javascript
formatFileSize(1024)           // → "1.0 KB"
formatFileSize(1048576)        // → "1.0 MB"
formatFileSize(1073741824)     // → "1.0 GB"
```

#### `getExtension(filename)`
**Purpose:** Extract file extension.

**Example:**
```javascript
getExtension("document.pdf")    // → "pdf"
getExtension("image.JPEG")      // → "jpeg" (lowercase)
```

#### `isAllowedExtension(filename, allowed)`
**Purpose:** Check if extension is in whitelist.

**Example:**
```javascript
isAllowedExtension("photo.jpg", ['.jpg', '.png', '.webp'])  // → true
isAllowedExtension("virus.exe", ['.jpg', '.png'])           // → false
```

---

### ARRAY & OBJECT UTILITIES

#### `uniqueBy(arr, key)`
**Purpose:** Remove duplicate objects by key.

**Example:**
```javascript
const users = [
  { id: 1, name: "John" },
  { id: 1, name: "Jane" },
  { id: 2, name: "Bob" }
];
uniqueBy(users, 'id')
// → [{ id: 1, name: "John" }, { id: 2, name: "Bob" }]
```

#### `groupBy(arr, key)`
**Purpose:** Group objects by key.

**Example:**
```javascript
const users = [
  { id: 1, role: "student" },
  { id: 2, role: "instructor" },
  { id: 3, role: "student" }
];
groupBy(users, 'role')
// → {
//     student: [{ id: 1, role: "student" }, { id: 3, role: "student" }],
//     instructor: [{ id: 2, role: "instructor" }]
//   }
```

#### `chunk(arr, size)`
**Purpose:** Split array into chunks.

**Example:**
```javascript
chunk([1, 2, 3, 4, 5], 2)
// → [[1, 2], [3, 4], [5]]
```

**Use Cases:**
- Bulk SMS (send 100 at a time)
- Batch database inserts
- Rate-limited API calls

#### `pick(obj, keys)`
**Purpose:** Extract specific keys.

**Example:**
```javascript
const user = { id: 1, name: "John", email: "john@example.com", password_hash: "..." };
pick(user, ['id', 'name', 'email'])
// → { id: 1, name: "John", email: "john@example.com" }
```

#### `omit(obj, keys)`
**Purpose:** Remove specific keys.

**Example:**
```javascript
const user = { id: 1, name: "John", password_hash: "...", refresh_token: "..." };
omit(user, ['password_hash', 'refresh_token'])
// → { id: 1, name: "John" }
```

---

### VALIDATION HELPERS

#### `isEmail(str)`
**Purpose:** Check if string is valid email.

**Example:**
```javascript
isEmail("john@example.com")   // → true
isEmail("invalid-email")       // → false
```

#### `isIndianPhone(str)`
**Purpose:** Check if string is Indian phone number.

**Example:**
```javascript
isIndianPhone("9876543210")         // → true
isIndianPhone("+91 98765 43210")    // → true
isIndianPhone("1234567890")         // → false (starts with 1)
```

#### `isPositiveInt(val)`
**Purpose:** Check if value is positive integer.

**Example:**
```javascript
isPositiveInt(5)    // → true
isPositiveInt(-5)   // → false
isPositiveInt(5.5)  // → false
```

---

### CRYPTO HELPERS

#### `sha256(data, secret)`
**Purpose:** Hash with SHA-256 (with optional HMAC).

**Example:**
```javascript
sha256("password")                          // → "5e88..."
sha256("order_id|payment_id", "secret")     // → "a2b3..." (HMAC)
```

#### `generateToken(bytes)`
**Purpose:** Generate secure random token (hex).

**Example:**
```javascript
generateToken(32)  // → "a1b2c3d4e5f6..."
```

---

### ASYNC HELPERS

#### `sleep(ms)`
**Purpose:** Promise-based sleep (delay).

**Example:**
```javascript
await sleep(1000);  // Wait 1 second
```

#### `retry(fn, times, delayMs)`
**Purpose:** Retry async function with exponential backoff.

**Example:**
```javascript
const data = await retry(
  () => fetch('/api/data'),
  3,      // 3 attempts
  500     // 500ms initial delay
);
```

**Backoff:** Delay multiplied by attempt number (500ms, 1000ms, 1500ms).

---

## 3. USAGE PATTERNS

### Pattern 1: Format User Data for Response
```javascript
const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
const safe = omit(user, ['password_hash', 'refresh_token', '2fa_secret']);
const formatted = {
  ...safe,
  created_at: formatDateTime(user.created_at),
  avatar: user.avatar_url || null
};
return sendSuccess(res, 200, 'User loaded.', formatted);
```

### Pattern 2: Batch Process with Rate Limiting
```javascript
const users = await db.query('SELECT * FROM users');
const chunks = chunk(users, 100);

for (const batch of chunks) {
  await Promise.all(batch.map(u => sendEmail(u.email)));
  await sleep(500);  // Rate limit
}
```

### Pattern 3: Prepare Data for Export
```javascript
const payments = await db.query('SELECT * FROM payments WHERE date = ?', [date]);
const formatted = payments.map(p => ({
  id: p.id,
  amount: formatCurrency(p.amount),
  date: formatDate(p.created_at),
  status: titleCase(p.status)
}));
```

---

## 4. SUMMARY

**helpers.js** exports 50+ pure utility functions:

| Category | Functions | Count |
|----------|-----------|-------|
| Strings | randomString, slug, truncate, titleCase, escapeHtml | 6 |
| Numbers | round, percentage, formatCurrency, clamp | 4 |
| Dates | formatDate, timeAgo, isPast, daysAgo, etc. | 7 |
| Files | formatFileSize, getExtension, isAllowedExtension | 3 |
| Arrays/Objects | uniqueBy, groupBy, chunk, pick, omit | 5 |
| Validation | isEmail, isIndianPhone, isPositiveInt | 3 |
| Crypto | sha256, generateToken | 2 |
| Async | sleep, retry | 2 |

**Design:** Zero dependencies, no side effects, composable utilities.

---

# LOGGER.JS

## 1. FILE OVERVIEW

**File Name:** `logger.js`  
**File Type:** Logging Configuration  
**Location:** `shared/logger.js`  
**Purpose:** Winston-based structured logger with environment-specific formatting.

---

## 2. LOG LEVELS

| Level | Use Case |
|-------|----------|
| `error` | Unhandled errors, crashes, critical issues |
| `warn` | Recoverable issues, missing config, deprecations |
| `info` | Normal operations: server start, login, payment |
| `http` | HTTP request/response logs (status, duration) |
| `debug` | Detailed debugging: DB queries, socket events |

---

## 3. CONFIGURATION

**Environment-Based:**

**Development:**
- Log level: `debug` (all messages)
- Format: Pretty-printed with colors
- Output: Console only

**Production:**
- Log level: `info` (exclude debug)
- Format: JSON (for aggregators)
- Output: Console + rotating file logs

**Log Files (Production Only):**
- `logs/app.log` — All messages (max 10MB, 5 files)
- `logs/error.log` — Errors only (max 10MB, 5 files)

---

## 4. USAGE

### Basic Logging
```javascript
const logger = require('./shared/logger');

logger.info('User logged in', { userId: 5, role: 'student' });
logger.warn('Configuration missing', { key: 'SMTP_HOST' });
logger.error('Database connection failed', { error: err.message });
logger.debug('SQL Query', { query: 'SELECT * FROM users', duration: 45 });
```

**Output (Development):**
```
10:30:45 [info] User logged in
  {
    "userId": 5,
    "role": "student"
  }
```

**Output (Production/JSON):**
```json
{
  "timestamp": "2025-01-20T10:30:45Z",
  "level": "info",
  "message": "User logged in",
  "userId": 5,
  "role": "student"
}
```

### HTTP Middleware
```javascript
// In Express app
const logger = require('./shared/logger');

app.use(logger.httpMiddleware());
```

**Logs automatically:**
```javascript
logger.http('GET /api/courses', {
  status: 200,
  duration_ms: 45,
  ip: '192.168.1.1',
  user_id: 100
});

logger.warn('GET /api/invalid', {
  status: 404,
  duration_ms: 2,
  ip: '192.168.1.1'
});

logger.error('POST /api/payment', {
  status: 500,
  duration_ms: 123,
  ip: '192.168.1.1',
  user_id: 100
});
```

**Status Code Routing:**
- 5xx → `error` level
- 4xx → `warn` level
- 2xx/3xx → `http` level

### Audit Logging
```javascript
// Log + write to DB audit_logs table
logger.audit('User deleted', userId, {
  reference_type: 'users',
  reference_id: targetUserId
}, ip);

logger.audit('Course rejected', adminId, {
  reference_type: 'courses',
  reference_id: courseId,
  reason: 'Plagiarism detected'
}, ip);
```

**Audit Features:**
- Always logs to console
- Also writes to `audit_logs` table (non-blocking)
- Includes timestamp automatically
- If DB write fails, doesn't break request

---

## 5. FORMAT EXAMPLES

### Development Console (Pretty)
```
10:30:45 [info] User logged in
  {
    "userId": 5,
    "role": "student"
  }

10:30:46 [error] Database error
  {
    "error": "Connection timeout",
    "query": "SELECT * FROM courses",
    "stack": "at Database.query (db.js:45)..."
  }
```

### Production File (JSON)
```json
{"timestamp":"2025-01-20T10:30:45Z","level":"info","message":"User logged in","userId":5,"role":"student"}
{"timestamp":"2025-01-20T10:30:46Z","level":"error","message":"Database error","error":"Connection timeout","query":"SELECT * FROM courses"}
```

---

## 6. SUMMARY

**logger.js** provides:

1. **Winston Integration** — Industry-standard logging
2. **Environment-Specific Formatting** — Pretty dev, JSON prod
3. **Multiple Transports** — Console + file rotation
4. **HTTP Middleware** — Auto-log request/response
5. **Audit Logging** — Track admin actions in DB
6. **Structured Logging** — JSON with metadata

**Key Design:**
- All logs include timestamp
- Stack traces only in development
- Non-blocking file writes
- Automatic file rotation (max 10MB)
- Always exits with useful message (no silent crashes)

---

# PAGINATE.JS

## 1. FILE OVERVIEW

**File Name:** `paginate.js`  
**File Type:** Pagination Utility  
**Location:** `shared/paginate.js`  
**Purpose:** Centralized pagination logic for all list endpoints.

---

## 2. FUNCTIONS

### `parsePagination(query, defaultLimit, maxLimit)`

**Purpose:** Parse page + per_page from query string.

**Parameters:**
- `query` — `req.query` object
- `defaultLimit` — Default items per page (default: 20)
- `maxLimit` — Maximum allowed (default: 100)

**Returns:**
```javascript
{
  pageNum: 1,      // Current page (minimum 1)
  limitNum: 20,    // Items per page
  offset: 0        // Database OFFSET value
}
```

**Examples:**
```javascript
parsePagination({ page: '1', per_page: '10' })
// → { pageNum: 1, limitNum: 10, offset: 0 }

parsePagination({ page: '3', per_page: '20' })
// → { pageNum: 3, limitNum: 20, offset: 40 }

parsePagination({ page: '0', per_page: '500' })
// → { pageNum: 1, limitNum: 100, offset: 0 }  (clamped to max)

parsePagination({})
// → { pageNum: 1, limitNum: 20, offset: 0 }  (defaults)
```

**Safety Features:**
- Page minimum: 1 (no page 0)
- Per_page maximum: 100 (prevent huge queries)
- Non-numeric values: defaults to 1 and 20

---

### `buildMeta(total, pageNum, limitNum)`

**Purpose:** Build pagination metadata object.

**Returns:**
```javascript
{
  meta: {
    total: 250,           // Total records in database
    page: 2,              // Current page
    per_page: 20,         // Items per page
    total_pages: 13,      // Math.ceil(250 / 20)
    has_next: true,       // pageNum < totalPages
    has_prev: true,       // pageNum > 1
    next_page: 3,         // pageNum + 1 or null
    prev_page: 1          // pageNum - 1 or null
  }
}
```

**Example:**
```javascript
buildMeta(250, 2, 20)
// Calculates: totalPages = 13, has_next = true, has_prev = true, next_page = 3, prev_page = 1
```

---

### `paginateQuery(db, dataSQL, countSQL, dataParams, countParams, pageNum, limitNum)`

**Purpose:** Execute paginated query (count + data) together.

**Parameters:**
- `db` — MySQL pool
- `dataSQL` — SELECT query (without LIMIT/OFFSET)
- `countSQL` — COUNT query
- `dataParams` — Query params
- `countParams` — Count params
- `pageNum`, `limitNum` — From parsePagination

**Returns:**
```javascript
{
  rows: [{...}, {...}],  // Data from page
  pagination: { ... }    // Meta object from buildMeta
}
```

**Example:**
```javascript
const { rows, pagination } = await paginateQuery(
  db,
  'SELECT id, title FROM courses WHERE status = ?',
  'SELECT COUNT(*) AS total FROM courses WHERE status = ?',
  ['published'],
  ['published'],
  pageNum,
  limitNum
);

return { data: rows, pagination };
```

**Efficiency:**
- Runs count + data in parallel (both queries fast)
- LIMIT/OFFSET added automatically
- No N+1 queries

---

### `buildFilters(filters, initial)`

**Purpose:** Build WHERE clause from filter map.

**Parameters:**
- `filters` — Key-value map of filters:
  ```javascript
  {
    'courses.status': { op: '=', value: 'published' },
    'courses.price': { op: '>=', value: 100 },
    'users.full_name': { op: 'LIKE', value: '%john%' }
  }
  ```
- `initial` — Pre-existing WHERE conditions

**Returns:**
```javascript
{
  where: ['u.status = ?', 'u.price >= ?', 'u.full_name LIKE ?'],
  params: ['published', 100, '%john%']
}
```

**Usage in Query:**
```javascript
const { where, params } = buildFilters({
  'u.role': { op: '=', value: 'student' },
  'u.is_active': { op: '=', value: 1 }
}, ['u.created_at >= ?']);

params.push('2024-01-01');
const whereSQL = buildWhereSQL(where);

const [rows] = await db.query(
  `SELECT * FROM users u ${whereSQL} ORDER BY id DESC`,
  params
);
```

**Filter Operators:**
- `=` (equality)
- `!=` (not equal)
- `>`, `<`, `>=`, `<=` (comparison)
- `LIKE` (pattern matching)
- `IN` (membership)
- `BETWEEN` (range)

---

### `buildWhereSQL(conditions)`

**Purpose:** Build WHERE clause string from array.

**Example:**
```javascript
buildWhereSQL(['u.status = ?', 'u.price >= ?'])
// → 'WHERE u.status = ? AND u.price >= ?'

buildWhereSQL([])
// → '' (no WHERE)
```

---

### `buildSort(sortParam, sortMap, defaultSort)`

**Purpose:** Build ORDER BY from allowed sort options.

**Parameters:**
- `sortParam` — Sort value from query (e.g., 'newest')
- `sortMap` — Allowed sorts mapping:
  ```javascript
  {
    'newest': 'created_at DESC',
    'oldest': 'created_at ASC',
    'price_high': 'price DESC',
    'price_low': 'price ASC'
  }
  ```
- `defaultSort` — Fallback if invalid (e.g., 'created_at DESC')

**Example:**
```javascript
buildSort('newest', { newest: 'created_at DESC' }, 'created_at DESC')
// → 'ORDER BY created_at DESC'

buildSort('invalid', { newest: 'created_at DESC' }, 'created_at DESC')
// → 'ORDER BY created_at DESC'  (fallback)
```

**Security:**
- Only allows pre-defined sorts
- Prevents SQL injection via order by

---

## 3. COMPLETE EXAMPLE

```javascript
// Route handler
async function getCourses(req, res, next) {
  try {
    // 1. Parse pagination
    const { pageNum, limitNum, offset } = parsePagination(req.query, 20, 100);

    // 2. Build filters
    const { where, params } = buildFilters({
      'c.status': { op: '=', value: 'published' },
      'c.category': { op: '=', value: req.query.category }
    }, []);

    const whereSQL = buildWhereSQL(where);

    // 3. Build sort
    const orderSQL = buildSort(req.query.sort, {
      newest: 'c.created_at DESC',
      oldest: 'c.created_at ASC'
    }, 'c.created_at DESC');

    // 4. Execute paginated query
    const { rows, pagination } = await paginateQuery(
      db,
      `SELECT c.id, c.title, c.price FROM courses c ${whereSQL} ${orderSQL}`,
      `SELECT COUNT(*) AS total FROM courses c ${whereSQL}`,
      params,
      params,
      pageNum,
      limitNum
    );

    return sendSuccess(res, 200, 'Courses loaded.', {
      courses: rows,
      pagination
    });
  } catch (e) { next(e); }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Courses loaded.",
  "data": {
    "courses": [{ id: 1, title: "Python 101", price: 999 }],
    "pagination": {
      "total": 250,
      "page": 1,
      "per_page": 20,
      "total_pages": 13,
      "has_next": true,
      "next_page": 2
    }
  }
}
```

---

## 4. SUMMARY

**paginate.js** handles:

1. **Parse Query** — Extract page, per_page safely
2. **Build Metadata** — Total, total_pages, has_next, etc.
3. **Execute Query** — Count + data in single operation
4. **Apply Filters** — Dynamic WHERE clauses
5. **Apply Sort** — Safe ORDER BY from whitelist

**Design:** Composable, reusable across all list endpoints.

---

# VALIDATOR.JS

## 1. FILE OVERVIEW

**File Name:** `validator.js`  
**File Type:** Input Validation Middleware  
**Location:** `shared/validator.js`  
**Purpose:** Centralized input validation using `express-validator` with pre-built chains per feature.

---

## 2. VALIDATION FLOW

```
1. Route defines validators (middleware array)
2. Request arrives
3. express-validator checks each rule
4. If errors: collect in validationResult
5. validate() middleware checks errors
6. If errors: return 422 with formatted list
7. If OK: call next() → controller
```

**Example Route:**
```javascript
router.post('/register',
  validators.register,  // ← Validation chain
  validate,             // ← Check results
  controller.register   // ← Controller
);
```

---

## 3. EXPORTS

### `validate(req, res, next)`

**Purpose:** Check validation results and respond with errors.

**Response (if errors):**
```json
{
  "success": false,
  "message": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "data": [
    { "field": "email", "message": "Please enter a valid email address." },
    { "field": "password", "message": "Password must be at least 8 characters." }
  ]
}
```

---

### `field` Object (Reusable Validators)

#### Field Validators

```javascript
field.name()           // Required, 2-100 chars
field.email()          // Required, valid email, normalized
field.password()       // Required, 8+ chars, 1 uppercase, 1 number
field.phone()          // Optional, 7-15 digits
field.role()           // Required, one of: student/instructor/parent/institute
field.id(fieldName)    // In URL param, positive integer
field.positiveInt(name)// In body, positive integer
field.rating()         // 1-5 integer
field.pagination()     // [page, per_page] optional
field.dateField(name)  // ISO 8601 date
field.url(name)        // Valid URL
field.price()          // Non-negative float
field.level()          // preschool/primary/middle/high/ug/pg/beginner/intermediate/advanced
```

#### Usage:
```javascript
validators.createCourse: [
  field.name(),        // Reuse built-in validator
  field.price(),
  field.level(),
  body('category').optional().trim().isLength({ max: 100 }),  // Custom
]
```

---

### `validators` Object (Pre-Built Chains)

#### Auth Validators

```javascript
validators.register     // name, email, password, role, phone
validators.login        // email, password
validators.forgotPassword// email
validators.resetPassword // token, password, confirm_password
```

#### Course Validators

```javascript
validators.createCourse // title, price, level, language, category
validators.submitReview // id (param), rating, review_text
```

#### Quiz Validators

```javascript
validators.createQuiz   // title, duration_seconds, pass_percentage, total_marks
validators.startQuiz    // id (param)
validators.submitQuiz   // id (param), attempt_id, answers (array)
```

#### Assignment Validators

```javascript
validators.createAssignment  // title, course_id, max_marks, deadline
validators.gradeSubmission   // id (param), score, feedback
```

#### Payment Validators

```javascript
validators.createOrder   // type, reference_id
validators.requestRefund // payment_id, reason (10-1000 chars)
```

#### Institute Validators

```javascript
validators.createClass      // name, section
validators.addStudent       // name, email, phone
validators.createFeeStructure// name, amount, type
validators.createCalendarEvent // event_name, event_date, event_type
```

#### Admin Validators

```javascript
validators.updateUserStatus // id (param), status (active/suspended/banned)
validators.updateFeatureFlag // feature_name, is_enabled (boolean)
```

---

## 4. VALIDATION RULES

### Password Strength
```javascript
field.password()
// • At least 8 characters
// • At least 1 uppercase letter
// • At least 1 number
// Example: "MyPass123" ✓, "mypassword" ✗
```

### Email Normalization
```javascript
field.email()
// • Valid email format
// • Normalized to lowercase
// • Trimmed whitespace
```

### Pagination
```javascript
field.pagination()
// • page: optional, 1+
// • per_page: optional, 1-100
// • Converted to integers
```

### Custom Validation (Passwords Match)
```javascript
body('confirm_password')
  .notEmpty().withMessage('Confirm password is required.')
  .custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  })
```

---

## 5. COMPLETE EXAMPLE

```javascript
// Route
router.post('/register',
  validators.register,
  validate,
  controller.register
);

// validators.register is:
[
  body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
  body('email').trim().notEmpty().isEmail().normalizeEmail(),
  body('password').notEmpty().isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  body('role').notEmpty().isIn(['student', 'instructor', 'parent', 'institute']),
  body('phone').optional().matches(/^\+?[0-9]{7,15}$/)
]

// Request with errors:
POST /auth/register
{
  "name": "J",           // ✗ too short
  "email": "invalid",    // ✗ not email
  "password": "simple",  // ✗ no uppercase
  "role": "admin",       // ✗ invalid role
  "phone": "123"         // ✗ too short
}

// Response (422):
{
  "success": false,
  "message": "Validation failed.",
  "code": "VALIDATION_ERROR",
  "data": [
    { "field": "name", "message": "Name must be 2–100 characters." },
    { "field": "email", "message": "Please enter a valid email address." },
    { "field": "password", "message": "Password must contain at least one uppercase letter." },
    { "field": "role", "message": "Invalid role. Must be: student, instructor, parent, or institute." },
    { "field": "phone", "message": "Please enter a valid phone number." }
  ]
}
```

---

## 6. SUMMARY

**validator.js** provides:

1. **50+ Validation Rules** — Pre-built via `field` object
2. **15+ Validator Chains** — Per-feature combinations
3. **Automatic Normalization** — Email lowercase, trimming
4. **Type Conversion** — Strings → integers, dates
5. **Standard Error Format** — 422 with field-level messages
6. **Custom Rules** — Support for complex validation

**Design:** Reusable, composable, DRY validation across all endpoints.

---

(Continuing with Socket Handlers in next section...)
