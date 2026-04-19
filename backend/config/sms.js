/**
 * EduVerse — SMS Provider
 * config/sms.js
 *
 * Supports:
 * - Twilio (international)
 * - MSG91 (India)
 *
 * Provider selected by SMS_PROVIDER env variable.
 * Falls back gracefully if not configured — just logs.
 *
 * Templates built-in for all platform SMS types:
 * - OTP verification
 * - Fee payment reminder
 * - Low attendance alert
 * - Exam reminder
 * - Assignment deadline
 * - Welcome message
 */

'use strict';

const SMS_PROVIDER = process.env.SMS_PROVIDER || 'twilio';

/* ============================================================
   TWILIO PROVIDER
============================================================ */

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  }

  const twilio = require('twilio');
  return twilio(accountSid, authToken);
}

async function sendViaTwilio(to, message) {
  const client = getTwilioClient();
  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to:   to,
  });
  return { provider: 'twilio', sid: result.sid, status: result.status };
}

/* ============================================================
   MSG91 PROVIDER (India)
============================================================ */

async function sendViaMSG91(to, message) {
  const apiKey    = process.env.MSG91_API_KEY;
  const senderId  = process.env.MSG91_SENDER_ID || 'EDUVRS';

  if (!apiKey) throw new Error('MSG91_API_KEY not configured.');

  const https = require('https');
  const phone = to.replace(/^\+/, '').replace(/\D/g, '');

  const url = `https://api.msg91.com/api/sendhttp.php?authkey=${apiKey}&mobiles=${phone}&message=${encodeURIComponent(message)}&sender=${senderId}&route=4&country=91`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ provider: 'msg91', response: data }));
    }).on('error', reject);
  });
}

/* ============================================================
   MAIN SEND FUNCTION
============================================================ */

/**
 * Send an SMS message
 * @param {string} to   - Phone number with country code, e.g. +919876543210
 * @param {string} body - Message text (max 160 chars for single SMS)
 * @returns {object}    - Provider response
 */
async function sendSMS(to, body) {
  if (!to) {
    console.warn('[SMS] No phone number provided. Skipping SMS.');
    return { skipped: true, reason: 'no_phone' };
  }

  // In dev/test mode — just log
  if (process.env.NODE_ENV === 'development' && process.env.SMS_MOCK !== 'false') {
    console.log(`📱 [SMS Mock] To: ${to} | Message: ${body}`);
    return { mock: true, to, body };
  }

  try {
    let result;

    switch (SMS_PROVIDER) {
      case 'msg91':
        result = await sendViaMSG91(to, body);
        break;
      case 'twilio':
      default:
        result = await sendViaTwilio(to, body);
        break;
    }

    console.log(`📱 [SMS] Sent to ${to} via ${SMS_PROVIDER}`);
    return result;

  } catch (err) {
    // SMS failure should NEVER crash the main request
    console.error(`❌ [SMS] Failed to send to ${to}:`, err.message);
    return { error: err.message, to };
  }
}

/* ============================================================
   SMS TEMPLATES
   All platform SMS messages defined here.
   Keep messages short — ideally under 160 chars.
============================================================ */

const smsTemplates = {

  /**
   * OTP verification
   */
  otp: (otp) =>
    `Your EduVerse OTP is ${otp}. Valid for 10 minutes. Do not share this with anyone.`,

  /**
   * Welcome message after registration
   */
  welcome: (name, platform) =>
    `Welcome to ${platform || 'EduVerse'}, ${name}! Your account is ready. Start learning at eduverse.com`,

  /**
   * Low attendance alert — sent to student and parent
   */
  lowAttendance: (studentName, percentage, threshold) =>
    `Alert: ${studentName}'s attendance is ${percentage}%, below the required ${threshold}%. Please contact the institute.`,

  /**
   * Fee payment reminder
   */
  feeReminder: (studentName, amount, dueDate, instituteName) =>
    `Reminder: Fee of Rs.${amount} for ${studentName} at ${instituteName} is due on ${dueDate}. Pay now on EduVerse.`,

  /**
   * Exam scheduled notification
   */
  examReminder: (examTitle, date, time) =>
    `Reminder: "${examTitle}" is scheduled on ${date} at ${time}. Log in to EduVerse to prepare.`,

  /**
   * Assignment deadline reminder
   */
  assignmentReminder: (assignmentTitle, deadline) =>
    `Reminder: Assignment "${assignmentTitle}" is due by ${deadline}. Submit on EduVerse now.`,

  /**
   * Grade published
   */
  gradePublished: (studentName, assignmentTitle, score, maxScore) =>
    `Hi ${studentName}, your grade for "${assignmentTitle}" is ${score}/${maxScore}. View feedback on EduVerse.`,

  /**
   * Live session starting soon
   */
  liveSessionReminder: (title, time) =>
    `Your live class "${title}" starts at ${time}. Join on EduVerse. Don't be late!`,

  /**
   * New announcement from institute
   */
  announcement: (instituteName, title) =>
    `${instituteName}: New announcement — "${title}". Check EduVerse for details.`,

  /**
   * Certificate issued
   */
  certificateIssued: (studentName, courseName) =>
    `Congratulations ${studentName}! Your certificate for "${courseName}" is ready. Download on EduVerse.`,

  /**
   * Password reset
   */
  passwordReset: (name) =>
    `Hi ${name}, a password reset was requested for your EduVerse account. If not you, please contact support immediately.`,

};

/* ============================================================
   BULK SMS
   Send same message to multiple numbers.
   Rate-limited to avoid API throttling.
============================================================ */

/**
 * Send SMS to multiple recipients
 * @param {string[]} numbers  - Array of phone numbers
 * @param {string}   body     - Message text
 * @param {number}   delayMs  - Delay between sends (default 100ms)
 */
async function sendBulkSMS(numbers, body, delayMs = 100) {
  if (!numbers?.length) return [];

  const results = [];

  for (const num of numbers) {
    const result = await sendSMS(num, body);
    results.push({ phone: num, ...result });

    // Small delay to avoid hitting API rate limits
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

module.exports = {
  sendSMS,
  sendBulkSMS,
  smsTemplates,
};