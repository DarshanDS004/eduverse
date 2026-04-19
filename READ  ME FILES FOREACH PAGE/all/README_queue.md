# queue.js — Job Queue System

> **EduVerse** | `jobs/queue.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Queue Instances](#4-queue-instances)
5. [Configuration](#5-configuration)
6. [Helper Functions (Public API)](#6-helper-functions-public-api)
7. [Inline Fallback Mode](#7-inline-fallback-mode)
8. [Processor Registration](#8-processor-registration)
9. [Queue Statistics](#9-queue-statistics)
10. [Graceful Shutdown](#10-graceful-shutdown)
11. [Environment Variables](#11-environment-variables)
12. [Setup & Usage](#12-setup--usage)
13. [Workflow Diagram](#13-workflow-diagram)
14. [Possible Improvements](#14-possible-improvements)

---

## 1. Overview

`queue.js` is the **central hub** for all background job queues in EduVerse. It creates Bull queue instances backed by Redis, exposes clean helper functions for the rest of the application, registers all job processors at startup, and handles graceful shutdown.

**File location:** `jobs/queue.js`

---

## 2. Purpose & Problem Solved

Without a queue system, every slow operation (sending emails, generating PDFs, transcoding videos) would block the HTTP response. `queue.js` solves this by:

- Creating Redis-backed queues for each job type
- Providing simple `queueXxx()` helper functions that hide Bull internals
- Falling back to inline synchronous execution when Redis is unavailable
- Centralizing retry logic, failure logging, and shutdown handling

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `bull` | npm (optional) | Redis-backed job queue |
| `../config/mailer` | Internal | Email fallback (inline mode) |
| `../config/sms` | Internal | SMS fallback (inline mode) |
| `../config/db` | Internal | DB update fallback for video jobs |
| `./email.job` | Internal | Email processor registration |
| `./sms.job` | Internal | SMS processor registration |
| `./video-transcode.job` | Internal | Video processor registration |
| `./certificate.job` | Internal | Certificate processor registration |
| `./report.job` | Internal | Report processor registration |

---

## 4. Queue Instances

| Export Name | Bull Queue Name | Job Type | Concurrency |
|---|---|---|---|
| `emailQueue` | `email` | Email delivery | 5 |
| `smsQueue` | `sms` | SMS delivery | 10 |
| `videoQueue` | `video-transcode` | HLS transcoding | 1 |
| `certificateQueue` | `certificate` | Certificate PDF | 3 |
| `reportQueue` | `report` | Report PDF | 2 |

All queue instances are `null` when Redis is not configured.

---

## 5. Configuration

### Redis Connection

```javascript
const REDIS_CONFIG = {
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};
```

### Default Job Options

Applied to every job added to any queue unless overridden:

```javascript
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,              // Retry failed jobs up to 3 times
  backoff: {
    type:  'exponential',
    delay: 2000,            // 2s → 4s → 8s between retries
  },
  removeOnComplete: 100,    // Keep last 100 completed jobs in Redis
  removeOnFail:     200,    // Keep last 200 failed jobs in Redis
};
```

### Queue Event Handlers

Every queue instance automatically logs:

```
[Queue:email] Job 42 completed.
[Queue:email] Job 43 failed (attempt 2): Connection refused
[Queue:email] Job 44 stalled.
```

---

## 6. Helper Functions (Public API)

These are the **only functions** the rest of the application should use to add jobs. Never call `queue.add()` directly outside this file.

---

### `queueEmail(emailData)`

```javascript
/**
 * @param {object} emailData
 * @param {string} emailData.to           - Recipient email
 * @param {string} [emailData.subject]    - Subject (if no template)
 * @param {string} [emailData.html]       - HTML body (if no template)
 * @param {string} [emailData.template]   - Template key
 * @param {Array}  [emailData.templateArgs] - Args for template function
 */
await queueEmail({
  to:           'student@example.com',
  template:     'verifyEmail',
  templateArgs: ['Alice', 'https://eduverse.com/verify?token=xyz'],
});
```

**Inline fallback:** Renders template (if any) and calls `sendMail()` directly.

---

### `queueSMS(smsData)`

```javascript
/**
 * @param {object} smsData
 * @param {string} smsData.to        - Phone number with country code
 * @param {string} [smsData.message] - SMS text (if no template)
 * @param {string} [smsData.template]- SMS template key
 * @param {Array}  [smsData.args]    - Args for template function
 */
await queueSMS({
  to:       '+919876543210',
  template: 'otp',
  args:     ['4321'],
});
```

**Inline fallback:** Calls `sendSMS()` directly.

---

### `queueVideoTranscode(videoData)`

```javascript
/**
 * @param {object} videoData
 * @param {number} videoData.videoId    - videos.id in DB
 * @param {string} videoData.inputPath  - Absolute path to raw uploaded file
 * @param {string} videoData.outputDir  - Absolute path to HLS output directory
 */
await queueVideoTranscode({
  videoId:   42,
  inputPath: '/uploads/raw/lecture-42.mp4',
  outputDir: '/uploads/hls',
});
```

> Added with `priority: 5` — lower priority than emails and SMS.

**Inline fallback:** Sets `processing_status = 'ready'` in DB without transcoding.

---

### `queueCertificate(certData)`

```javascript
/**
 * @param {object} certData
 * @param {number} certData.certificateId - certificates.id
 * @param {number} certData.studentId     - Student user ID
 * @param {number} certData.courseId      - Course ID (nullable)
 * @param {string} certData.type          - 'course_completion' | 'transfer' | 'bonafide'
 */
await queueCertificate({
  certificateId: 10,
  studentId:     55,
  courseId:      3,
  type:          'course_completion',
});
```

**Inline fallback:** Logs that cert generation was queued (no actual PDF in fallback mode).

---

### `queueReport(reportData)`

```javascript
/**
 * @param {object} reportData
 * @param {string} reportData.type    - Report type string
 * @param {number} reportData.userId  - Requesting user ID
 * @param {string} reportData.email   - Email to deliver report to
 * @param {object} reportData.params  - Report-specific parameters
 */
await queueReport({
  type:   'student_performance',
  userId: 55,
  email:  'teacher@school.com',
  params: { studentId: 55, instituteId: 1 },
});
```

**Inline fallback:** Logs that report generation was queued (no actual PDF in fallback mode).

---

## 7. Inline Fallback Mode

When Redis is not available, all `queueXxx()` calls run the job's logic **synchronously** in the current request. This is handled by the internal `addJob()` utility:

```javascript
async function addJob(queue, data, fallbackFn, opts = {}) {
  if (queue && queuesEnabled) {
    return queue.add(data, { ...DEFAULT_JOB_OPTIONS, ...opts });
  }
  // Fallback: run inline
  if (fallbackFn) {
    try {
      await fallbackFn(data);
    } catch (err) {
      console.error('[Queue] Inline job failed:', err.message);
    }
  }
  return null;
}
```

**Fallback behaviors per queue:**

| Queue | Inline Fallback Behavior |
|---|---|
| `emailQueue` | Renders template, calls `sendMail()` directly |
| `smsQueue` | Calls `sendSMS()` directly |
| `videoQueue` | Sets `processing_status = 'ready'` in DB (no transcoding) |
| `certificateQueue` | Logs "queued" — no PDF is generated |
| `reportQueue` | Logs "queued" — no PDF is generated |

> Inline fallback errors are caught and logged — they do not propagate to the HTTP response.

---

## 8. Processor Registration

Call `registerProcessors()` once during server startup, **after** Redis is connected:

```javascript
// server.js
require('./config/env');
await redis.connect();
const { registerProcessors } = require('./jobs/queue');
registerProcessors();
```

If queues are not enabled (no Redis), `registerProcessors()` returns immediately without doing anything.

```javascript
function registerProcessors() {
  if (!queuesEnabled) return;

  if (emailQueue)       require('./email.job')(emailQueue);
  if (smsQueue)         require('./sms.job')(smsQueue);
  if (videoQueue)       require('./video-transcode.job')(videoQueue);
  if (certificateQueue) require('./certificate.job')(certificateQueue);
  if (reportQueue)      require('./report.job')(reportQueue);

  console.log('[Queue] All processors registered.');
}
```

Each processor file exports a function that accepts the queue instance and calls `queue.process(concurrency, handler)` on it.

---

## 9. Queue Statistics

For the super admin dashboard:

```javascript
const { getQueueStats } = require('./jobs/queue');
const stats = await getQueueStats();
```

**Returns:**
```javascript
{
  email:       { waiting: 2, active: 1, completed: 450, failed: 3, delayed: 0 },
  sms:         { waiting: 0, active: 0, completed: 210, failed: 1, delayed: 0 },
  video:       { waiting: 1, active: 1, completed: 88,  failed: 0, delayed: 0 },
  certificate: { waiting: 0, active: 0, completed: 340, failed: 2, delayed: 0 },
  report:      { waiting: 0, active: 0, completed: 55,  failed: 1, delayed: 0 },
}
```

Returns `null` if queues are not enabled.

---

## 10. Graceful Shutdown

All queues are closed on `SIGTERM` and `SIGINT` signals:

```javascript
process.on('SIGTERM', closeQueues);
process.on('SIGINT',  closeQueues);

async function closeQueues() {
  await Promise.all(allQueues.filter(Boolean).map(q => q.close()));
  console.log('[Queue] All queues closed.');
}
```

This allows in-progress jobs to finish before the Node.js process exits. Important for:
- Docker container stops (`docker stop` sends SIGTERM)
- PM2 restarts
- Kubernetes pod termination

---

## 11. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `REDIS_HOST` | No | — | If not set, queues are disabled and jobs run inline |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | — | Redis auth password |

---

## 12. Setup & Usage

```bash
# Install Bull for Redis-backed queues
npm install bull

# Install Redis (Ubuntu)
sudo apt-get install redis-server
sudo systemctl start redis

# Or run Redis via Docker
docker run -d -p 6379:6379 redis:7-alpine
```

**Minimal usage in any route/controller:**
```javascript
const { queueEmail, queueSMS, queueCertificate } = require('../jobs/queue');

// In a registration controller:
await queueEmail({
  to: req.body.email,
  template: 'verifyEmail',
  templateArgs: [req.body.name, verifyUrl],
});
```

---

## 13. Workflow Diagram

```
Server Startup
  │
  ├─ require('./config/env')         Validate env vars
  ├─ redis.connect()                 Connect Redis
  └─ registerProcessors()            Register all 5 processors
          │
          └─ emailQueue.process(5, handler)
          └─ smsQueue.process(10, handler)
          └─ videoQueue.process(1, handler)
          └─ certificateQueue.process(3, handler)
          └─ reportQueue.process(2, handler)

Runtime — Job Enqueue:
  Controller → queueEmail(data)
                    │
                    ├─ Redis available? → emailQueue.add(data) → Redis
                    └─ Redis unavailable? → sendMail(data) inline

Runtime — Job Processing:
  Redis → Bull worker polls → processor runs → success/fail → retry
```

---

## 14. Possible Improvements

1. **Bull Board UI** — Add `@bull-board/express` for a visual admin dashboard showing queue health, job history, and failed job details.

2. **Job deduplication** — Use Bull's `jobId` option (`jobId: 'cert-{certificateId}'`) to prevent duplicate jobs when the same event fires multiple times.

3. **Separate worker process** — Run job processors in a dedicated Node.js process (not the main API server) so CPU-heavy jobs (PDF, video) don't block the event loop for HTTP requests.

4. **Dead-letter queue** — After 3 failed retries, move jobs to a dead-letter queue with alerting (Slack/email to DevOps) instead of silently retaining in Redis.

5. **Priority queues** — Further differentiate priorities: OTP SMS (critical) > verification email > certificates > reports > video transcoding.

6. **Rate limiting per queue** — Add `limiter` option to Bull queues to cap throughput (e.g., max 100 SMS per minute to avoid provider rate limits).
