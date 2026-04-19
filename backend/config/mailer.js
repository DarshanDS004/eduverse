/**
 * EduVerse — Nodemailer Config
 * config/mailer.js
 *
 * Merges original mailer.js (templates, transporter) with crash fixes:
 *
 *  FIX 1 — transporter.verify() is now wrapped in try-catch.
 *           Without this, missing MAIL_USER/MAIL_PASS causes a synchronous
 *           throw during require(), which makes institute.routes return {}
 *           instead of a router, crashing the server on startup with:
 *           "Router.use() requires a middleware function but got a Object"
 *
 *  FIX 2 — sendMail() no longer re-throws on SMTP failure.
 *           Previously any email error would bubble up and fail the API route
 *           that triggered it (e.g. addStudent failed because welcome email bounced).
 *           Now it logs and returns null — the route always succeeds.
 *
 *  FIX 3 — sendMail() now accepts { to, subject, html, text, from }
 *           (original only accepted to/subject/html — institute.service.js
 *           also passes 'text' and 'from' overrides which were silently dropped).
 *
 *  ADDED — welcomeStudent, welcomeTeacher, feeReminder templates
 *           (used by institute.service.js — cleaner than inline HTML strings).
 *
 * Required .env vars (all optional — server works without them):
 *   MAIL_HOST   e.g. smtp.gmail.com
 *   MAIL_PORT   e.g. 587
 *   MAIL_USER   e.g. you@gmail.com
 *   MAIL_PASS   your App Password (Gmail) or SMTP password
 *   MAIL_FROM   e.g. "EduVerse <noreply@eduverse.com>"
 */

'use strict';

const nodemailer = require('nodemailer');

/* ══════════════════════════════════════════════════════════════
   TRANSPORTER
══════════════════════════════════════════════════════════════ */
const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.MAIL_PORT) || 587,
  secure: parseInt(process.env.MAIL_PORT) === 465,   // true only for port 465
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
});

/* ── Verify connection on startup ────────────────────────────────────────────
   FIX 1: Wrapped in try-catch so missing credentials never crash the server.
   Without this wrapper, nodemailer throws synchronously during require(),
   which propagates up through institute.service → controller → routes,
   making institute.routes export {} and Express crash with
   "Router.use() requires a middleware function but got a Object". */
try {
  transporter.verify(function (err) {
    if (err) {
      console.warn('[Mailer] SMTP not configured or unreachable:', err.message);
      console.warn('[Mailer] Emails will be logged to console only.');
      console.warn('[Mailer] To enable real emails set MAIL_HOST / MAIL_USER / MAIL_PASS in .env');
    } else {
      console.log('✅ Mail server connected —', process.env.MAIL_USER);
    }
  });
} catch (e) {
  console.warn('[Mailer] transporter.verify threw synchronously:', e.message);
}

/* ══════════════════════════════════════════════════════════════
   sendMail
══════════════════════════════════════════════════════════════ */
/**
 * Send an email. Never throws — SMTP failures are logged and return null.
 *
 * @param {object} opts
 * @param {string}   opts.to       — recipient address(es)
 * @param {string}   opts.subject  — subject line
 * @param {string}   [opts.html]   — HTML body
 * @param {string}   [opts.text]   — plain-text body (fallback)
 * @param {string}   [opts.from]   — override sender (uses MAIL_FROM env by default)
 * @returns {Promise<object|null>}
 */
async function sendMail({ to, subject, html, text, from }) {
  const mailOptions = {
    from:    from || process.env.MAIL_FROM || 'EduVerse <noreply@eduverse.com>',
    to,
    subject,
    html:    html || undefined,
    text:    text || undefined,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent to:', to, '| ID:', info.messageId);
    return info;
  } catch (err) {
    /* FIX 2: Never re-throw — a failed email must not fail the API response.
       e.g. addStudent must succeed even if the welcome email bounces. */
    console.error('❌ Email send failed to', to, '—', err.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
   Usage: const { subject, html } = templates.verifyEmail(name, url);
          await sendMail({ to: email, ...templates.verifyEmail(name, url) });
══════════════════════════════════════════════════════════════ */
const templates = {

  /* ── Account verification ── */
  verifyEmail: function (name, verifyUrl) {
    return {
      subject: 'Verify your EduVerse account',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
              border-radius:12px;width:48px;height:48px;line-height:48px;
              text-align:center;font-size:24px;font-weight:800;color:#fff;">E</div>
            <h1 style="font-size:22px;font-weight:800;color:#111827;margin:12px 0 0;">EduVerse</h1>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">Welcome, ${name}! 👋</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Thanks for creating your EduVerse account. Please verify your email address to get started.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${verifyUrl}" style="display:inline-block;background:#1A56DB;color:#ffffff;
              font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
              Verify Email Address
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
            This link expires in <strong>24 hours</strong>. If you didn't create an account, ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">© 2025 EduVerse. Every Stage. Every Learner.</p>
        </div>`,
    };
  },

  /* ── Password reset ── */
  resetPassword: function (name, resetUrl) {
    return {
      subject: 'Reset your EduVerse password',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
              border-radius:12px;width:48px;height:48px;line-height:48px;
              text-align:center;font-size:24px;font-weight:800;color:#fff;">E</div>
            <h1 style="font-size:22px;font-weight:800;color:#111827;margin:12px 0 0;">EduVerse</h1>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">Password Reset Request</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Hi ${name}, we received a request to reset your password. Click below to set a new one.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:#1A56DB;color:#ffffff;
              font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
              Reset Password
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
            This link expires in <strong>1 hour</strong>. If you didn't request a reset, ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">© 2025 EduVerse. Every Stage. Every Learner.</p>
        </div>`,
    };
  },

  /* ── Institute: new student welcome ── */
  welcomeStudent: function (name, instituteName, tempPassword) {
    return {
      subject: `Welcome to ${instituteName} — EduVerse`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
              border-radius:12px;width:48px;height:48px;line-height:48px;
              text-align:center;font-size:24px;font-weight:800;color:#fff;">E</div>
            <h1 style="font-size:22px;font-weight:800;color:#111827;margin:12px 0 0;">EduVerse</h1>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">Welcome, ${name}! 🎓</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:16px;">
            You have been added to <strong>${instituteName}</strong> on EduVerse.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:600;">Your temporary password:</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#1A56DB;letter-spacing:2px;">${tempPassword}</p>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;">Please log in and change your password immediately.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">© 2025 EduVerse. Every Stage. Every Learner.</p>
        </div>`,
    };
  },

  /* ── Institute: new teacher welcome ── */
  welcomeTeacher: function (name, instituteName, tempPassword) {
    return {
      subject: `You've been added as a teacher at ${instituteName} — EduVerse`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
              border-radius:12px;width:48px;height:48px;line-height:48px;
              text-align:center;font-size:24px;font-weight:800;color:#fff;">E</div>
            <h1 style="font-size:22px;font-weight:800;color:#111827;margin:12px 0 0;">EduVerse</h1>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">Welcome, ${name}! 👩‍🏫</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:16px;">
            You have been added as a teacher at <strong>${instituteName}</strong> on EduVerse.
          </p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:600;">Your temporary password:</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#1A56DB;letter-spacing:2px;">${tempPassword}</p>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;">Please log in and change your password immediately.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">© 2025 EduVerse. Every Stage. Every Learner.</p>
        </div>`,
    };
  },

  /* ── Institute: fee payment reminder ── */
  feeReminder: function (name, amount, dueDate, instituteName) {
    return {
      subject: `Fee Payment Reminder — ${instituteName}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#1d4ed8);
              border-radius:12px;width:48px;height:48px;line-height:48px;
              text-align:center;font-size:24px;font-weight:800;color:#fff;">E</div>
            <h1 style="font-size:22px;font-weight:800;color:#111827;margin:12px 0 0;">EduVerse</h1>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">Fee Payment Reminder</h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:16px;">
            Dear ${name}, a fee payment is due for your account at <strong>${instituteName}</strong>.
          </p>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:14px;color:#92400e;font-weight:600;">Amount Due:</p>
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#92400e;">₹${amount}</p>
            <p style="margin:0;font-size:13px;color:#92400e;">Due Date: <strong>${dueDate}</strong></p>
          </div>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;">
            Please log in to EduVerse to complete your payment and avoid late fees.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">© 2025 EduVerse. Every Stage. Every Learner.</p>
        </div>`,
    };
  },

};

module.exports = { sendMail, templates };