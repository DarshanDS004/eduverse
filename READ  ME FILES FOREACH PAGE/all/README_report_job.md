# report.job.js — Report Generation Job Processor

> **EduVerse** | `jobs/report.job.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Job Data Shape](#4-job-data-shape)
5. [Supported Report Types](#5-supported-report-types)
6. [Processing Pipeline](#6-processing-pipeline)
7. [Data Fetch Functions](#7-data-fetch-functions)
8. [PDF Generation](#8-pdf-generation)
9. [Database Interactions](#9-database-interactions)
10. [Email Notification](#10-email-notification)
11. [Error Handling](#11-error-handling)
12. [Environment Variables](#12-environment-variables)
13. [Setup & Installation](#13-setup--installation)
14. [Workflow Diagram](#14-workflow-diagram)
15. [Possible Improvements](#15-possible-improvements)

---

## 1. Overview

`report.job.js` is a **Bull queue job processor** that generates PDF analytics and management reports in the background. It is registered against the `reportQueue` and processes up to **2 reports concurrently**.

**File location:** `jobs/report.job.js`

**Output directory:** `/uploads/reports/`

---

## 2. Purpose & Problem Solved

Report generation involves:
- Multiple complex aggregation DB queries (JOINs across many tables)
- Heavy in-memory data processing
- Puppeteer PDF rendering (headless Chrome — seconds per page)

Running this synchronously would block HTTP responses for several seconds. The queue system ensures reports are generated asynchronously while the user receives an immediate acknowledgment.

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `path` | Node.js built-in | File path construction |
| `fs` | Node.js built-in | Directory creation |
| `../config/db` | Internal | All DB queries for report data |
| `../config/mailer` | Internal | Sending report-ready email |
| `puppeteer` | npm (optional) | HTML → PDF rendering |

---

## 4. Job Data Shape

```javascript
{
  type:   string,   // Report type identifier (see supported types below)
  userId: number,   // ID of the user who requested the report (for notification)
  email:  string,   // Email address to deliver the report download link
  params: object,   // Report-specific parameters (varies by type)
}
```

**How to enqueue:**
```javascript
const { queueReport } = require('./jobs/queue');

await queueReport({
  type:   'student_performance',
  userId: 55,
  email:  'teacher@school.com',
  params: { studentId: 55, instituteId: 1 },
});
```

---

## 5. Supported Report Types

| Type | `params` Fields | Description |
|---|---|---|
| `student_performance` | `{ studentId, instituteId }` | Individual student quiz scores, assignment grades, attendance summary |
| `class_performance` | `{ classId }` | All students in a class with average scores and attendance counts |
| `attendance` | `{ instituteId, from?, to?, classId? }` | Attendance records filtered by institute, date range, and optionally class |
| `fee_collection` | `{ instituteId }` | Fee collected/pending/overdue summary + per-student details |
| `instructor_earnings` | `{ instructorId, from?, to? }` | Study material sales transactions and total earnings for an instructor |
| `platform_analytics` | `{ from?, to? }` | Platform-wide user counts, total revenue, enrollments, published courses |

---

## 6. Processing Pipeline

```
Step 1  [FS]       Ensure /uploads/reports/ directory exists
Step 2  [Switch]   Determine report type → call fetch function → set filename + title
Step 3  [DB]       Fetch report data (multiple aggregation queries)
Step 4  [Puppeteer]Build HTML + render to PDF (A4 portrait)
Step 5  [FS]       Save PDF to /uploads/reports/{filename}
Step 6  [DB]       INSERT in-app notification for requesting user
Step 7  [Email]    Send email with download link (if email provided)
```

**Job progress milestones:**

| Progress | Stage |
|---|---|
| 10% | Job started, directory ensured |
| 50% | Data fetched from DB |
| 80% | PDF generated |
| 100% | Notification + email sent |

---

## 7. Data Fetch Functions

### `fetchStudentPerformance(studentId, instituteId)`

Fetches:
- Student name and email from `users` + `user_profiles`
- All quiz attempts with scores and pass/fail status
- All assignment submissions with scores
- Aggregate attendance (total sessions vs present count)

### `fetchClassPerformance(classId)`

Fetches:
- Class record from `classes`
- All enrolled students with their average quiz score and attendance counts (subqueries per student)
- Results ordered by `avg_score DESC`

### `fetchAttendanceReport(instituteId, from, to, classId)`

Fetches:
- Attendance records joined with sessions, classes, and student profiles
- Filtered dynamically by institute, optional class, optional date range
- Ordered by student name then date

### `fetchFeeReport(instituteId)`

Fetches:
- Summary aggregate: total collected / pending / overdue amounts
- Per-student fee details with fee name, amount, status, due date, paid date

### `fetchEarningsReport(instructorId, from, to)`

Fetches:
- Instructor name and email
- All successful material purchase transactions
- Total earnings (sum of `amount_paid`)
- Filtered by optional date range

### `fetchPlatformReport(from, to)`

Fetches:
- Total users, students count, instructors count
- Total successful payment revenue
- Total enrollments
- Total published courses

---

## 8. PDF Generation

Uses **Puppeteer** (headless Chrome) to render an HTML page to PDF.

**Puppeteer configuration:**
```javascript
await page.pdf({
  path:            filePath,
  format:          'A4',
  printBackground: true,
  margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
});
```

**Output filename pattern:** `{report-type}-{params}-{Date.now()}.pdf`

Examples:
- `student-report-55-1700000000000.pdf`
- `class-report-3-1700000000000.pdf`
- `attendance-report-1700000000000.pdf`
- `fee-report-1700000000000.pdf`
- `earnings-report-12-1700000000000.pdf`
- `platform-report-1700000000000.pdf`

**HTML report structure:**
```html
<h1>{title}</h1>
<div class="meta">Generated on {date} | EduVerse Platform</div>
<pre>{JSON.stringify(data, null, 2)}</pre>
<div class="footer">EduVerse — Every Stage. Every Learner.</div>
```

> **Note:** The current HTML builder uses `JSON.stringify` for data display. This is a functional placeholder — see [Possible Improvements](#15-possible-improvements).

**Graceful failure:** If Puppeteer fails, `generateReportPDF` returns `false` (does not throw). The job continues to send the notification and email even without a PDF.

---

## 9. Database Interactions

| Operation | Table(s) | Purpose |
|---|---|---|
| Fetch student | `users`, `user_profiles` | Student name/email |
| Fetch quiz scores | `quiz_attempts`, `quizzes` | Performance data |
| Fetch assignment scores | `assignment_submissions`, `assignments` | Grade data |
| Fetch attendance | `attendance_records` | Attendance summary |
| Fetch class | `classes` | Class metadata |
| Fetch class students | `class_students`, `users`, `user_profiles` | All students in class |
| Fetch attendance records | `attendance_records`, `attendance_sessions`, `classes`, `user_profiles` | Full attendance log |
| Fetch fee summary | `student_fees` | Aggregate fee status |
| Fetch fee details | `student_fees`, `fee_structures`, `user_profiles` | Per-student fee rows |
| Fetch earnings | `material_purchases`, `study_materials`, `user_profiles` | Transaction list |
| Fetch platform stats | `users`, `payments`, `enrollments`, `courses` | Platform metrics |
| Insert notification | `notifications` | In-app notification |

---

## 10. Email Notification

After PDF generation, two notifications are sent:

**In-app notification (always):**
```sql
INSERT INTO notifications (user_id, title, body, type, link)
VALUES (?, 'Report Ready', 'Your {title} has been generated...', 'report', '{fileUrl}')
```

**Email (if `email` field is present in job data):**
- Subject: `Your EduVerse Report is Ready — {title}`
- Body: report title + "Download Report" button linking to `{FRONTEND_URL}{fileUrl}`

---

## 11. Error Handling

| Scenario | Behavior |
|---|---|
| Unknown report type | Throws `Error('Unknown report type: {type}')` → Bull retries |
| DB query failure | Throws → Bull retries |
| Puppeteer not installed | Caught, `generateReportPDF` returns `false`, job continues |
| PDF generation fails | Caught, returns `false`, job continues without PDF |
| Email send fails | Throws → Bull retries entire job |

**Retry policy (inherited from queue.js):**
- Max attempts: **3**
- Backoff: **exponential**, starting at 2s

---

## 12. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FRONTEND_URL` | No | `http://localhost:5500` | Used in report download links in emails |
| `MAIL_USER` | No (warn) | — | SMTP username |
| `MAIL_PASS` | No (warn) | — | SMTP password |
| `REDIS_HOST` | No | — | Required for async; without it, runs inline (no PDF) |

---

## 13. Setup & Installation

```bash
# Install Puppeteer for PDF generation
npm install puppeteer

# Ensure output directory is writable
mkdir -p uploads/reports
chmod 755 uploads/reports
```

The directory is auto-created by the processor using `fs.mkdirSync({ recursive: true })`.

**Linux server (Docker/VPS) — if Chrome crashes:**
```bash
# Install Chrome dependencies
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

---

## 14. Workflow Diagram

```
Admin/Teacher requests report via UI
        │
        ▼
[Controller] queueReport({ type, userId, email, params })
        │
        ▼
[queue.js] reportQueue.add(data) → Redis (Bull)
        │
        ▼  (async — HTTP response "Report generation started" sent)
[report.job.js processor]
  ├─ switch(type) → fetchXxx(params)
  │     └─ Multiple DB aggregation queries
  ├─ buildReportHTML(data, title)
  ├─ Puppeteer: HTML → PDF (A4)
  ├─ Save: /uploads/reports/{filename}.pdf
  ├─ INSERT notifications for userId
  └─ sendMail() → email with download link
        │
        ▼
User sees in-app notification + receives email
User clicks download → serves /uploads/reports/{filename}.pdf
```

---

## 15. Possible Improvements

1. **Proper HTML report templates** — Replace `JSON.stringify` with a real HTML table builder (Handlebars, EJS, or a custom function) that renders clean tabular reports with charts.

2. **Excel/CSV export** — Add `xlsx` or `csv-writer` support for downloadable spreadsheet reports (more useful than PDFs for data analysis).

3. **Report caching** — Hash report params and cache the generated PDF path in Redis with a 24-hour TTL. If the same report is requested again within the TTL, return the cached file.

4. **Scheduled reports** — Allow admins to schedule automatic weekly/monthly reports using Bull's `cron`-like delayed job feature.

5. **Progress streaming** — Use WebSockets or Server-Sent Events to update the frontend in real-time as the report progresses (10% → 50% → 80% → 100%).

6. **Report history** — Store generated report metadata in a `reports` DB table (user, type, params, file_url, created_at) so users can re-download past reports without regenerating.

7. **Chart integration** — Use a headless charting library (Chart.js via Puppeteer, or `@nivo/core` for server-side SVG) to include graphs in reports.
