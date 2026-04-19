# payments.routes.js — Documentation

## 1. FILE OVERVIEW

**File Name:** `payments.routes.js`  
**File Type:** Express Router Configuration  
**Location:** `modules/payments/payments.routes.js`  
**Purpose:** Defines all HTTP routes for payment operations and applies authentication/authorization middleware to protect sensitive endpoints.

---

## 2. RESPONSIBILITY

This routes file is responsible for:
- **Route Definition**: Maps HTTP methods (POST, GET) to specific endpoints
- **Middleware Application**: Applies authentication and authorization checks
- **Public vs Protected Routes**: Distinguishes between public webhook and protected payment endpoints
- **HTTP Verb Mapping**: Uses correct verbs (POST for write, GET for read)
- **Router Exports**: Exports configured router to be mounted in main Express app

The file acts as the **URL routing layer** and does NOT contain business logic—it delegates to the controller.

---

## 3. IMPORTS / DEPENDENCIES

```javascript
const express = require('express');
const router  = express.Router();
const ctrl    = require('./payments.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');
```

| Import | Type | Purpose |
|--------|------|---------|
| `express` | Package | Node.js web framework |
| `express.Router()` | Function | Creates a router instance for modular route definitions |
| `./payments.controller` | Module | Contains 6 handler functions for payment operations |
| `protect` | Middleware | Verifies JWT authentication token from request headers |
| `restrictTo` | Middleware | Restricts access to specific user roles (not used here) |

---

## 4. CORE LOGIC BREAKDOWN

The file follows a **middleware-first design pattern**:

```
1. Define public routes (webhook)
   ↓
2. Apply protect middleware to all subsequent routes
   ↓
3. Define protected routes
   ↓
4. Export router
```

This ensures:
- Webhook route is accessible without authentication
- All other routes require valid JWT token
- Middleware is applied once to all protected routes (DRY principle)

---

## 5. ROUTE DEFINITIONS

### 5.1 Webhook Route (PUBLIC)

```javascript
router.post('/webhook/razorpay', ctrl.razorpayWebhook);
```

**Endpoint:** `POST /api/payments/webhook/razorpay`

**Authentication:** None (Public endpoint)

**Verification:** HMAC-SHA256 signature verification by controller

**Purpose:** Receives server-to-server payment notifications from Razorpay

**Payload Example:**
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_IluHHEbrMY1e2u",
        "order_id": "order_IluGWxBm9U8zJ8",
        "status": "captured"
      }
    }
  }
}
```

**Response:** `{ "success": true }` or `{ "success": false }`

**Why Public?** Razorpay servers cannot include authentication headers; signature verification provides security.

---

### 5.2 Protected Routes (All Require JWT)

After `router.use(protect)`, all routes require:
- Valid JWT token in `Authorization: Bearer <token>` header
- Token must contain valid user ID

```javascript
router.use(protect);
```

---

### 5.3 Create Order Route

```javascript
router.post('/create-order', ctrl.createOrder);
```

**Endpoint:** `POST /api/payments/create-order`

**Authentication:** Required (JWT token)

**User Role:** Any authenticated user (no role restriction)

**Request Body:**
```json
{
  "type": "course_purchase|material|fee|subscription",
  "reference_id": 123,
  "coupon_code": "SAVE50"  // optional
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Order created.",
  "data": {
    "payment_id": 789,
    "razorpay_order_id": "order_xyz",
    "razorpay_key": "key_xyz",
    "amount": 999.50,
    "amount_paise": 99950,
    "currency": "INR"
  }
}
```

**Use Cases:**
- Student purchases a course
- Student buys study materials
- Student pays institute fees
- Institute renews subscription

---

### 5.4 Verify Payment Route

```javascript
router.post('/verify', ctrl.verifyPayment);
```

**Endpoint:** `POST /api/payments/verify`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "razorpay_order_id": "order_xyz",
  "razorpay_payment_id": "pay_abc",
  "razorpay_signature": "signature_hash",
  "payment_db_id": 789
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified.",
  "data": {
    "message": "Payment successful.",
    "payment_id": 789
  }
}
```

**Flow:**
1. Frontend collects payment details from Razorpay callback
2. Frontend sends verification request to this endpoint
3. Controller verifies cryptographic signature
4. Service marks payment as success and fulfills order
5. Frontend receives confirmation

---

### 5.5 Get Payment History Route

```javascript
router.get('/history', ctrl.getHistory);
```

**Endpoint:** `GET /api/payments/history?type=course_purchase&status=success&page=1&per_page=10`

**Authentication:** Required (JWT token)

**Query Parameters:**
| Parameter | Type | Required | Values |
|-----------|------|----------|--------|
| `type` | string | No | `course_purchase`, `material`, `fee`, `subscription` |
| `status` | string | No | `pending`, `success`, `failed` |
| `page` | number | No | Integer ≥ 1 (default: 1) |
| `per_page` | number | No | Integer 1-50 (default: 10) |

**Response (200):**
```json
{
  "success": true,
  "message": "History loaded.",
  "data": {
    "payments": [
      {
        "id": 789,
        "amount": 999.50,
        "currency": "INR",
        "type": "course_purchase",
        "status": "success",
        "gateway_payment_id": "pay_abc",
        "created_at": "2024-01-20T15:30:45Z",
        "course_title": "Python 101"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "per_page": 10,
      "total_pages": 2
    }
  }
}
```

**Use Cases:**
- User views their purchase history
- User filters by payment type
- User checks payment status

---

### 5.6 Request Refund Route

```javascript
router.post('/refund-request', ctrl.requestRefund);
```

**Endpoint:** `POST /api/payments/refund-request`

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "payment_id": 789,
  "reason": "Course content doesn't match description"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Refund requested.",
  "data": {
    "id": 456,
    "message": "Refund request submitted. We will process it within 3-5 business days."
  }
}
```

**Validation:**
- Payment must be successful (`status = 'success'`)
- User must own the payment
- Only one pending refund request per payment

---

### 5.7 Get Refund Status Route

```javascript
router.get('/refund-status/:id', ctrl.getRefundStatus);
```

**Endpoint:** `GET /api/payments/refund-status/456`

**Authentication:** Required (JWT token)

**URL Parameter:**
- `:id` — Refund request ID

**Response (200):**
```json
{
  "success": true,
  "message": "Refund status loaded.",
  "data": {
    "id": 456,
    "reason": "Course content doesn't match description",
    "status": "pending|approved|rejected",
    "admin_note": "Reviewed and approved for refund",
    "created_at": "2024-01-15T10:30:00Z",
    "resolved_at": "2024-01-18T14:22:00Z",
    "amount": 999.50,
    "payment_type": "course_purchase"
  }
}
```

**Use Cases:**
- User checks refund status
- User views admin notes if rejected
- User sees resolved date if approved

---

## 6. MIDDLEWARE APPLICATION

### Middleware Stack

```javascript
// Unauthenticated routes
router.post('/webhook/razorpay', ctrl.razorpayWebhook);

// Applied to all routes below
router.use(protect);

// Authenticated routes
router.post('/create-order', ctrl.createOrder);
router.post('/verify', ctrl.verifyPayment);
router.get('/history', ctrl.getHistory);
router.post('/refund-request', ctrl.requestRefund);
router.get('/refund-status/:id', ctrl.getRefundStatus);
```

### Protect Middleware Behavior

When `router.use(protect)` is called:

1. **Token Extraction:**
   - Looks for `Authorization: Bearer <token>` header
   - Extracts token from header

2. **Token Verification:**
   - Decodes JWT using app's secret key
   - Verifies signature and expiration
   - Throws error if invalid or expired

3. **User Context:**
   - Adds `req.user` object with:
     ```javascript
     {
       id: 123,
       role: 'student',
       email: 'user@example.com',
       // ... other JWT claims
     }
     ```

4. **Error Response (if invalid):**
   ```json
   {
     "success": false,
     "statusCode": 401,
     "message": "Not authenticated. Please log in.",
     "code": "NOT_AUTHENTICATED"
   }
   ```

### Restrict To Middleware (Not Used)

The `restrictTo` middleware is imported but not used:

```javascript
const { protect, restrictTo } = require('../auth/auth.middleware');
// restrictTo not called
```

If it were used:
```javascript
router.use(protect, restrictTo('student', 'instructor'));
```

It would enforce role-based access (e.g., only students and instructors can create orders).

Currently, payment routes are accessible to **any authenticated user** regardless of role.

---

## 7. API ENDPOINTS SUMMARY TABLE

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/webhook/razorpay` | Signature | Receive payment webhook from Razorpay |
| POST | `/create-order` | JWT | Initiate payment order |
| POST | `/verify` | JWT | Verify payment and fulfill order |
| GET | `/history` | JWT | Get payment history with filters |
| POST | `/refund-request` | JWT | Request refund for payment |
| GET | `/refund-status/:id` | JWT | Check refund request status |

---

## 8. ERROR SCENARIOS & STATUS CODES

### Authentication Errors

**Missing Token:**
```bash
GET /api/payments/history
```
Response: 401 Unauthorized
```json
{
  "success": false,
  "message": "Not authenticated. Please log in.",
  "code": "NOT_AUTHENTICATED"
}
```

**Invalid Token:**
```bash
GET /api/payments/history
Authorization: Bearer invalid_token_xyz
```
Response: 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid token.",
  "code": "INVALID_TOKEN"
}
```

**Expired Token:**
```bash
GET /api/payments/history
Authorization: Bearer expired_token_xyz
```
Response: 401 Unauthorized
```json
{
  "success": false,
  "message": "Token has expired. Please log in again.",
  "code": "TOKEN_EXPIRED"
}
```

### Validation Errors

**Missing Required Fields:**
```bash
POST /api/payments/create-order
Authorization: Bearer <token>
Content-Type: application/json

{ "reference_id": 123 }  // Missing 'type'
```
Response: 400 Bad Request
```json
{
  "success": false,
  "message": "type and reference_id are required.",
  "code": "MISSING_FIELDS"
}
```

### Business Logic Errors

**Resource Not Found:**
```bash
GET /api/payments/refund-status/999
Authorization: Bearer <token>
```
Response: 404 Not Found
```json
{
  "success": false,
  "message": "Refund request not found.",
  "code": "NOT_FOUND"
}
```

**Duplicate Refund Request:**
```bash
POST /api/payments/refund-request
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_id": 789,
  "reason": "Change my mind"
}
```
Response: 409 Conflict
```json
{
  "success": false,
  "message": "A refund request already exists for this payment.",
  "code": "ALREADY_REQUESTED"
}
```

---

## 9. INTEGRATION WITH EXPRESS APP

### How This Router Is Used

In the main Express app (e.g., `app.js`):

```javascript
const paymentsRouter = require('./modules/payments/payments.routes');

// Mount the router at /api/payments
app.use('/api/payments', paymentsRouter);
```

### Final URL Construction

Base path: `/api/payments` + Route path = Final URL

Examples:
- `/api/payments/create-order`
- `/api/payments/verify`
- `/api/payments/history`
- `/api/payments/refund-request`
- `/api/payments/refund-status/456`
- `/api/payments/webhook/razorpay`

---

## 10. DATA FLOW DIAGRAM

```
HTTP Request
    ↓
Express Router Matching (/api/payments/...)
    ↓
Webhook Check? → Yes → Skip middleware → Controller
                        ↓
                  Payment Event Processing
                        ↓
                  JSON response { success: true/false }

Webhook Check? → No → Apply protect middleware
                       ↓
                  JWT Validation
                  ↓
                  Pass? → Yes → Extract req.user.id
                          ↓
                          Route to appropriate handler
                          ↓
                          Controller validates input
                          ↓
                          Calls service layer
                          ↓
                          Service processes (DB queries, etc.)
                          ↓
                          Controller formats response
                          ↓
                          sendSuccess() or sendError()
                          ↓
                          JSON response to client

                  Pass? → No → 401 Unauthorized
                          ↓
                          sendError() with auth error
                          ↓
                          JSON error response
```

---

## 11. SECURITY CONSIDERATIONS

### 1. JWT Authentication

**Strength:** Stateless token-based auth, verifiable cryptographically

**Usage:** All payment routes except webhook

**Best Practices Applied:**
- Token extracted from `Authorization: Bearer` header (standard)
- Token verified using server secret key
- Expiration checked (tokens must be refreshed)
- User ID embedded in token claims

### 2. Webhook Security

**Signature Verification:** HMAC-SHA256

**Process:**
1. Razorpay sends webhook with `X-Razorpay-Signature` header
2. App computes `HMAC-SHA256(payload, RAZORPAY_WEBHOOK_SECRET)`
3. App compares computed signature with header signature
4. If match: webhook is authentic (from Razorpay)
5. If no match: webhook rejected

**Strength:** Prevents spoofed payments from attackers

### 3. HTTPS Enforcement

**Not in This File:** HTTPS enforcement typically done at reverse proxy/load balancer level

**Recommendation:** All payment routes should only accept HTTPS requests

### 4. Route-Level Checks

**Ownership Validation:**
```javascript
// Service verifies user owns the payment
const [[payment]] = await db.query(
  'SELECT * FROM payments WHERE id = ? AND user_id = ?',
  [paymentId, userId]
);
```

**Not in Controller:** Prevents users from accessing others' payments

---

## 12. EXAMPLE REQUEST/RESPONSE SEQUENCES

### Sequence 1: Complete Payment Flow

```
Step 1: Create Order
POST /api/payments/create-order
Authorization: Bearer eyJhbGc...
{
  "type": "course_purchase",
  "reference_id": 42,
  "coupon_code": "SAVE50"
}

Response 200:
{
  "data": {
    "payment_id": 789,
    "razorpay_order_id": "order_xyz",
    "razorpay_key": "key_xyz"
  }
}

Step 2: [Frontend redirects to Razorpay gateway]

Step 3: [User enters payment details and completes payment]

Step 4: [Razorpay sends webhook]
POST /api/payments/webhook/razorpay
X-Razorpay-Signature: signature_hash
{
  "event": "payment.captured",
  "payload": { ... }
}

Response 200:
{ "success": true }

Step 5: [Frontend receives payment ID from Razorpay callback and verifies]
POST /api/payments/verify
Authorization: Bearer eyJhbGc...
{
  "razorpay_order_id": "order_xyz",
  "razorpay_payment_id": "pay_abc",
  "razorpay_signature": "signature_hash",
  "payment_db_id": 789
}

Response 200:
{
  "message": "Payment successful.",
  "payment_id": 789
}

Step 6: User is enrolled in course ✓
```

### Sequence 2: View Payment History

```
Request:
GET /api/payments/history?status=success&page=1&per_page=5
Authorization: Bearer eyJhbGc...

Response 200:
{
  "data": {
    "payments": [
      {
        "id": 789,
        "amount": 999.50,
        "status": "success",
        "course_title": "Python 101"
      },
      { ... }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "total_pages": 3
    }
  }
}
```

### Sequence 3: Request Refund

```
Request:
POST /api/payments/refund-request
Authorization: Bearer eyJhbGc...
{
  "payment_id": 789,
  "reason": "Course content not as described"
}

Response 200:
{
  "data": {
    "id": 456,
    "message": "Refund request submitted. We will process it within 3-5 business days."
  }
}
```

---

## 13. NOTES & ASSUMPTIONS

### Design Decisions

1. **No Role-Based Access Control** — Payment routes accessible to any authenticated user
   - Assumption: Students, instructors, and institutes can all make payments
   - If restriction needed, add: `router.use(protect, restrictTo('student'));`

2. **Query Filtering Optional** — History filtering is all optional
   - Users can view entire history or filtered by type/status
   - No pagination defaults to page 1, 10 items

3. **Webhook Before Auth Middleware** — Webhook route defined before `protect` is applied
   - This is intentional (webhook must be public)
   - Good practice to prevent accidental auth on webhook

4. **Controller Handles Validation** — Routes don't validate input, controller does
   - More code reuse but error responses at controller level
   - Alternative: Express validators middleware could validate at route level

### Limitations

1. **No Rate Limiting** — Routes can be hammered with requests
   - Recommendation: Add rate-limiting middleware for payment endpoints

2. **No Request Logging** — No middleware logs payment requests
   - Recommendation: Add audit logging for compliance

3. **No Input Sanitization** — Routes don't sanitize string inputs
   - Assumption: Razorpay signature verification is sufficient for webhook
   - For other routes, service layer handles DB query parameters

### Environment Variables Required

For this router to work, the following must be set:

```env
JWT_SECRET=your_secret_key_here
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
```

---

## 14. SUMMARY

**payments.routes.js** is an Express router that defines 6 HTTP endpoints for payment operations:

1. **POST /webhook/razorpay** — Public webhook (signature-verified)
2. **POST /create-order** — Initiate payment order (JWT auth)
3. **POST /verify** — Verify payment (JWT auth)
4. **GET /history** — View payment history with filters (JWT auth)
5. **POST /refund-request** — Request refund (JWT auth)
6. **GET /refund-status/:id** — Check refund status (JWT auth)

The router applies `protect` middleware to all routes except webhook, enforcing JWT authentication on protected endpoints. Each route delegates to the appropriate controller handler. The design is clean, secure, and follows Express routing best practices.
