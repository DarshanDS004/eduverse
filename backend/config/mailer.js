/**
 * EduVerse — Nodemailer Config
 * config/mailer.js
 */

'use strict';

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST || 'smtp.gmail.com',
  port:   process.env.MAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Test connection on startup
transporter.verify(function (err, success) {
  if (err) {
    console.error('❌ Mail server connection failed:', err.message);
  } else {
    console.log('✅ Mail server connected —', process.env.MAIL_USER);
  }
});

/**
 * Send an email
 * sendMail({ to, subject, html })
 */
async function sendMail({ to, subject, html }) {
  const mailOptions = {
    from:    process.env.MAIL_FROM || 'EduVerse <noreply@eduverse.com>',
    to:      to,
    subject: subject,
    html:    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 Email sent to:', to, '| ID:', info.messageId);
    return info;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    throw err;
  }
}

/**
 * Email templates
 */
const templates = {

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
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">
            Welcome, ${name}! 👋
          </h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Thanks for creating your EduVerse account. Please verify your email address to get started.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${verifyUrl}"
              style="display:inline-block;background:#1A56DB;color:#ffffff;
              font-size:15px;font-weight:600;padding:14px 32px;
              border-radius:8px;text-decoration:none;">
              Verify Email Address
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
            This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">
            © 2025 EduVerse. Every Stage. Every Learner.
          </p>
        </div>
      `,
    };
  },

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
          <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px;">
            Password Reset Request
          </h2>
          <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px;">
            Hi ${name}, we received a request to reset your password. Click the button below to set a new one.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}"
              style="display:inline-block;background:#1A56DB;color:#ffffff;
              font-size:15px;font-weight:600;padding:14px 32px;
              border-radius:8px;text-decoration:none;">
              Reset Password
            </a>
          </div>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;text-align:center;">
            © 2025 EduVerse. Every Stage. Every Learner.
          </p>
        </div>
      `,
    };
  },

};

module.exports = { sendMail, templates };