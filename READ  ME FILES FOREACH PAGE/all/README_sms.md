# sms.js — SMS Provider Service

> **EduVerse** | `config/sms.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Provider Support](#4-provider-support)
5. [sendSMS Function](#5-sendsms-function)
6. [Provider Implementations](#6-provider-implementations)
7. [Development Mock Mode](#7-development-mock-mode)
8. [SMS Templates](#8-sms-templates)
9. [Bulk SMS](#9-bulk-sms)
10. [Error Handling](#10-error-handling)
11. [Environment Variables](#11-environment-variables)
12. [Usage Examples](#12-usage-examples)
13. [Workflow Diagram](#13-workflow-diagram)
14. [Possible Improvements](#14-possible-improvements)

---

## 1. Overview

`sms.js` is the SMS delivery abstraction layer for EduVerse. It supports two providers (Twilio and MSG91), includes a full library of SMS message templates, bulk sending with rate limiting, and a development mock mode that logs messages without sending them.

**File location:** `config/sms.js`

---

## 2. Purpose & Problem Solved

EduVerse serves both international users (Twilio) and Indian users (MSG91). This module abstracts away provider-specific API differences behind a single `sendSMS(to, body)` interface so the rest of the codebase never needs to know which provider is active.

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `twilio` | npm (optional) | Twilio REST API client |
| `https` | Node.js built-in | MSG91 HTTP API calls (no npm package needed) |

```bash
# For Twilio provider:
npm install twilio
```

MSG91 uses Node's built-in `https` module — no additional package needed.

---

## 4. Provider Support

| Provider | Region | Selection |
|---|---|---|
| Twilio | International | `SMS_PROVIDER=twilio` (default) |
| MSG91 | India | `SMS_PROVIDER=msg91` |

The active provider is determined at module load time from `process.env.SMS_PROVIDER`.

---

## 5. sendSMS Function

```javascript
/**
 * Send an SMS message
 * @param {string} to   - Phone number with country code (e.g. +919876543210)
 * @param {string} body - Message text (keep under 160 chars for single SMS)
 * @returns {object}    - Provider response OR { mock, to, body } OR { error, to }
 */
async function sendSMS(to, body)
```

**Return value examples:**

```javascript
// Success (Twilio)
{ provider: 'twilio', sid: 'SM...', status: 'queued' }

// Success (MSG91)
{ provider: 'msg91', response: '0|abcdef' }

// Mock (development)
{ mock: true, to: '+91...', body: 'Your OTP is 1234...' }

// Missing phone
{ skipped: true, reason: 'no_phone' }

// Failure (never throws)
{ error: 'Authentication failed', to: '+91...' }
```

**`sendSMS` never throws.** All errors are caught internally and returned as `{ error }` objects. This ensures SMS failures never crash the application or block an HTTP response.

---

## 6. Provider Implementations

### Twilio

```javascript
async function sendViaTwilio(to, message) {
  const client = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to:   to,
  });

  return { provider: 'twilio', sid: result.sid, status: result.status };
}
```

**Required credentials:**
- `TWILIO_ACCOUNT_SID` — from your Twilio Console dashboard
- `TWILIO_AUTH_TOKEN` — from your Twilio Console dashboard
- `TWILIO_PHONE` — your Twilio phone number (e.g. `+15005550006`)

### MSG91 (India)

```javascript
async function sendViaMSG91(to, message) {
  // Strips country code prefix for MSG91 API format
  const phone = to.replace(/^\+/, '').replace(/\D/g, '');
  const url = `https://api.msg91.com/api/sendhttp.php?authkey=${apiKey}&mobiles=${phone}&message=${encodeURIComponent(message)}&sender=${senderId}&route=4&country=91`;
  // HTTP GET to MSG91 API
}
```

**Required credentials:**
- `MSG91_API_KEY` — from your MSG91 dashboard
- `MSG91_SENDER_ID` — 6-character sender ID (default: `EDUVRS`)

MSG91 uses **route=4** (transactional route) which has highest delivery priority and bypasses DND for OTPs.

---

## 7. Development Mock Mode

When `NODE_ENV=development` AND `SMS_MOCK` is not explicitly set to `'false'`, all SMS are **only logged** — no API calls are made:

```
📱 [SMS Mock] To: +919876543210 | Message: Your EduVerse OTP is 4321. Valid for 10 minutes...
```

**To send real SMS in development:**
```env
SMS_MOCK=false
```

This prevents accidental SMS sends during development and testing while still exercising the code path.

---

## 8. SMS Templates

All platform SMS messages are defined as template functions. Each is designed to stay **under 160 characters** (single SMS unit).

### `smsTemplates.otp(otp)`
```
Your EduVerse OTP is {otp}. Valid for 10 minutes. Do not share this with anyone.
```

### `smsTemplates.welcome(name, platform)`
```
Welcome to {platform}, {name}! Your account is ready. Start learning at eduverse.com
```

### `smsTemplates.lowAttendance(studentName, percentage, threshold)`
```
Alert: {studentName}'s attendance is {percentage}%, below the required {threshold}%. Please contact the institute.
```

### `smsTemplates.feeReminder(studentName, amount, dueDate, instituteName)`
```
Reminder: Fee of Rs.{amount} for {studentName} at {instituteName} is due on {dueDate}. Pay now on EduVerse.
```

### `smsTemplates.examReminder(examTitle, date, time)`
```
Reminder: "{examTitle}" is scheduled on {date} at {time}. Log in to EduVerse to prepare.
```

### `smsTemplates.assignmentReminder(assignmentTitle, deadline)`
```
Reminder: Assignment "{assignmentTitle}" is due by {deadline}. Submit on EduVerse now.
```

### `smsTemplates.gradePublished(studentName, assignmentTitle, score, maxScore)`
```
Hi {studentName}, your grade for "{assignmentTitle}" is {score}/{maxScore}. View feedback on EduVerse.
```

### `smsTemplates.liveSessionReminder(title, time)`
```
Your live class "{title}" starts at {time}. Join on EduVerse. Don't be late!
```

### `smsTemplates.announcement(instituteName, title)`
```
{instituteName}: New announcement — "{title}". Check EduVerse for details.
```

### `smsTemplates.certificateIssued(studentName, courseName)`
```
Congratulations {studentName}! Your certificate for "{courseName}" is ready. Download on EduVerse.
```

### `smsTemplates.passwordReset(name)`
```
Hi {name}, a password reset was requested for your EduVerse account. If not you, please contact support immediately.
```

---

## 9. Bulk SMS

Send the same message to multiple recipients with rate limiting:

```javascript
/**
 * @param {string[]} numbers  - Array of phone numbers with country codes
 * @param {string}   body     - Message text
 * @param {number}   delayMs  - Delay between sends in ms (default: 100ms)
 * @returns {Array}           - Array of { phone, ...result } objects
 */
async function sendBulkSMS(numbers, body, delayMs = 100)
```

**Example:**
```javascript
const { sendBulkSMS, smsTemplates } = require('./config/sms');

const message = smsTemplates.examReminder('Final Exam', '20 Jan 2025', '10:00 AM');
const results = await sendBulkSMS(allStudentPhones, message, 100);
// Sends to each number with 100ms pause between sends
```

**Rate limiting note:** The 100ms default delay means 10 SMS per second. Adjust based on your provider's rate limit:
- Twilio trial: ~1/second
- Twilio paid: 100+/second (US), varies by country
- MSG91: configured in dashboard

---

## 10. Error Handling

| Scenario | Behavior |
|---|---|
| `to` is null/empty | Returns `{ skipped: true, reason: 'no_phone' }` immediately |
| Twilio credentials not configured | Throws from `getTwilioClient()` → caught by `sendSMS` → returns `{ error }` |
| MSG91 API key not configured | Throws → caught by `sendSMS` → returns `{ error }` |
| Provider API error (network, auth) | Caught → returns `{ error: message, to }` + logged |

**`sendSMS` never throws** — all errors are caught and returned. This is intentional: SMS failures should not crash HTTP requests or block job processors from completing.

If you need to detect failure in a job processor, check the result:
```javascript
const result = await sendSMS(to, message);
if (result.error) {
  console.error('SMS delivery failed:', result.error);
  // Optionally: throw new Error(result.error) to trigger Bull retry
}
```

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMS_PROVIDER` | No | `twilio` | Active SMS provider: `twilio` or `msg91` |
| `SMS_MOCK` | No | — | Set to `false` to send real SMS in development |
| `NODE_ENV` | No | `development` | If `development`, SMS is mocked unless `SMS_MOCK=false` |
| `TWILIO_ACCOUNT_SID` | If Twilio | — | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | If Twilio | — | Twilio auth token |
| `TWILIO_PHONE` | If Twilio | — | Twilio sending phone number |
| `MSG91_API_KEY` | If MSG91 | — | MSG91 API authentication key |
| `MSG91_SENDER_ID` | No | `EDUVRS` | MSG91 6-character sender ID |

---

## 12. Usage Examples

### OTP on login
```javascript
const { sendSMS, smsTemplates } = require('./config/sms');

const otp = generateOTP(); // your OTP generation logic
await sendSMS(user.phone, smsTemplates.otp(otp));
```

### Fee reminder to parents (bulk)
```javascript
const { sendBulkSMS, smsTemplates } = require('./config/sms');

const overdueStudents = await fetchOverdueFees(instituteId);
const numbers = overdueStudents.map(s => s.parent_phone).filter(Boolean);
const message = smsTemplates.feeReminder('your child', overdueAmount, dueDate, institute.name);

await sendBulkSMS(numbers, message, 200); // 200ms delay = 5/sec
```

### Via job queue (recommended)
```javascript
const { queueSMS } = require('../jobs/queue');

await queueSMS({
  to:       user.phone,
  template: 'otp',
  args:     [otp],
});
```

---

## 13. Workflow Diagram

```
sendSMS('+919876543210', 'Your OTP is 4321...')
        │
        ├─ NODE_ENV=development && SMS_MOCK !== 'false'
        │     → console.log('[SMS Mock] ...')
        │     → return { mock: true }
        │
        ├─ SMS_PROVIDER=twilio
        │     → require('twilio')(SID, TOKEN)
        │     → client.messages.create({ body, from, to })
        │     → return { provider: 'twilio', sid, status }
        │
        └─ SMS_PROVIDER=msg91
              → https.get(msg91 API URL)
              → return { provider: 'msg91', response }
```

---

## 14. Possible Improvements

1. **Provider failover** — If Twilio fails, automatically retry with MSG91:
   ```javascript
   try {
     return await sendViaTwilio(to, message);
   } catch {
     return await sendViaMSG91(to, message);
   }
   ```

2. **Delivery receipt webhooks** — Configure Twilio's `statusCallback` URL to track delivered/failed status and update an `sms_logs` table.

3. **DND compliance (India)** — Check TRAI's Do Not Disturb registry before sending promotional SMS. Transactional route (MSG91 route=4) is exempt for OTPs and service messages.

4. **Phone number normalization** — Use a library like `libphonenumber-js` to normalize numbers to E.164 format before sending.

5. **Opt-out management** — Maintain a table of opted-out phone numbers and skip them before sending:
   ```javascript
   const optedOut = await db.query('SELECT phone FROM sms_optouts WHERE phone = ?', [to]);
   if (optedOut.length) return { skipped: true, reason: 'opted_out' };
   ```

6. **SMS cost tracking** — Log message length, provider, and estimated cost to a `sms_logs` table for billing/cost monitoring.
