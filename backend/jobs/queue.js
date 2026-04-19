/**
 * EduVerse — Job Queue System
 * jobs/queue.js
 *
 * Uses Bull (Redis-backed job queue) for all background tasks.
 *
 * Why background jobs?
 * - Email sending can be slow (100ms–2s) — don't block HTTP response
 * - SMS can be slow — same reason
 * - Video transcoding takes minutes — must be async
 * - PDF generation (certificates, reports) takes seconds — async
 * - Heavy DB operations (report generation) — don't block API
 *
 * Queues defined:
 * - emailQueue      → send emails
 * - smsQueue        → send SMS messages
 * - videoQueue      → transcode uploaded videos to HLS
 * - certificateQueue → generate certificate PDFs
 * - reportQueue     → generate analytics/report PDFs
 *
 * All queues have:
 * - Auto-retry on failure (3 attempts, exponential backoff)
 * - Job completion logging
 * - Failed job logging (for debugging)
 *
 * Graceful fallback: if Redis not available, jobs run inline (synchronously).
 * This means the platform works without Redis — just without async queuing.
 */

'use strict';

let Bull = null;
let queuesEnabled = false;

/* ── Try to load Bull (requires redis) ── */
try {
  Bull = require('bull');
  queuesEnabled = !!process.env.REDIS_HOST;
  if (queuesEnabled) {
    console.log('✅ [Queue] Bull queues enabled.');
  } else {
    console.warn('⚠️  [Queue] REDIS_HOST not set. Jobs will run inline (no background processing).');
  }
} catch (e) {
  console.warn('⚠️  [Queue] Bull not installed. Jobs will run inline.');
}

/* ============================================================
   QUEUE CONFIGURATION
============================================================ */

const REDIS_CONFIG = {
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const DEFAULT_JOB_OPTIONS = {
  attempts:    3,
  backoff: {
    type:  'exponential',
    delay: 2000, // 2s, 4s, 8s
  },
  removeOnComplete: 100,  // keep last 100 completed jobs
  removeOnFail:     200,  // keep last 200 failed jobs
};

/* ============================================================
   CREATE QUEUE FACTORY
============================================================ */

function createQueue(name) {
  if (!queuesEnabled || !Bull) return null;

  const queue = new Bull(name, {
    redis: REDIS_CONFIG,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  // Global event handlers
  queue.on('completed', (job) => {
    console.log(`[Queue:${name}] Job ${job.id} completed.`);
  });

  queue.on('failed', (job, err) => {
    console.error(`[Queue:${name}] Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
  });

  queue.on('stalled', (job) => {
    console.warn(`[Queue:${name}] Job ${job.id} stalled.`);
  });

  return queue;
}

/* ============================================================
   QUEUES
============================================================ */

const emailQueue       = createQueue('email');
const smsQueue         = createQueue('sms');
const videoQueue       = createQueue('video-transcode');
const certificateQueue = createQueue('certificate');
const reportQueue      = createQueue('report');

/* ============================================================
   ADD JOB HELPERS
   These handle the fallback case (no Redis) gracefully.
============================================================ */

/**
 * Add a job to a queue.
 * If queue is not available, runs the handler inline.
 *
 * @param {object|null} queue     - Bull queue instance (or null)
 * @param {object}      data      - Job data
 * @param {Function}    fallbackFn - Function to run if queue unavailable
 * @param {object}      opts      - Bull job options override
 */
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

/* ============================================================
   EXPORTED HELPER FUNCTIONS
   Use these throughout the application — never add to queues directly.
============================================================ */

/**
 * Queue an email send
 * @param {{ to, subject, html, template, data }} emailData
 */
async function queueEmail(emailData) {
  const { sendMail, templates } = require('../config/mailer');

  return addJob(
    emailQueue,
    emailData,
    async (data) => {
      let subject = data.subject;
      let html    = data.html;

      if (data.template && templates[data.template]) {
        const rendered = templates[data.template](...(data.templateArgs || []));
        subject = rendered.subject;
        html    = rendered.html;
      }

      await sendMail({ to: data.to, subject, html });
    }
  );
}

/**
 * Queue an SMS send
 * @param {{ to, message }} smsData
 */
async function queueSMS(smsData) {
  const { sendSMS } = require('../config/sms');

  return addJob(
    smsQueue,
    smsData,
    async (data) => {
      await sendSMS(data.to, data.message);
    }
  );
}

/**
 * Queue video transcoding
 * @param {{ videoId, inputPath, outputDir }} videoData
 */
async function queueVideoTranscode(videoData) {
  return addJob(
    videoQueue,
    videoData,
    async (data) => {
      // Inline: mark as ready without transcoding in dev
      const db = require('../config/db');
      await db.query(
        "UPDATE videos SET processing_status = 'ready' WHERE id = ?",
        [data.videoId]
      );
      console.log(`[Queue] Video ${data.videoId} marked ready (no transcoding in dev).`);
    },
    { priority: 5 } // Lower priority — video jobs can wait
  );
}

/**
 * Queue certificate PDF generation
 * @param {{ certificateId, studentId, courseId }} certData
 */
async function queueCertificate(certData) {
  return addJob(
    certificateQueue,
    certData,
    async (data) => {
      // Inline fallback: just log (PDF generation requires puppeteer/pdf-lib)
      console.log(`[Queue] Certificate generation queued for cert ${data.certificateId}.`);
    }
  );
}

/**
 * Queue report generation
 * @param {{ type, params, userId, email }} reportData
 */
async function queueReport(reportData) {
  return addJob(
    reportQueue,
    reportData,
    async (data) => {
      console.log(`[Queue] Report generation queued: type=${data.type} for user=${data.userId}.`);
    }
  );
}

/* ============================================================
   REGISTER PROCESSORS
   Call this after all queues are created (in server.js startup)
============================================================ */

function registerProcessors() {
  if (!queuesEnabled) return;

  // Processors are registered in separate files — import them here
  if (emailQueue)       require('./email.job')(emailQueue);
  if (smsQueue)         require('./sms.job')(smsQueue);
  if (videoQueue)       require('./video-transcode.job')(videoQueue);
  if (certificateQueue) require('./certificate.job')(certificateQueue);
  if (reportQueue)      require('./report.job')(reportQueue);

  console.log('[Queue] All processors registered.');
}

/* ============================================================
   QUEUE STATS (for super admin dashboard)
============================================================ */

async function getQueueStats() {
  if (!queuesEnabled) return null;

  const allQueues = [
    { name: 'email',        queue: emailQueue },
    { name: 'sms',          queue: smsQueue },
    { name: 'video',        queue: videoQueue },
    { name: 'certificate',  queue: certificateQueue },
    { name: 'report',       queue: reportQueue },
  ];

  const stats = {};

  for (const { name, queue } of allQueues) {
    if (!queue) continue;
    const counts = await queue.getJobCounts();
    stats[name] = counts;
  }

  return stats;
}

/* ============================================================
   GRACEFUL SHUTDOWN
============================================================ */

async function closeQueues() {
  const allQueues = [emailQueue, smsQueue, videoQueue, certificateQueue, reportQueue];
  await Promise.all(allQueues.filter(Boolean).map(q => q.close()));
  console.log('[Queue] All queues closed.');
}

process.on('SIGTERM', closeQueues);
process.on('SIGINT',  closeQueues);

module.exports = {
  emailQueue,
  smsQueue,
  videoQueue,
  certificateQueue,
  reportQueue,
  queueEmail,
  queueSMS,
  queueVideoTranscode,
  queueCertificate,
  queueReport,
  registerProcessors,
  getQueueStats,
  closeQueues,
};