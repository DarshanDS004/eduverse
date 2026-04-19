# email.job.js — Email Job Processor

> **EduVerse** | `jobs/email.job.js`

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

`email.job.js` is a **Bull queue job processor** that handles all outbound email delivery for the EduVerse platform. It is registered against the `emailQueue` and processes up to **5 emails concurrently**.

**File location:** `jobs/email.job.js`

---

## 2. Purpose & Problem Solved

Sending email via SMTP can take 100ms–2000ms per message depending on the mail server. If emails were sent synchronously inside HTTP request handlers, every registration, password reset, or grade notification would add that latency to the user-facing response.

This processor decouples email delivery from the HTTP cycle — the API responds instantly, and emails are delivered asynchronously.

**Use cases for this processor:**
- Email verification on registration
- Password reset link delivery
- Fee payment reminders
- Grade published notifications
- Weekly report emails to institute admins
- Certificate delivery emails

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `../config/mailer` | Internal | `sendMail()` function + `templates` object |

No external npm packages are directly required by this file — all SMTP logic lives in `config/mailer.js`.

---

## 4. Job Data Shape

```javascript
{
  to:            string,   // REQUIRED — recipient email address
  subject:       string,   // Email subject line (used only if no template)
  html:          string,   // Raw HTML body (used only if no template)
  template:      string,   // Template key (e.g. 'verifyEmail', 'resetPassword')
  templateArgs:  Array,    // Arguments passed to the template function
}
```

**Either `template` OR `subject`+`html` must be provided. `to` is always required.**

---

## 5. Processing Logic

```javascript
// Simplified processor logic:

1. Validate that `to` field exists → throw if missing

2. If `template` is provided AND exists in mailer.templates:
   const rendered = templates[template](...templateArgs);
   finalSubject   = rendered.subject;
   finalHtml      = rendered.html;

3. Else:
   finalSubject = subject;
   finalHtml    = html;

4. Validate finalSubject and finalHtml are present → throw if missing

5. await sendMail({ to, subject: finalSubject, html: finalHtml })

6. Return { sent: true, to, subject: finalSubject }
```

---

## 6. Template Support

The processor integrates with the template library in `config/mailer.js`. Available templates:

| Template Key | Arguments | Subject Generated |
|---|---|---|
| `verifyEmail` | `(name, verifyUrl)` | `Verify your EduVerse account` |
| `resetPassword` | `(name, resetUrl)` | `Reset your EduVerse password` |

**Using a template in a job:**
```javascript
await queueEmail({
  to:           'student@example.com',
  template:     'verifyEmail',
  templateArgs: ['Alice', 'https://eduverse.com/verify?token=abc123'],
});
```

**Using raw HTML (no template):**
```javascript
await queueEmail({
  to:      'admin@school.com',
  subject: 'Monthly Report Ready',
  html:    '<p>Your report is attached.</p>',
});
```

---

## 7. Concurrency

The processor is registered with a concurrency of **5**:

```javascript
queue.process(5, async function (job) { ... });
```

This means up to 5 emails are sent in parallel at any given time. This is safe because:
- Each job is independent (no shared state)
- SMTP connections are handled by Nodemailer's pooling
- 5 concurrent is conservative — can be raised if mail server supports higher throughput

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| `to` field missing | Throws `Error('Email job missing "to" field.')` → Bull retries |
| Template key not found in templates object | Falls through to raw subject/html check |
| Both template and raw html/subject missing | Throws `Error('Email job missing subject or html.')` → Bull retries |
| `sendMail()` throws (SMTP error) | Propagates throw → Bull retries |

**Retry policy (inherited from queue.js):**
- Max attempts: **3**
- Backoff: **exponential**, starting at 2s (2s → 4s → 8s)
- Failed jobs retained: **200** (for debugging in Redis)

**Progress logging:**
```javascript
queue.on('progress', (job, progress) => {
  console.log(`[EmailJob] Job ${job.id} is ${progress}% complete.`);
});
```

---

## 9. Environment Variables

Email job itself uses no env vars directly. All email configuration is in `config/mailer.js`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAIL_HOST` | No | `smtp.gmail.com` | SMTP server hostname |
| `MAIL_PORT` | No | `587` | SMTP port |
| `MAIL_USER` | No (warn) | — | SMTP auth username |
| `MAIL_PASS` | No (warn) | — | SMTP auth password |
| `MAIL_FROM` | No | `EduVerse <noreply@eduverse.com>` | Sender address |
| `REDIS_HOST` | No | — | Required for async queuing; without it, runs inline |

---

## 10. Usage Examples

### Registration Email Verification
```javascript
await queueEmail({
  to:           newUser.email,
  template:     'verifyEmail',
  templateArgs: [newUser.name, `${process.env.FRONTEND_URL}/verify?token=${token}`],
});
```

### Password Reset
```javascript
await queueEmail({
  to:           user.email,
  template:     'resetPassword',
  templateArgs: [user.name, `${process.env.FRONTEND_URL}/reset?token=${resetToken}`],
});
```

### Custom One-Off Email
```javascript
await queueEmail({
  to:      'principal@school.edu',
  subject: 'Fee Collection Report — November 2025',
  html:    buildReportEmail('Fee Collection Report', '/uploads/reports/fee-nov.pdf'),
});
```

---

## 11. Workflow Diagram

```
[Route Handler / Controller]
        │
        ▼
queueEmail({ to, template, templateArgs })
        │
        ▼
[queue.js] emailQueue.add(data) → Redis (Bull)
        │
        ▼ (async — HTTP response already sent)
[email.job.js processor]
  1. Validate 'to'
  2. Render template (if provided) → subject + html
  3. sendMail({ to, subject, html })
  4. Nodemailer → SMTP → Delivered
        │
        ▼
Return { sent: true, to, subject }
```

---

## 12. Possible Improvements

1. **Bounce handling** — Integrate a webhook to track bounced/undeliverable emails and mark user email addresses as invalid in the DB.

2. **Open & click tracking** — Migrate to a transactional email provider (SendGrid, Postmark, AWS SES) for delivery tracking, analytics, and better inbox placement.

3. **Unsubscribe support** — Add a one-click unsubscribe token to marketing/notification emails to comply with CAN-SPAM / GDPR requirements.

4. **Email deduplication** — Use Bull's `jobId` to prevent the same email from being sent twice (e.g., `jobId: 'verify-{userId}'`).

5. **Template registry expansion** — Add templates for: fee reminders, grade published, low attendance alerts, live session reminders — currently these are generated inline in other job files.

6. **HTML email testing** — Integrate a service like Mailtrap for development to preview emails without sending to real inboxes.
