# sms.job.js — SMS Job Processor

> **EduVerse** | `jobs/sms.job.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Job Data Shape](#4-job-data-shape)
5. [Processing Logic](#5-processing-logic)
6. [Template Support](#6-template-support)
7. [Concurrency](#7-concurrency)
8. [Error Handling](#8-error-handling)
9. [Environment Variables](#9-environment-variables)
10. [Usage Examples](#10-usage-examples)
11. [Workflow Diagram](#11-workflow-diagram)
12. [Possible Improvements](#12-possible-improvements)

---

## 1. Overview

`sms.job.js` is a **Bull queue job processor** that handles all outbound SMS delivery for the EduVerse platform. It is registered against the `smsQueue` and processes up to **10 SMS messages concurrently**.

**File location:** `jobs/sms.job.js`

---

## 2. Purpose & Problem Solved

SMS delivery via Twilio or MSG91 involves HTTP API calls (50ms–500ms per message). Processing SMS synchronously in route handlers would delay HTTP responses. This processor handles all SMS delivery asynchronously, decoupled from the HTTP cycle.

**Use cases:**
- OTP verification on login/registration
- Low attendance alerts to students and parents
- Fee payment reminders
- Exam reminders (24 hours before)
- Assignment deadline reminders
- Grade published notifications
- Welcome messages after registration

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `../config/sms` | Internal | `sendSMS()` function + `smsTemplates` object |

No external npm packages are directly required by this file — all provider logic lives in `config/sms.js`.

---

## 4. Job Data Shape

```javascript
{
  to:       string,   // REQUIRED — phone number with country code (e.g. +919876543210)
  message:  string,   // SMS text (used if no template)
  template: string,   // Template key from smsTemplates (e.g. 'otp', 'feeReminder')
  args:     Array,    // Arguments passed to the template function
}
```

**Either `template` OR `message` must be provided. `to` is always required.**

---

## 5. Processing Logic

```javascript
// Simplified processor logic:

1. Validate that `to` field exists → throw if missing

2. If `template` is provided AND exists in smsTemplates:
   finalMessage = smsTemplates[template](...args);

3. Else:
   finalMessage = message;

4. Validate finalMessage is present → throw if missing

5. result = await sendSMS(to, finalMessage)

6. Return { sent: true, to, result }
```

---

## 6. Template Support

The processor uses the template library from `config/sms.js`. All templates are designed to be under 160 characters (single SMS).

| Template Key | Arguments | Example Output |
|---|---|---|
| `otp` | `(otp)` | `Your EduVerse OTP is 4321. Valid for 10 minutes...` |
| `welcome` | `(name, platform)` | `Welcome to EduVerse, Alice! Your account is ready...` |
| `lowAttendance` | `(studentName, percentage, threshold)` | `Alert: Alice's attendance is 65%, below the required 75%...` |
| `feeReminder` | `(studentName, amount, dueDate, instituteName)` | `Reminder: Fee of Rs.5000 for Alice at ABC School is due on...` |
| `examReminder` | `(examTitle, date, time)` | `Reminder: "Math Finals" is scheduled on 15 Jan at 10:00 AM...` |
| `assignmentReminder` | `(assignmentTitle, deadline)` | `Reminder: Assignment "Chapter 5 Problems" is due by...` |
| `gradePublished` | `(studentName, assignmentTitle, score, maxScore)` | `Hi Alice, your grade for "Quiz 3" is 45/50...` |
| `liveSessionReminder` | `(title, time)` | `Your live class "Physics Lab" starts at 3:00 PM...` |
| `announcement` | `(instituteName, title)` | `ABC School: New announcement — "Holiday Notice"...` |
| `certificateIssued` | `(studentName, courseName)` | `Congratulations Alice! Your certificate for "Python 101" is ready...` |
| `passwordReset` | `(name)` | `Hi Alice, a password reset was requested for your EduVerse account...` |

**Using a template:**
```javascript
await queueSMS({
  to:       '+919876543210',
  template: 'otp',
  args:     ['4321'],
});
```

**Using raw message:**
```javascript
await queueSMS({
  to:      '+919876543210',
  message: 'Your custom message here.',
});
```

---

## 7. Concurrency

The processor is registered with a concurrency of **10**:

```javascript
queue.process(10, async function (job) { ... });
```

High concurrency (10) is appropriate for SMS because:
- SMS API calls are fast (network I/O, not CPU-bound)
- Twilio and MSG91 support high concurrent request throughput
- OTP delivery especially benefits from low latency (users expect near-instant OTPs)

For bulk SMS scenarios, `sendBulkSMS()` in `config/sms.js` handles rate-limited serial sending with a configurable delay between messages.

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| `to` field missing | Throws `Error('SMS job missing "to" field.')` → Bull retries |
| Template key not found | Falls through to raw `message` check |
| No message content after template resolution | Throws `Error('SMS job has no message content.')` → Bull retries |
| `sendSMS()` fails (provider error) | `sendSMS()` itself never throws (returns `{ error }`) — job completes with error in result |

> **Important:** `sendSMS()` in `config/sms.js` catches all provider errors and returns `{ error, to }` instead of throwing. This means SMS delivery failures do not trigger Bull retries. If retry-on-SMS-failure is needed, the processor should check the result and throw explicitly.

**Retry policy (inherited from queue.js):**
- Max attempts: **3**
- Backoff: **exponential**, 2s → 4s → 8s

---

## 9. Environment Variables

SMS job itself uses no env vars directly. All SMS configuration is in `config/sms.js`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `SMS_PROVIDER` | No | `twilio` | `twilio` or `msg91` |
| `SMS_MOCK` | No | — | Set to `false` to send real SMS in development |
| `NODE_ENV` | No | `development` | In `development`, SMS is mocked unless `SMS_MOCK=false` |
| `TWILIO_ACCOUNT_SID` | Conditional | — | Required if `SMS_PROVIDER=twilio` |
| `TWILIO_AUTH_TOKEN` | Conditional | — | Required if `SMS_PROVIDER=twilio` |
| `TWILIO_PHONE` | Conditional | — | Required if `SMS_PROVIDER=twilio` |
| `MSG91_API_KEY` | Conditional | — | Required if `SMS_PROVIDER=msg91` |
| `MSG91_SENDER_ID` | No | `EDUVRS` | Sender ID for MSG91 |
| `REDIS_HOST` | No | — | Required for async; without it, runs inline |

---

## 10. Usage Examples

### OTP Verification
```javascript
await queueSMS({
  to:       user.phone,
  template: 'otp',
  args:     [generatedOtp],
});
```

### Low Attendance Alert
```javascript
await queueSMS({
  to:       student.phone,
  template: 'lowAttendance',
  args:     [student.name, attendancePercent, requiredThreshold],
});
```

### Fee Reminder
```javascript
await queueSMS({
  to:       parent.phone,
  template: 'feeReminder',
  args:     [student.name, feeAmount, dueDate, institute.name],
});
```

### Bulk Exam Reminder (all students in a class)
```javascript
const { sendBulkSMS, smsTemplates } = require('../config/sms');
const message = smsTemplates.examReminder('Math Finals', '15 Jan 2025', '10:00 AM');
await sendBulkSMS(studentPhoneNumbers, message, 100); // 100ms delay between sends
```

---

## 11. Workflow Diagram

```
[Route Handler / Controller]
        │
        ▼
queueSMS({ to, template, args })
        │
        ▼
[queue.js] smsQueue.add(data) → Redis (Bull)
        │
        ▼  (async — HTTP response already sent)
[sms.job.js processor]
  1. Validate 'to'
  2. Render template (if provided) → finalMessage
  3. sendSMS(to, finalMessage)
     ├─ NODE_ENV=development → log to console (mock)
     ├─ SMS_PROVIDER=twilio  → Twilio REST API
     └─ SMS_PROVIDER=msg91   → MSG91 HTTP API
        │
        ▼
Return { sent: true, to, result }
```

---

## 12. Possible Improvements

1. **Explicit retry on send failure** — Currently `sendSMS()` returns `{ error }` instead of throwing, so SMS delivery failures don't trigger Bull retries. Add explicit error checking:
   ```javascript
   const result = await sendSMS(to, finalMessage);
   if (result.error) throw new Error(result.error);
   ```

2. **Provider failover** — If Twilio fails, automatically retry via MSG91 (circuit breaker pattern for higher SMS reliability).

3. **DND/opt-out registry** — Check a `sms_optouts` table before sending to respect user opt-outs and comply with TRAI regulations (India).

4. **Delivery status webhook** — Configure Twilio status callbacks to update an `sms_logs` table with delivery confirmation.

5. **Message length validation** — Warn or split messages exceeding 160 characters to prevent multi-part SMS charges.

6. **Phone number validation** — Validate E.164 format before enqueuing to catch bad numbers early rather than wasting API credits.
