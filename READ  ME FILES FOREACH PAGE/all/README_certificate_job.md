# certificate.job.js — Certificate PDF Generation Processor

> **EduVerse** | `jobs/certificate.job.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Job Data Shape](#4-job-data-shape)
5. [Processing Pipeline](#5-processing-pipeline)
6. [Template System](#6-template-system)
7. [PDF Generation](#7-pdf-generation)
8. [Database Interactions](#8-database-interactions)
9. [Email Notification](#9-email-notification)
10. [Error Handling](#10-error-handling)
11. [Environment Variables](#11-environment-variables)
12. [Setup & Installation](#12-setup--installation)
13. [Workflow Diagram](#13-workflow-diagram)
14. [Possible Improvements](#14-possible-improvements)

---

## 1. Overview

`certificate.job.js` is a **Bull queue job processor** responsible for generating PDF certificates for students upon course completion. It is registered against the `certificateQueue` (Bull queue backed by Redis) and processes up to **3 certificates concurrently**.

**File location:** `jobs/certificate.job.js`

---

## 2. Purpose & Problem Solved

Certificate PDF generation is a time-consuming operation (2–10 seconds per PDF when using headless Chrome). Running this synchronously inside an HTTP request handler would:

- Block the response to the student
- Increase server response time dramatically
- Risk timeouts on slow servers

By queuing this as a background job, the HTTP response is returned instantly after the job is enqueued, and the PDF is generated asynchronously.

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `path` | Node.js built-in | File path construction |
| `fs` | Node.js built-in | Directory creation, file existence check |
| `../config/db` | Internal | MySQL database queries |
| `../config/mailer` | Internal | Sending certificate email to student |
| `puppeteer` | npm (optional) | Headless Chrome for HTML → PDF rendering |

> **Note:** `puppeteer` is a soft dependency. If not installed, PDF generation is skipped gracefully and the job still completes.

---

## 4. Job Data Shape

```javascript
{
  certificateId: number,   // Primary key of the certificates table record
  studentId:     number,   // user ID of the student (users.id)
  courseId:      number,   // course ID (nullable — null for bonafide/transfer certs)
  type:          string,   // 'course_completion' | 'transfer' | 'bonafide'
}
```

**How to enqueue this job:**
```javascript
const { queueCertificate } = require('./jobs/queue');

await queueCertificate({
  certificateId: 10,
  studentId:     55,
  courseId:      3,
  type:          'course_completion',
});
```

---

## 5. Processing Pipeline

The processor executes the following steps in order:

```
Step 1  [DB]       Fetch certificate record (certificates table)
Step 2  [DB]       Fetch student name + email (users + user_profiles)
Step 3  [DB]       Fetch course title + instructor name (if courseId present)
Step 4  [Template] Load HTML certificate template
Step 5  [String]   Inject variables into template (replace {{placeholders}})
Step 6  [FS]       Ensure /uploads/certificates/ directory exists
Step 7  [Puppeteer]Generate PDF from HTML (A4 landscape)
Step 8  [DB]       UPDATE certificates SET file_url = '...'
Step 9  [DB]       INSERT in-app notification for student
Step 10 [Email]    Send certificate email to student
```

**Job progress milestones:**

| Progress | Stage |
|---|---|
| 20% | DB data fetched |
| 30% | Template loaded |
| 40% | Template variables injected |
| 80% | PDF generated |
| 100% | Email sent |

---

## 6. Template System

Templates are loaded with the following **priority order**:

### Priority 1 — Institute-Specific Template
```sql
SELECT template_html 
FROM certificate_templates 
WHERE institute_id = ? 
LIMIT 1
```
Used when the certificate belongs to a specific institute that has uploaded a custom branded template.

### Priority 2 — Platform Default Template
```sql
SELECT template_html 
FROM certificate_templates 
WHERE institute_id IS NULL AND is_default = 1 
LIMIT 1
```
Used when no institute-specific template exists but a platform administrator has defined a default.

### Priority 3 — Built-in Hardcoded Template
Used as a final fallback when no DB templates exist. Features:
- **Fonts:** Playfair Display (headings) + Inter (body) from Google Fonts
- **Layout:** A4 landscape (1122×794px), centered, blue border (`#1A56DB`)
- **Design:** EduVerse branding, inner border, certificate code in monospace
- **Sections:** Logo, tagline, certificate type, student name, course name, dual signature blocks, verify URL

### Template Variable Substitution

The following `{{placeholders}}` are replaced using global string replace:

| Placeholder | Value |
|---|---|
| `{{student_name}}` | `user_profiles.full_name` |
| `{{course_title}}` | `courses.title` or `certificates.title` |
| `{{instructor_name}}` | Instructor's `user_profiles.full_name` |
| `{{issued_date}}` | Formatted date (e.g., `15 January 2025`) using `en-IN` locale |
| `{{certificate_code}}` | `certificates.certificate_code` |
| `{{verify_url}}` | `{FRONTEND_URL}/pages/auth/verify-cert.html?code={code}` |

---

## 7. PDF Generation

Uses **Puppeteer** (headless Chrome) to render HTML to PDF.

**Output filename:** `cert-{certificateId}-{certificate_code}.pdf`

**Output path:** `/uploads/certificates/cert-{id}-{code}.pdf`

**Public URL:** `/uploads/certificates/cert-{id}-{code}.pdf`

**Puppeteer configuration:**
```javascript
await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',             // Required for Linux/Docker
    '--disable-setuid-sandbox', // Required for Linux/Docker
    '--disable-dev-shm-usage',  // Prevents crashes on low-memory containers
  ],
});

await page.pdf({
  path:            outputPath,
  format:          'A4',
  landscape:       true,
  printBackground: true,         // Required to render background colors/borders
  margin:          { top: 0, right: 0, bottom: 0, left: 0 },
});
```

**Graceful failure:** If Puppeteer is not installed or Chrome crashes, the error is caught and logged. The job **does not fail** — it continues to update the DB record, send the notification, and deliver the email. The `file_url` in the DB will not be set if PDF generation fails.

---

## 8. Database Interactions

| Operation | Table | SQL Action |
|---|---|---|
| Fetch certificate | `certificates` | `SELECT * WHERE id = ?` |
| Fetch student | `users`, `user_profiles` | `JOIN SELECT WHERE u.id = ?` |
| Fetch course | `courses`, `user_profiles` | `JOIN SELECT WHERE c.id = ?` |
| Fetch institute template | `certificate_templates` | `SELECT WHERE institute_id = ?` |
| Fetch default template | `certificate_templates` | `SELECT WHERE is_default = 1` |
| Update file URL | `certificates` | `UPDATE SET file_url = ?` |
| Insert notification | `notifications` | `INSERT` |

---

## 9. Email Notification

After PDF generation, the student receives an HTML email with:

- Congratulations message with their name
- Course title they completed
- "Download Certificate" button linking to `/pages/student/certificates.html`
- Certificate ID (code) for reference
- Verification URL: `{FRONTEND_URL}/verify?code={code}`

**Email is sent using:** `sendMail()` from `config/mailer.js`

---

## 10. Error Handling

| Scenario | Behavior |
|---|---|
| Certificate record not found in DB | Throws `Error('Certificate {id} not found.')` → Bull retries |
| Student record not found in DB | Throws `Error('Student {id} not found.')` → Bull retries |
| Puppeteer not installed | Caught, warning logged, job continues without PDF |
| PDF generation fails (Chrome crash) | Caught, warning logged, job continues without PDF |
| Email send fails | Throws → Bull retries the entire job |
| DB query fails | Throws → Bull retries |

**Retry policy:** Up to 3 attempts with exponential backoff (2s → 4s → 8s), inherited from `queue.js` defaults.

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FRONTEND_URL` | No | `http://localhost:5500` | Used in verify URL and email links |
| `MAIL_USER` | No (warn) | — | SMTP username for sending email |
| `MAIL_PASS` | No (warn) | — | SMTP password |
| `REDIS_HOST` | No | — | If not set, queue runs inline |

---

## 12. Setup & Installation

```bash
# Required: Puppeteer for PDF generation
npm install puppeteer

# On Linux servers without Chrome (Docker, VPS):
npm install puppeteer-core
# + install chromium separately
sudo apt-get install -y chromium-browser
```

**Ensure output directory is writable:**
```bash
mkdir -p uploads/certificates
chmod 755 uploads/certificates
```

The directory is auto-created by the job processor if it doesn't exist (`fs.mkdirSync` with `recursive: true`).

---

## 13. Workflow Diagram

```
Student completes course
        │
        ▼
[Controller] INSERT INTO certificates (...)
        │
        ▼
[Controller] queueCertificate({ certificateId, studentId, courseId, type })
        │
        ▼
[queue.js] certificateQueue.add(data) → Redis (Bull)
        │
        ▼  (async — HTTP response already sent)
[certificate.job.js]
  ├─ Fetch cert + student + course from DB
  ├─ Load HTML template (institute → platform → built-in)
  ├─ Replace {{placeholders}} with real data
  ├─ Puppeteer: HTML → PDF (A4 landscape)
  ├─ Save: /uploads/certificates/cert-{id}-{code}.pdf
  ├─ UPDATE certificates SET file_url = '...'
  ├─ INSERT notifications (in-app)
  └─ sendMail() → student email
        │
        ▼
Student sees in-app notification + receives email
```

---

## 14. Possible Improvements

1. **PDF attachment in email** — Attach the generated PDF as a base64 attachment in the email so students can save it directly from their inbox.

2. **Template versioning** — Store `template_version` on certificates so historical certs can be re-generated with the exact template that was used originally.

3. **Watermarking** — Add a digital watermark or QR code encoding the certificate code for easier offline verification.

4. **Bulk certificate generation** — Support a `batchCertificate` job that accepts an array of certificate IDs for end-of-term batch processing.

5. **Custom fonts from DB** — Allow institutes to specify font URLs in their template configuration so branding is fully customizable without code changes.

6. **Job deduplication** — Use `jobId: 'cert-{certificateId}'` in Bull options to prevent duplicate PDFs from being generated if the job is accidentally enqueued twice.
