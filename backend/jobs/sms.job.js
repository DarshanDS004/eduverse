/**
 * EduVerse — SMS Job Processor
 * jobs/sms.job.js
 *
 * Processes all SMS send jobs from the sms Bull queue.
 *
 * Job data shape:
 * {
 *   to:       string   // phone number with country code
 *   message:  string   // SMS message text
 *   template: string   // (optional) template name from smsTemplates
 *   args:     Array    // (optional) args for template function
 * }
 *
 * SMS jobs are triggered for:
 * - OTP verification
 * - Low attendance alerts
 * - Fee payment reminders
 * - Exam reminders (24hr before)
 * - Assignment deadline reminders
 * - Grade published notifications
 * - Welcome messages
 */

'use strict';

const { sendSMS, smsTemplates } = require('../config/sms');

/**
 * Register SMS processor with the Bull queue
 * @param {Queue} queue - Bull sms queue instance
 */
module.exports = function registerSMSProcessor(queue) {

  // Process up to 10 SMS concurrently
  queue.process(10, async function (job) {
    const { to, message, template, args } = job.data;

    if (!to) throw new Error('SMS job missing "to" field.');

    let finalMessage = message;

    // Render template if provided
    if (template && smsTemplates[template]) {
      finalMessage = smsTemplates[template](...(args || []));
    }

    if (!finalMessage) {
      throw new Error('SMS job has no message content.');
    }

    const result = await sendSMS(to, finalMessage);
    return { sent: true, to, result };
  });

};