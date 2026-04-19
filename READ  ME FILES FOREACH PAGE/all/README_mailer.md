# mailer.js — Nodemailer Email Service

> **EduVerse** | `config/mailer.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Transporter Configuration](#4-transporter-configuration)
5. [sendMail Function](#5-sendmail-function)
6. [Email Templates](#6-email-templates)
7. [Connection Verification](#7-connection-verification)
8. [Error Handling](#8-error-handling)
9. [Environment Variables](#9-environment-variables)
10. [Usage Examples](#10-usage-examples)
11. [Workflow Diagram](#11-workflow-diagram)
12. [Possible Improvements](#12-possible-improvements)

---

## 1. Overview

`mailer.js` configures and exports a reusable Nodemailer SMTP transporter along with a built-in HTML email template library. All outbound email in EduVerse goes through this module.

**File location:** `config/mailer.js`

---

## 2. Purpose & Problem Solved

Centralizing email configuration in one module provides:
- Single SMTP transporter instance (connection pooling)
- Consistent `from` address across all emails
- Reusable HTML templates with consistent branding
- Startup connection verification so email failures are caught early

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `nodemailer` | npm | SMTP email sending |

---

## 4. Transporter Configuration

```javascript
const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || 'smtp.gmail.com',
  port:   process.env.MAIL_PORT || 587,
  secure: false,   // false = STARTTLS on port 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});
```

**`secure: false`** means the connection starts unencrypted and upgrades to TLS via STARTTLS on port 587. This is the standard configuration for Gmail and most SMTP providers.

For port 465 (SSL), set `secure: true`.

---

## 5. sendMail Function

```javascript
/**
 * Send an email
 * @param {object} options
 * @param {string} options.to      - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html    - HTML email body
 * @returns {Promise<object>}      - Nodemailer info object (includes messageId)
 */
async function sendMail({ to, subject, html })
```

**Example:**
```javascript
const { sendMail } = require('./config/mailer');

const info = await sendMail({
  to:      'student@example.com',
  subject: 'Welcome to EduVerse',
  html:    '<h1>Hello, Alice!</h1>',
});

console.log('Message ID:', info.messageId);
```

The `from` field is automatically set to `process.env.MAIL_FROM` or `EduVerse <noreply@eduverse.com>`.

On success, logs: `📧 Email sent to: student@example.com | ID: <abc123@mail.gmail.com>`

On failure, logs the error and **throws** — callers must handle the error.

---

## 6. Email Templates

Pre-built branded HTML email templates are exported as `templates`:

```javascript
const { templates } = require('./config/mailer');
const { subject, html } = templates.verifyEmail('Alice', 'https://...');
```

### `templates.verifyEmail(name, verifyUrl)`

**Subject:** `Verify your EduVerse account`

**Content:**
- EduVerse logo block (blue gradient square with "E")
- Greeting: `Welcome, {name}! 👋`
- Explanation paragraph
- "Verify Email Address" CTA button (blue, `#1A56DB`)
- Expiry note: link expires in 24 hours
- Footer: © 2025 EduVerse

### `templates.resetPassword(name, resetUrl)`

**Subject:** `Reset your EduVerse password`

**Content:**
- EduVerse logo block
- Heading: `Password Reset Request`
- Explanation paragraph with user's name
- "Reset Password" CTA button (blue, `#1A56DB`)
- Expiry note: link expires in 1 hour
- Footer: © 2025 EduVerse

### Template Design Standards

All templates share:
- Font: Inter, Arial, sans-serif
- Max width: 560px (centered, mobile-friendly)
- Primary color: `#1A56DB` (EduVerse blue)
- Body text: `#6b7280` (gray-500)
- Heading text: `#111827` (gray-900)
- Footer text: `#9ca3af` (gray-400)
- Button: `14px 32px` padding, `8px` border radius

---

## 7. Connection Verification

On module load, the transporter verifies the SMTP connection:

```javascript
transporter.verify(function (err, success) {
  if (err) {
    console.error('❌ Mail server connection failed:', err.message);
  } else {
    console.log('✅ Mail server connected —', process.env.MAIL_USER);
  }
});
```

**This does not crash the server on failure** — it only logs. This allows the server to start even if the mail server is temporarily unavailable.

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| SMTP connection failure on startup | Logged as `❌` error, server continues |
| `sendMail()` fails (auth error, network, etc.) | Logs `❌ Email send failed:` + message, then **throws** |
| Missing `MAIL_USER` / `MAIL_PASS` | `env.js` warns; `transporter.verify` will fail and log |

Since `sendMail()` throws on failure, callers (job processors) should handle this:
```javascript
// In email.job.js — if sendMail throws, Bull catches it and retries the job
await sendMail({ to, subject, html });
```

---

## 9. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAIL_HOST` | No | `smtp.gmail.com` | SMTP server hostname |
| `MAIL_PORT` | No | `587` | SMTP port (587 = STARTTLS, 465 = SSL) |
| `MAIL_USER` | No (warn) | — | SMTP authentication username |
| `MAIL_PASS` | No (warn) | — | SMTP authentication password (use App Password for Gmail) |
| `MAIL_FROM` | No | `EduVerse <noreply@eduverse.com>` | Sender display name and address |

### Gmail Setup

To use Gmail SMTP:
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Google Account → Security → App Passwords
3. Use the 16-character app password as `MAIL_PASS`

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=youremail@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx   # App Password (spaces are fine)
MAIL_FROM=EduVerse <youremail@gmail.com>
```

---

## 10. Usage Examples

### Direct usage (in controllers)
```javascript
const { sendMail, templates } = require('./config/mailer');

// Registration verification
const { subject, html } = templates.verifyEmail(user.name, verifyUrl);
await sendMail({ to: user.email, subject, html });

// Password reset
const reset = templates.resetPassword(user.name, resetUrl);
await sendMail({ to: user.email, subject: reset.subject, html: reset.html });
```

### Via job queue (recommended for most use cases)
```javascript
const { queueEmail } = require('../jobs/queue');

await queueEmail({
  to:           user.email,
  template:     'verifyEmail',
  templateArgs: [user.name, verifyUrl],
});
```

### Custom one-off email
```javascript
await sendMail({
  to:      'admin@school.com',
  subject: 'New Student Registered',
  html:    `<p>Student <strong>${studentName}</strong> has registered.</p>`,
});
```

---

## 11. Workflow Diagram

```
Any part of application
        │
        ▼
sendMail({ to, subject, html })
        │
        ▼
nodemailer transporter
        │
        ├─ Connects to MAIL_HOST:MAIL_PORT
        ├─ STARTTLS handshake
        ├─ AUTH LOGIN (MAIL_USER / MAIL_PASS)
        └─ SMTP DATA → email delivered
```

---

## 12. Possible Improvements

1. **Connection pooling** — Enable `pool: true` in the transporter config to reuse SMTP connections for high-volume sending:
   ```javascript
   nodemailer.createTransport({ ..., pool: true, maxConnections: 5 });
   ```

2. **Transactional email provider** — For production, replace raw SMTP with SendGrid, Postmark, or AWS SES for better deliverability, bounce handling, and analytics.

3. **More templates** — Add templates for: fee reminder, grade published, certificate issued, live session reminder, low attendance alert — currently these are generated inline in various job files.

4. **Template engine** — Replace hardcoded HTML strings with a templating engine (Handlebars, Mustache) and store templates as `.hbs` files for easier maintenance.

5. **Plain text fallback** — Add a `text` field to `sendMail` with plain-text version for email clients that don't render HTML and to improve spam scores.

6. **Email preview in development** — Use Nodemailer's Ethereal (test accounts) or Mailtrap to capture emails in development without sending to real addresses:
   ```javascript
   // In development:
   const testAccount = await nodemailer.createTestAccount();
   ```
