# payments.controller.js — Documentation

## 1. FILE OVERVIEW

**File Name:** `payments.controller.js`  
**File Type:** Express Controller  
**Location:** `modules/payments/payments.controller.js`  
**Purpose:** Handles incoming HTTP requests related to payment operations in the EduVerse platform. Acts as the intermediary between HTTP endpoints and the payment business logic service layer.

---

## 2. RESPONSIBILITY

This controller is responsible for:
- **Request Validation**: Validates incoming request bodies for required fields
- **Response Formatting**: Structures all API responses using shared error/success handlers
- **Request Delegation**: Routes requests to the payment service layer (`payments.service`)
- **Error Propagation**: Passes errors to Express error middleware via `next(e)`
- **User Context Management**: Extracts and uses authenticated user ID from `req.user.id`

The controller serves as the **HTTP request handler** and does NOT contain business logic—all actual payment processing happens in the service layer.

---

## 3. IMPORTS / DEPENDENCIES

```javascript
const svc = require('./payments.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');
```

| Import | Type | Purpose |
|--------|------|---------|
| `./payments.service` | Module | Business logic for payment processing (Razorpay integration, DB queries) |
| `sendSuccess` | Function | Utility to format successful HTTP responses (200/201 status) |
| `sendError` | Function | Utility to format error HTTP responses (4xx/5xx status) with error codes |

---

## 4. CORE LOGIC BREAKDOWN

The controller contains **6 async route handler functions** that follow this pattern:

1. **Extract request data** (body, params, query)
2. **Validate required fields** (using `sendError` if missing)
3. **Call service layer** with user context
4. **Format response** using `sendSuccess` or `sendError`
5. **Pass errors to middleware** via `next(e)`

All handlers use try-catch to ensure errors are caught and propagated to Express error middleware.

---

## 5. FUNCTIONS / METHODS

### 5.1 `createOrder(req, res, next)`

**Purpose:** Initiates a payment order for courses, study materials, fees, or institute subscriptions.

**Parameters:**
- `req.body.type` (string) — Type of payment: `course_purchase`, `material`, `fee`, `subscription`
- `req.body.reference_id` (number) — ID of the resource being purchased (course_id, material_id, etc.)
- `req.body.coupon_code` (string, optional) — Discount coupon code
- `req.user.id` (number) — Authenticated user ID from JWT token

**Returns:** JSON response with:
```json
{
  "success": true,
  "message": "Order created.",
  "data": {
    "payment_id": 123,
    "razorpay_order_id": "order_xyz",
    "razorpay_key": "key_xyz",
    "amount": 999.50,
    "amount_paise": 99950,
    "currency": "INR"
  }
}
```

**Logic:**
1. Validates that `type` and `reference_id` are provided
2. If missing, returns 400 error with code `MISSING_FIELDS`
3. Calls `svc.createOrder(userId, type, referenceId, couponCode)`
4. Service returns order details with Razorpay order ID
5. Response sent with 200 status code

**Validation Rules:**
- `type` — Required
- `reference_id` — Required
- `coupon_code` — Optional

---

### 5.2 `verifyPayment(req, res, next)`

**Purpose:** Verifies Razorpay payment signature after frontend callback and marks payment as successful.

**Parameters:**
- `req.body.razorpay_order_id` (string) — Razorpay order ID
- `req.body.razorpay_payment_id` (string) — Razorpay payment ID
- `req.body.razorpay_signature` (string) — HMAC-SHA256 signature from Razorpay
- `req.body.payment_db_id` (number) — Internal database payment record ID
- `req.user.id` (number) — Authenticated user ID

**Returns:** JSON response:
```json
{
  "success": true,
  "message": "Payment verified.",
  "data": {
    "message": "Payment successful.",
    "payment_id": 123
  }
}
```

**Logic:**
1. Extracts signature data from request
2. Calls `svc.verifyPayment()` with all payment details
3. Service cryptographically verifies the signature
4. If valid, service updates DB and fulfills the order
5. Returns success response with payment ID
6. If error occurs, service throws AppError (caught by try-catch)

**Error Handling:**
- Invalid signatures throw `AppError` with code `INVALID_SIGNATURE`
- Payment record not found throws 404 error
- Errors propagated via `next(e)`

---

### 5.3 `getHistory(req, res, next)`

**Purpose:** Retrieves paginated payment history for the authenticated user.

**Parameters:**
- `req.query.type` (string, optional) — Filter by payment type (`course_purchase`, `material`, `fee`, `subscription`)
- `req.query.status` (string, optional) — Filter by status (`pending`, `success`, `failed`)
- `req.query.page` (number, optional) — Page number (default: 1)
- `req.query.per_page` (number, optional) — Items per page (default: 10, max: 50)
- `req.user.id` (number) — Authenticated user ID

**Returns:** JSON response:
```json
{
  "success": true,
  "message": "History loaded.",
  "data": {
    "payments": [
      {
        "id": 123,
        "amount": 999.50,
        "currency": "INR",
        "type": "course_purchase",
        "status": "success",
        "gateway_payment_id": "pay_xyz",
        "created_at": "2024-01-15T10:30:00Z",
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

**Logic:**
1. Extracts query filters (type, status, pagination)
2. Calls `svc.getHistory(userId, filters)`
3. Service applies filters and returns paginated results
4. Includes LEFT JOIN with courses table for course titles
5. Returns payments array and pagination metadata

---

### 5.4 `requestRefund(req, res, next)`

**Purpose:** Initiates a refund request for a previously successful payment.

**Parameters:**
- `req.body.payment_id` (number) — ID of payment to refund
- `req.body.reason` (string) — Reason for refund request
- `req.user.id` (number) — Authenticated user ID

**Returns:** JSON response:
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

**Logic:**
1. Validates that `payment_id` and `reason` are provided
2. Returns 400 error if either is missing
3. Calls `svc.requestRefund(userId, paymentId, reason)`
4. Service creates refund request record in DB
5. Returns refund request ID

**Validation Rules:**
- `payment_id` — Required, must exist and belong to user
- `reason` — Required, non-empty string

---

### 5.5 `getRefundStatus(req, res, next)`

**Purpose:** Retrieves the current status of a refund request.

**Parameters:**
- `req.params.id` (number) — Refund request ID
- `req.user.id` (number) — Authenticated user ID

**Returns:** JSON response:
```json
{
  "success": true,
  "message": "Refund status loaded.",
  "data": {
    "id": 456,
    "reason": "Course not as described",
    "status": "pending",
    "admin_note": null,
    "created_at": "2024-01-15T10:30:00Z",
    "resolved_at": null,
    "amount": 999.50,
    "payment_type": "course_purchase"
  }
}
```

**Logic:**
1. Extracts refund request ID from URL parameter
2. Calls `svc.getRefundStatus(refundId, userId)`
3. Service verifies refund belongs to user
4. Returns refund details with payment amount and type
5. If not found, throws 404 error

**Statuses:** `pending`, `approved`, `rejected`

---

### 5.6 `razorpayWebhook(req, res, next)`

**Purpose:** Handles server-to-server webhook events from Razorpay (e.g., payment captured, payment failed).

**Parameters:**
- `req.body` — Entire Razorpay webhook payload
- `req.headers['x-razorpay-signature']` — Webhook signature for verification

**Returns:** JSON response:
```json
{ "success": true }
// or
{ "success": false }
```

**Logic:**
1. Extracts webhook payload and signature from request
2. Calls `svc.handleWebhook(body, signature)`
3. Service verifies webhook signature using HMAC-SHA256
4. If valid, processes webhook event (e.g., marks payment as success)
5. Returns 200 with `{ success: true }`
6. If error, logs error and returns 400 with `{ success: false }`

**Key Difference:**
- **No authentication required** — Webhook is verified by signature, not JWT
- **No `sendSuccess`/`sendError`** — Uses direct `res.json()` and `res.status()`
- **Only 2xx or 400 responses** — Razorpay doesn't understand custom error codes

**Events Handled:**
- `payment.captured` — Mark payment as success and fulfill order
- `payment.failed` — Mark payment as failed with reason

---

## 6. API ROLE

### Route Mapping

This controller is used by **payments.routes.js**:

```javascript
router.post('/webhook/razorpay', ctrl.razorpayWebhook);  // PUBLIC (no auth)
router.post('/create-order', ctrl.createOrder);           // PROTECTED
router.post('/verify', ctrl.verifyPayment);              // PROTECTED
router.get('/history', ctrl.getHistory);                 // PROTECTED
router.post('/refund-request', ctrl.requestRefund);      // PROTECTED
router.get('/refund-status/:id', ctrl.getRefundStatus);  // PROTECTED
```

### Request/Response Pattern

**Protected Routes:**
- Require `protect` middleware (JWT authentication)
- Extract user ID from `req.user.id`
- Return standardized JSON with `success`, `message`, `data`

**Webhook Route:**
- No auth required (public endpoint)
- Verified using cryptographic signature
- Returns simple `{ success: true/false }`

### HTTP Status Codes Used

- `200` — Successful operation
- `400` — Bad request (missing fields, invalid signature)
- `404` — Resource not found (payment, refund request)
- `409` — Conflict (already enrolled, existing refund request)

---

## 7. DATA FLOW

### Inbound Flow
```
HTTP Request
    ↓
Controller receives req (body, params, query)
    ↓
Validate required fields
    ↓
Extract user ID from req.user
    ↓
Call service layer with data
```

### Outbound Flow
```
Service returns data or throws error
    ↓
sendSuccess() or sendError() formats response
    ↓
res.json() sends to client
```

### Example: Create Order Flow
```
POST /payments/create-order
Body: { type: "course_purchase", reference_id: 5 }
    ↓
createOrder() validates type and reference_id
    ↓
svc.createOrder(userId, type, referenceId, couponCode)
    ↓
Service queries course, applies coupon, creates Razorpay order
    ↓
Returns { payment_id, razorpay_order_id, amount, ... }
    ↓
sendSuccess(res, 200, "Order created.", data)
    ↓
Client receives order data to proceed with payment
```

---

## 8. CONNECTIONS

### Calls These Files
- **payments.service.js** — All business logic and DB operations

### Called By
- **payments.routes.js** — Routes requests to these handlers
- **Express app** — Via mounted router middleware

### Related Files (in EduVerse)
- `auth/auth.middleware.js` — Provides `protect` and `restrictTo` middleware
- `shared/errorHandler.js` — Provides `sendSuccess` and `sendError` utilities
- `config/db.js` — Database connection (used indirectly via service)

---

## 9. MIDDLEWARE / AUTH

### Authentication (Protected Routes)

```javascript
router.use(protect);  // Verifies JWT token
```

The `protect` middleware:
- Validates JWT from `Authorization: Bearer <token>` header
- Adds `req.user` object with user ID and role
- Throws error if token is invalid or missing

### Role Restrictions (Not Applied Here)

The `restrictTo` middleware is available but NOT used on payment routes. This means:
- Students can access payment routes
- Instructors/institutes can also create orders
- Superadmins can also create orders
- No explicit role check in this controller

### Webhook Exception

```javascript
router.post('/webhook/razorpay', ctrl.razorpayWebhook);  // Before router.use(protect)
```

Webhook route is defined BEFORE the `protect` middleware, so it's public. Instead, it's verified by:
1. Checking `x-razorpay-signature` header
2. Computing HMAC-SHA256 of body with `RAZORPAY_WEBHOOK_SECRET`
3. Comparing computed signature with provided signature

---

## 10. ERROR HANDLING

### Try-Catch Pattern

Every handler uses try-catch to ensure errors don't crash the server:

```javascript
async function createOrder(req, res, next) {
  try {
    // Validation and processing
    return sendSuccess(res, 200, 'Order created.', data);
  } catch (e) {
    next(e);  // Pass to Express error middleware
  }
}
```

### Error Types Handled

**1. Validation Errors** (Returned Directly)
```javascript
if (!type || !reference_id)
  return sendError(res, 400, 'type and reference_id are required.', 'MISSING_FIELDS');
```

**2. Service Errors** (Thrown by Service, Caught by Try-Catch)
```javascript
// In service:
throw new AppError('Course not found.', 404, 'NOT_FOUND');

// Caught here:
catch (e) { next(e); }

// Express error middleware formats response
```

### Error Response Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "type and reference_id are required.",
  "code": "MISSING_FIELDS"
}
```

---

## 11. EXAMPLE USAGE

### Example 1: Create a Course Purchase Order

**Request:**
```bash
POST /payments/create-order
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "type": "course_purchase",
  "reference_id": 42,
  "coupon_code": "SAVE50"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order created.",
  "data": {
    "payment_id": 789,
    "razorpay_order_id": "order_IluGWxBm9U8zJ8",
    "razorpay_key": "rzp_live_xxxxxxxx",
    "amount": 499.50,
    "amount_paise": 49950,
    "currency": "INR"
  }
}
```

### Example 2: Verify Payment After Razorpay Callback

**Request:**
```bash
POST /payments/verify
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "razorpay_order_id": "order_IluGWxBm9U8zJ8",
  "razorpay_payment_id": "pay_IluHHEbrMY1e2u",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a",
  "payment_db_id": 789
}
```

**Response (200 OK):**
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

### Example 3: Get Payment History

**Request:**
```bash
GET /payments/history?type=course_purchase&status=success&page=1&per_page=10
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "History loaded.",
  "data": {
    "payments": [
      {
        "id": 789,
        "amount": 499.50,
        "currency": "INR",
        "type": "course_purchase",
        "status": "success",
        "gateway_payment_id": "pay_IluHHEbrMY1e2u",
        "created_at": "2024-01-20T15:30:45Z",
        "course_title": "Advanced Python"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "per_page": 10,
      "total_pages": 1
    }
  }
}
```

### Example 4: Request Refund

**Request:**
```bash
POST /payments/refund-request
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "payment_id": 789,
  "reason": "Course content doesn't match description"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Refund requested.",
  "data": {
    "id": 123,
    "message": "Refund request submitted. We will process it within 3-5 business days."
  }
}
```

### Example 5: Razorpay Webhook (Server-to-Server)

**Request (from Razorpay servers):**
```bash
POST /payments/webhook/razorpay
Content-Type: application/json
X-Razorpay-Signature: abcd1234...

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

**Response (200 OK):**
```json
{ "success": true }
```

---

## 12. EDGE CASES / NOTES

### Edge Case 1: Duplicate Webhook Delivery
- **Issue:** Razorpay may send the same webhook multiple times
- **Current Handling:** Service checks if payment is already marked as success before updating
- **Idempotent:** Multiple identical webhook calls are safe

### Edge Case 2: User Tries to Verify Someone Else's Payment

**Scenario:**
```javascript
// User A tries to verify User B's payment
verifyPayment(userId=100, payment_db_id=789)  // 789 belongs to userId=50

// Service checks:
const [[payment]] = await db.query(
  'SELECT * FROM payments WHERE id = ? AND user_id = ?',
  [payment_db_id, userId]  // 789, 100
);

if (!payment) throw new AppError('Payment record not found.', 404, 'NOT_FOUND');
```

**Result:** Fails with 404 — payment ownership verified ✓

### Edge Case 3: Coupon Code Applied to Free Course

**Service logic:**
```javascript
if (coupon) {
  // Apply coupon
  amount = amount - (amount * coupon.discount_value / 100);
}
```

**Issue:** If course is free (`is_free=1`), `createOrder()` throws error before coupon is applied:
```javascript
if (course.is_free)
  throw new AppError('This course is free. Enroll directly.', 400, 'FREE_COURSE');
```

**Behavior:** Free courses cannot be purchased (correct) ✓

### Edge Case 4: Refund Request for Pending Payment

**Scenario:**
```javascript
// Payment status = 'pending' (not yet verified)
requestRefund(userId, payment_id=789, reason="...")

// Service checks:
const [[payment]] = await db.query(
  "SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = 'success'",
  [payment_id, userId]
);

if (!payment) throw new AppError('Payment not found or not eligible for refund.', 404, 'NOT_FOUND');
```

**Result:** Only successful payments can be refunded ✓

### Edge Case 5: Multiple Refund Requests for Same Payment

**Service checks:**
```javascript
const [[existing]] = await db.query(
  'SELECT id FROM refund_requests WHERE payment_id = ? AND status = "pending"',
  [paymentId]
);

if (existing) 
  throw new AppError('A refund request already exists for this payment.', 409, 'ALREADY_REQUESTED');
```

**Result:** Can't create duplicate pending refund requests ✓

### Important Notes

1. **No Amount Validation in Controller**: Controller doesn't validate that order amount is positive—service layer handles this
2. **Currency Hardcoded**: All amounts in INR (Indian Rupees), no currency conversion logic
3. **Webhook Security**: Webhook security entirely depends on `RAZORPAY_WEBHOOK_SECRET` environment variable
4. **No Rate Limiting**: Controller doesn't implement rate limiting on payment endpoints
5. **Async/Await**: All handlers are async because service layer uses async DB queries

---

## 13. SUMMARY

**payments.controller.js** is an Express controller that handles 6 HTTP endpoints for payment operations in EduVerse:

1. **createOrder** — Initiates payment for courses, materials, fees, or subscriptions
2. **verifyPayment** — Confirms Razorpay payment signature and fulfills order
3. **getHistory** — Returns paginated payment history with filtering
4. **requestRefund** — Creates refund request for successful payments
5. **getRefundStatus** — Retrieves status of pending/resolved refunds
6. **razorpayWebhook** — Processes server-to-server payment events from Razorpay

All handlers validate input, delegate to the service layer, and format responses using shared utilities. Authentication is enforced on all routes except the webhook, which is verified by HMAC signature instead. Error handling follows Express conventions with try-catch and `next(e)` propagation.

The controller is lightweight and focuses on **HTTP request/response handling**—all business logic resides in the service layer.
