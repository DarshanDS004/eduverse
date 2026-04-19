# payments.service.js — Documentation

## 1. FILE OVERVIEW

**File Name:** `payments.service.js`  
**File Type:** Business Logic Service Layer  
**Location:** `modules/payments/payments.service.js`  
**Purpose:** Implements all payment processing logic including order creation, payment verification, refund handling, and Razorpay webhook integration. Handles database operations and payment gateway interactions.

---

## 2. RESPONSIBILITY

This service is responsible for:
- **Order Management** — Create orders for courses, materials, fees, and subscriptions with coupon logic
- **Payment Verification** — Cryptographically verify Razorpay payments using HMAC-SHA256
- **Order Fulfillment** — Grant access (enroll students, purchase materials, update fees status)
- **Refund Processing** — Manage refund requests and status tracking
- **Webhook Handling** — Process server-to-server Razorpay events
- **Database Operations** — Execute all SQL queries against payment and related tables
- **Error Handling** — Throw AppError with appropriate status codes and error codes

The service contains **all business logic** and is completely isolated from HTTP concerns (no req/res).

---

## 3. IMPORTS / DEPENDENCIES

```javascript
const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const crypto       = require('crypto');
```

| Import | Type | Purpose |
|--------|------|---------|
| `db` | Module | Database connection pool (likely mysql2/promise) |
| `AppError` | Class | Custom error class with status, message, and error code |
| `crypto` | Built-in Node Module | For HMAC-SHA256 signature verification |

**Lazy-Loaded Dependency:**
```javascript
function getRazorpay() {
  const Razorpay = require('razorpay');
  return new Razorpay({ key_id, key_secret });
}
```

Razorpay SDK loaded only when needed (lazy loading pattern).

---

## 4. CORE LOGIC BREAKDOWN

The service implements a **layered approach**:

```
1. Create Order
   ├─ Validate resource exists (course, material, fee, institute)
   ├─ Check user eligibility
   ├─ Apply coupon discount
   ├─ Create Razorpay order
   └─ Save pending payment record

2. Verify Payment
   ├─ Verify HMAC signature
   ├─ Update payment status to success
   └─ Fulfill payment

3. Fulfill Payment (Private)
   ├─ Enroll in course
   ├─ Grant material access
   ├─ Mark fee as paid
   └─ Activate subscription

4. Get History
   ├─ Build dynamic WHERE clause
   ├─ Paginate results
   └─ Count total records

5. Request Refund
   ├─ Validate payment eligibility
   ├─ Check no existing refund request
   └─ Insert refund record

6. Handle Webhook
   ├─ Verify signature
   ├─ Route by event type
   └─ Update payment status
```

---

## 5. FUNCTIONS / METHODS

### 5.1 `getRazorpay()`

**Purpose:** Lazy-load Razorpay SDK and instantiate with API credentials.

**Returns:** Razorpay instance

**Logic:**
```javascript
function getRazorpay() {
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}
```

**Why Lazy-Load?**
- Razorpay SDK only imported when payment operations occur
- Saves memory if payments module is loaded but unused
- Can be called multiple times (new instance created each time)

**Dependencies:**
- `RAZORPAY_KEY_ID` — Public key from Razorpay dashboard
- `RAZORPAY_KEY_SECRET` — Secret key from Razorpay dashboard

---

### 5.2 `createOrder(userId, type, referenceId, couponCode)`

**Purpose:** Create a Razorpay order and save pending payment record in database.

**Parameters:**
- `userId` (number) — ID of user creating order
- `type` (string) — `course_purchase`, `material`, `fee`, `subscription`
- `referenceId` (number) — ID of resource (course_id, material_id, etc.)
- `couponCode` (string, optional) — Discount code to apply

**Returns:**
```javascript
{
  payment_id:        789,           // Database payment record ID
  razorpay_order_id: "order_xyz",   // Razorpay order ID
  razorpay_key:      "key_xyz",     // Public key for Razorpay SDK
  amount:            999.50,        // Amount in rupees
  amount_paise:      99950,         // Amount in smallest unit (paise)
  currency:          "INR"
}
```

**Throws:** AppError with various codes

**Logic by Type:**

#### Type: `course_purchase`

```javascript
case 'course_purchase': {
  // 1. Fetch course
  const [[course]] = await db.query(
    "SELECT id, title, price, is_free, status FROM courses WHERE id = ? AND status = 'published'",
    [referenceId]
  );
  
  // 2. Validate course exists
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');
  
  // 3. Validate not free
  if (course.is_free) throw new AppError('This course is free. Enroll directly.', 400, 'FREE_COURSE');
  
  // 4. Check not already enrolled
  const [[enrolled]] = await db.query(
    'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
    [referenceId, userId]
  );
  if (enrolled) throw new AppError('You are already enrolled in this course.', 409, 'ALREADY_ENROLLED');
  
  // 5. Set amount
  amount = course.price;
  courseId = course.id;
  
  // 6. Apply coupon if provided
  if (couponCode) {
    const [[coupon]] = await db.query(
      "SELECT * FROM coupons WHERE code = ? AND (course_id = ? OR course_id IS NULL) AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)",
      [couponCode, referenceId]
    );
    if (coupon) {
      if (coupon.discount_type === 'percentage') {
        amount = amount - (amount * coupon.discount_value / 100);
      } else {
        amount = Math.max(0, amount - coupon.discount_value);  // Ensure non-negative
      }
    }
  }
  break;
}
```

**Coupon Logic:**
- Query finds coupons for this specific course OR general coupons (course_id IS NULL)
- Checks coupon hasn't expired
- Checks coupon hasn't exceeded max uses
- Percentage discount: subtract percentage of current amount
- Fixed discount: subtract fixed amount
- Prevents discount from making amount negative

#### Type: `material`

```javascript
case 'material': {
  const [[mat]] = await db.query(
    "SELECT id, price, is_free, status FROM study_materials WHERE id = ? AND status = 'published'",
    [referenceId]
  );
  if (!mat) throw new AppError('Material not found.', 404, 'NOT_FOUND');
  if (mat.is_free) throw new AppError('This material is free.', 400, 'FREE_MATERIAL');
  amount = mat.price;
  break;
}
```

**Similar to course_purchase but:**
- Doesn't check enrollment (materials purchased separately)
- No coupon logic (only courses support coupons)

#### Type: `fee`

```javascript
case 'fee': {
  const [[fee]] = await db.query(
    "SELECT * FROM student_fees WHERE id = ? AND student_id = ? AND status IN ('pending','overdue')",
    [referenceId, userId]
  );
  if (!fee) throw new AppError('Fee record not found.', 404, 'NOT_FOUND');
  amount = fee.amount;
  instId = fee.institute_id;
  break;
}
```

**Only allows payment of:**
- Unpaid fees (status = 'pending')
- Overdue fees (status = 'overdue')
- Not already paid fees

#### Type: `subscription`

```javascript
case 'subscription': {
  const [[inst]] = await db.query('SELECT * FROM institutes WHERE id = ?', [referenceId]);
  if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');
  
  const [[planSetting]] = await db.query(
    "SELECT value FROM platform_settings WHERE `key` = ?",
    [`plan_price_${inst.subscription_plan}`]
  );
  amount = parseFloat(planSetting?.value || '999');
  instId = inst.id;
  break;
}
```

**Gets subscription cost from:**
- `platform_settings` table (key format: `plan_price_basic`, `plan_price_pro`, etc.)
- Defaults to 999 if setting not found

#### Common Steps (All Types)

```javascript
// 1. Validate amount is positive
const amountPaise = Math.round(amount * 100);
if (amountPaise <= 0) throw new AppError('Invalid amount.', 400, 'INVALID_AMOUNT');

// 2. Create Razorpay order
const razorpay = getRazorpay();
const rzpOrder = await razorpay.orders.create({
  amount:   amountPaise,
  currency: currency,
  receipt:  `ev_${type}_${userId}_${Date.now()}`,  // Unique receipt
  notes:    { user_id: userId, type, reference_id: referenceId },
});

// 3. Save pending payment in DB
const [result] = await db.query(`
  INSERT INTO payments
    (user_id, course_id, institute_id, amount, currency, gateway,
     gateway_order_id, type, status)
  VALUES (?, ?, ?, ?, ?, 'razorpay', ?, ?, 'pending')
`, [userId, courseId, instId, amount, currency, rzpOrder.id, type]);

// 4. Return order details
return {
  payment_id:       result.insertId,
  razorpay_order_id: rzpOrder.id,
  razorpay_key:     process.env.RAZORPAY_KEY_ID,
  amount:           amount,
  amount_paise:     amountPaise,
  currency:         currency,
};
```

**Amount in Paise:**
- Razorpay uses smallest currency unit (paise for INR)
- 1 INR = 100 paise
- Math.round() prevents floating point errors

---

### 5.3 `verifyPayment(userId, data)`

**Purpose:** Verify Razorpay payment signature and mark order as successful, then fulfill payment.

**Parameters:**
- `userId` (number) — Authenticated user ID
- `data` (object) — Contains:
  - `razorpay_order_id` — Order ID from Razorpay
  - `razorpay_payment_id` — Payment ID from Razorpay
  - `razorpay_signature` — HMAC signature from frontend
  - `payment_db_id` — Internal database payment ID

**Returns:**
```javascript
{
  message: "Payment successful.",
  payment_id: 789
}
```

**Throws:** AppError

**Logic:**

```javascript
// 1. Extract signature data
const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_db_id } = data;

// 2. Verify signature using HMAC-SHA256
const secret    = process.env.RAZORPAY_KEY_SECRET;
const body      = razorpay_order_id + '|' + razorpay_payment_id;
const expected  = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

if (expected !== razorpay_signature) {
  // Mark payment as failed
  if (payment_db_id) {
    await db.query(
      "UPDATE payments SET status = 'failed', failure_reason = 'Signature mismatch' WHERE id = ?",
      [payment_db_id]
    );
  }
  throw new AppError('Payment verification failed. Invalid signature.', 400, 'INVALID_SIGNATURE');
}

// 3. Fetch payment record
const [[payment]] = await db.query(
  'SELECT * FROM payments WHERE id = ? AND user_id = ?',
  [payment_db_id, userId]
);

if (!payment) throw new AppError('Payment record not found.', 404, 'NOT_FOUND');

// 4. Update payment status
await db.query(`
  UPDATE payments SET
    status = 'success',
    gateway_payment_id = ?,
    gateway_signature = ?
  WHERE id = ?
`, [razorpay_payment_id, razorpay_signature, payment_db_id]);

// 5. Fulfill the purchase
await _fulfillPayment(payment, userId);

return { message: 'Payment successful.', payment_id: payment_db_id };
```

**Signature Verification Details:**

Razorpay uses this signature formula:
```
signature = HMAC-SHA256(order_id|payment_id, webhook_secret)
```

Frontend computes:
```javascript
const crypto = require('crypto');
const body = order_id + '|' + payment_id;
const signature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');
```

Server verifies:
```javascript
// Same computation
const expected = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

if (expected === signature) {
  // Authentic payment from Razorpay ✓
}
```

**Security:**
- Signature proves payment came from Razorpay (only Razorpay knows the secret)
- Signature proves order_id and payment_id haven't been tampered with
- Attacker cannot forge signature without knowing secret

---

### 5.4 `_fulfillPayment(payment, userId)` (Private)

**Purpose:** Grant access/fulfill order based on payment type. Called after successful payment.

**Parameters:**
- `payment` (object) — Payment record from DB with id, type, course_id, etc.
- `userId` (number) — User who made payment

**Returns:** Void (modifies database)

**Logic by Type:**

#### Type: `course_purchase`

```javascript
case 'course_purchase': {
  // 1. Enroll student in course
  await db.query(
    "INSERT IGNORE INTO enrollments (student_id, course_id, payment_id, amount_paid, source) VALUES (?, ?, ?, ?, 'purchased')",
    [userId, payment.course_id, payment.gateway_payment_id, payment.amount]
  );
  
  // 2. Increment enrolled count
  await db.query(
    'UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?',
    [payment.course_id]
  );
  
  // 3. Fetch course title for notification
  const [[course]] = await db.query('SELECT title FROM courses WHERE id = ?', [payment.course_id]);
  
  // 4. Create notification
  await db.query(
    "INSERT INTO notifications (user_id, title, body, type) VALUES (?, 'Enrollment Confirmed', ?, 'payment')",
    [userId, `You are now enrolled in "${course?.title}". Start learning!`]
  );
  break;
}
```

**Note:** `INSERT IGNORE` skips if enrollment already exists (idempotent).

#### Type: `material`

```javascript
case 'material': {
  await db.query(
    "INSERT IGNORE INTO material_purchases (material_id, student_id, amount_paid, payment_id, payment_status) VALUES (?, ?, ?, ?, 'success')",
    [payment.course_id || 0, userId, payment.amount, payment.gateway_payment_id]
  );
  break;
}
```

**Note:** Grants access to study material.

#### Type: `fee`

```javascript
case 'fee': {
  await db.query(
    "UPDATE student_fees SET status = 'paid', paid_at = NOW(), payment_id = ? WHERE student_id = ? AND status IN ('pending','overdue')",
    [payment.gateway_payment_id, userId]
  );
  break;
}
```

**Marks fee as paid with timestamp.**

#### Type: `subscription`

```javascript
case 'subscription': {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  await db.query(
    "UPDATE institutes SET status = 'active', subscription_start = ?, subscription_end = ? WHERE id = ?",
    [now, end, payment.institute_id]
  );
  break;
}
```

**Activates institute subscription for 1 month from now.**

---

### 5.5 `getHistory(userId, filters)`

**Purpose:** Return paginated payment history with optional filters for authenticated user.

**Parameters:**
- `userId` (number) — User ID
- `filters` (object) — {type?, status?, page?, per_page?}

**Returns:**
```javascript
{
  payments: [
    {
      id: 123,
      amount: 999.50,
      currency: "INR",
      type: "course_purchase",
      status: "success",
      gateway_payment_id: "pay_xyz",
      created_at: "2024-01-15T10:30:00Z",
      course_title: "Python 101"
    }
  ],
  pagination: {
    total: 15,
    page: 1,
    per_page: 10,
    total_pages: 2
  }
}
```

**Logic:**

```javascript
// 1. Extract and validate pagination
const pageNum  = Math.max(1, parseInt(page) || 1);
const limitNum = Math.min(50, parseInt(per_page) || 10);
const offset   = (pageNum - 1) * limitNum;

// 2. Build dynamic WHERE clause
const where  = ['p.user_id = ?'];
const params = [userId];
if (type)   { where.push('p.type = ?');   params.push(type); }
if (status) { where.push('p.status = ?'); params.push(status); }
const whereSQL = 'WHERE ' + where.join(' AND ');

// 3. Fetch paginated results
const [rows] = await db.query(`
  SELECT p.id, p.amount, p.currency, p.type, p.status,
         p.gateway_payment_id, p.created_at,
         c.title AS course_title
  FROM payments p
  LEFT JOIN courses c ON c.id = p.course_id
  ${whereSQL}
  ORDER BY p.created_at DESC
  LIMIT ? OFFSET ?
`, [...params, limitNum, offset]);

// 4. Count total records
const [[countRow]] = await db.query(
  `SELECT COUNT(*) AS total FROM payments p ${whereSQL}`, params
);

// 5. Return with pagination metadata
return {
  payments: rows,
  pagination: {
    total:       countRow.total,
    page:        pageNum,
    per_page:    limitNum,
    total_pages: Math.ceil(countRow.total / limitNum),
  },
};
```

**Pagination Limits:**
- Page: minimum 1 (not 0)
- Per page: maximum 50 (prevents huge queries)
- Default per page: 10

**Query Details:**
- `LEFT JOIN courses` because non-course payments have NULL course_title
- Ordered by most recent first
- Uses OFFSET/LIMIT for pagination

---

### 5.6 `requestRefund(userId, paymentId, reason)`

**Purpose:** Create a refund request for a successful payment.

**Parameters:**
- `userId` (number) — User requesting refund
- `paymentId` (number) — Payment ID to refund
- `reason` (string) — Reason for refund

**Returns:**
```javascript
{
  id: 456,
  message: "Refund request submitted. We will process it within 3-5 business days."
}
```

**Throws:** AppError

**Logic:**

```javascript
// 1. Verify payment exists, belongs to user, and was successful
const [[payment]] = await db.query(
  "SELECT * FROM payments WHERE id = ? AND user_id = ? AND status = 'success'",
  [paymentId, userId]
);
if (!payment) throw new AppError('Payment not found or not eligible for refund.', 404, 'NOT_FOUND');

// 2. Check no existing pending refund request
const [[existing]] = await db.query(
  'SELECT id FROM refund_requests WHERE payment_id = ? AND status = "pending"',
  [paymentId]
);
if (existing) throw new AppError('A refund request already exists for this payment.', 409, 'ALREADY_REQUESTED');

// 3. Insert refund request
const [result] = await db.query(
  'INSERT INTO refund_requests (payment_id, student_id, reason) VALUES (?, ?, ?)',
  [paymentId, userId, reason]
);

return { id: result.insertId, message: 'Refund request submitted. We will process it within 3-5 business days.' };
```

**Validation:**
- Payment must exist and belong to user
- Payment must be successful (not pending, failed, etc.)
- Only one pending refund per payment

---

### 5.7 `getRefundStatus(refundId, userId)`

**Purpose:** Retrieve status and details of a refund request.

**Parameters:**
- `refundId` (number) — Refund request ID
- `userId` (number) — User ID (for ownership check)

**Returns:**
```javascript
{
  id: 456,
  reason: "Course not as described",
  status: "pending|approved|rejected",
  admin_note: "Refund approved",
  created_at: "2024-01-15T10:30:00Z",
  resolved_at: "2024-01-18T14:22:00Z",
  amount: 999.50,
  payment_type: "course_purchase"
}
```

**Throws:** AppError if not found

**Logic:**

```javascript
const [[refund]] = await db.query(`
  SELECT rr.id, rr.reason, rr.status, rr.admin_note, rr.created_at, rr.resolved_at,
         p.amount, p.type AS payment_type
  FROM refund_requests rr
  JOIN payments p ON p.id = rr.payment_id
  WHERE rr.id = ? AND rr.student_id = ?
`, [refundId, userId]);

if (!refund) throw new AppError('Refund request not found.', 404, 'NOT_FOUND');
return refund;
```

**JOIN Logic:** Links refund request to payment to get amount and payment type.

---

### 5.8 `handleWebhook(body, signature)`

**Purpose:** Process server-to-server webhook events from Razorpay.

**Parameters:**
- `body` (object) — Entire webhook payload from Razorpay
- `signature` (string) — Webhook signature from X-Razorpay-Signature header

**Returns:** Void (updates database if valid)

**Throws:** Error if signature invalid

**Logic:**

```javascript
// 1. Verify webhook signature
const secret   = process.env.RAZORPAY_WEBHOOK_SECRET;
const payload  = JSON.stringify(body);
const expected = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (expected !== signature) {
  throw new Error('Invalid webhook signature.');
}

// 2. Route by event type
const event = body.event;

if (event === 'payment.captured') {
  const payment = body.payload.payment.entity;
  const orderId = payment.order_id;

  // Find our payment record by Razorpay order ID
  const [[dbPayment]] = await db.query(
    'SELECT * FROM payments WHERE gateway_order_id = ? AND status = "pending"',
    [orderId]
  );

  if (dbPayment) {
    // Update payment status
    await db.query(
      "UPDATE payments SET status = 'success', gateway_payment_id = ? WHERE id = ?",
      [payment.id, dbPayment.id]
    );
    // Fulfill the order
    await _fulfillPayment(dbPayment, dbPayment.user_id);
  }
}

if (event === 'payment.failed') {
  const payment = body.payload.payment.entity;
  await db.query(
    "UPDATE payments SET status = 'failed', failure_reason = ? WHERE gateway_order_id = ?",
    [payment.error_description || 'Payment failed', payment.order_id]
  );
}
```

**Events Handled:**

| Event | Meaning | Action |
|-------|---------|--------|
| `payment.captured` | Payment succeeded | Mark success, fulfill order |
| `payment.failed` | Payment failed | Mark failed, store error reason |

**Webhook Signature Format:**

Razorpay computes:
```
signature = HMAC-SHA256(JSON.stringify(payload), webhook_secret)
```

Server verifies by recomputing and comparing.

**Why Webhook Security Matters:**
- Prevents attackers from spoofing payment events
- Without signature verification, attacker could claim payments succeeded

---

## 6. DATABASE SCHEMA DEPENDENCIES

This service assumes these tables exist:

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `courses` | id, price, is_free, status, enrolled_count, title | Course catalog |
| `study_materials` | id, price, is_free, status | Study materials |
| `student_fees` | id, student_id, institute_id, amount, status | Student fees |
| `institutes` | id, subscription_plan | Institute directory |
| `platform_settings` | key, value | Global settings (subscription prices) |
| `coupons` | code, course_id, discount_type, discount_value, expires_at, max_uses, used_count | Discount codes |
| `enrollments` | student_id, course_id, payment_id, amount_paid, source | Course enrollments |
| `payments` | id, user_id, course_id, institute_id, amount, currency, gateway, gateway_order_id, gateway_payment_id, gateway_signature, type, status, failure_reason, created_at | Payment records |
| `material_purchases` | material_id, student_id, amount_paid, payment_id, payment_status | Material access |
| `student_fees` | status, paid_at, payment_id | Fee payment tracking |
| `institutes` | status, subscription_start, subscription_end | Subscription tracking |
| `notifications` | user_id, title, body, type | User notifications |
| `refund_requests` | id, payment_id, student_id, reason, status, admin_note, created_at, resolved_at | Refund management |

---

## 7. ERROR HANDLING STRATEGY

### Error Types & Codes

| Code | HTTP | Meaning | Example |
|------|------|---------|---------|
| NOT_FOUND | 404 | Resource doesn't exist | Course not found |
| FREE_COURSE | 400 | Can't pay for free course | "This course is free" |
| FREE_MATERIAL | 400 | Can't pay for free material | "This material is free" |
| ALREADY_ENROLLED | 409 | User already has access | "Already enrolled in course" |
| INVALID_AMOUNT | 400 | Amount ≤ 0 | Coupon discount too large |
| ALREADY_REQUESTED | 409 | Duplicate refund request | "Refund already requested" |
| INVALID_SIGNATURE | 400 | Payment signature invalid | Payment tampering detected |

### Throw Pattern

```javascript
throw new AppError(
  'Human-readable message',
  httpStatusCode,
  'ERROR_CODE'
);
```

### Signature Mismatch Handling

When payment verification fails:
```javascript
if (expected !== razorpay_signature) {
  // Mark payment as failed BEFORE throwing
  if (payment_db_id) {
    await db.query(
      "UPDATE payments SET status = 'failed', failure_reason = 'Signature mismatch' WHERE id = ?",
      [payment_db_id]
    );
  }
  throw new AppError('Payment verification failed. Invalid signature.', 400, 'INVALID_SIGNATURE');
}
```

**Pattern:** Update database before throwing so error is recorded.

---

## 8. CONCURRENCY & RACE CONDITIONS

### Potential Issue: Duplicate Enrollments

**Scenario:**
```
User clicks "Pay" twice quickly
  ↓
Two createOrder requests → Two payments created
  ↓
Two verify requests → Both try to enroll student
```

**Protection:**
```javascript
INSERT IGNORE INTO enrollments (student_id, course_id, ...)
```

`INSERT IGNORE` or `INSERT ... ON DUPLICATE KEY UPDATE` makes insert idempotent.

### Potential Issue: Race Between Verify and Webhook

**Scenario:**
```
Frontend calls verify (signature verification)
  ↓
Meanwhile, Razorpay sends webhook
  ↓
Both call _fulfillPayment simultaneously
```

**Current Protection:** Limited
- Payment status updated first (prevents double fulfillment)
- But notifications might be sent twice
- Recommendation: Add database transaction locks

### Potential Issue: Coupon Used Count Race

**Scenario:**
```
Two users apply same coupon simultaneously
  ↓
Both check max_uses limit (passes for both)
  ↓
Both claim coupon (overcounts uses)
```

**Current Protection:** None visible in code
- Recommendation: Use UPDATE with WHERE to increment used_count atomically

---

## 9. ENVIRONMENT VARIABLES REQUIRED

```env
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx        # Public key
RAZORPAY_KEY_SECRET=xxxxxxxx              # Secret key for orders
RAZORPAY_WEBHOOK_SECRET=xxxxxxxx          # Secret key for webhooks
```

**Note:** Different secret keys for orders vs webhooks (common Razorpay pattern).

---

## 10. EXAMPLE USAGE

### Complete Course Purchase Flow

```javascript
// 1. Create order
const orderData = await createOrder(userId=100, 'course_purchase', courseId=42, 'SAVE50');
// Returns: { payment_id: 789, razorpay_order_id: "order_xyz", ... }

// 2. [Frontend proceeds to Razorpay payment gateway]

// 3. [Razorpay processes payment and sends webhook]
await handleWebhook(
  { event: 'payment.captured', payload: { ... } },
  'signature_xyz'
);
// Result: Payment marked success, student enrolled in course

// 4. [Frontend also verifies payment from Razorpay callback]
const result = await verifyPayment(userId=100, {
  razorpay_order_id: "order_xyz",
  razorpay_payment_id: "pay_abc",
  razorpay_signature: "sig_xyz",
  payment_db_id: 789
});
// Returns: { message: "Payment successful.", payment_id: 789 }

// 5. Get payment history
const history = await getHistory(userId=100, { status: 'success', page: 1 });
// Returns: { payments: [...], pagination: {...} }

// 6. Request refund
const refund = await requestRefund(userId=100, paymentId=789, 'Course not useful');
// Returns: { id: 456, message: "Refund request submitted..." }

// 7. Check refund status
const status = await getRefundStatus(refundId=456, userId=100);
// Returns: { id: 456, status: 'pending', reason: '...', ... }
```

---

## 11. SUMMARY

**payments.service.js** is the business logic layer for all payment operations in EduVerse. It implements:

1. **Order Creation** — Supports courses, materials, fees, and subscriptions with coupon logic
2. **Payment Verification** — HMAC-SHA256 signature verification for security
3. **Order Fulfillment** — Grants access (enrollments, purchases, fee updates, subscriptions)
4. **Refund Management** — Request and status tracking
5. **Webhook Processing** — Server-to-server event handling from Razorpay

The service is **stateless, database-driven, and completely isolated from HTTP concerns**. All error handling uses AppError with appropriate codes. The implementation is robust with validation at every step, though concurrency protection could be strengthened with database transactions.
