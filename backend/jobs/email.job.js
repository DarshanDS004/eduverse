/**
 * EduVerse — Email Job Processor
 * jobs/email.job.js
 *
 * Processes all email send jobs from the email Bull queue.
 *
 * Job data shape:
 * {
 *   to:            string         // recipient email
 *   subject:       string         // email subject (used if no template)
 *   html:          string         // raw HTML (used if no template)
 *   template:      string         // template name (e.g. 'verifyEmail')
 *   templateArgs:  Array          // args passed to template function
 * }
 *
 * Examples of jobs pushed here:
 * - Email verification on registration
 * - Password reset link
 * - Fee payment reminder
 * - Grade published notification
 * - Weekly report email to institute admin
 */

'use strict';

const { sendMail, templates } = require('../config/mailer');

/**
 * Register this processor with the Bull queue
 * @param {Queue} queue - Bull email queue instance
 */
module.exports = function registerEmailProcessor(queue) {

  // Process up to 5 emails concurrently
  queue.process(5, async function (job) {
    const { to, subject, html, template, templateArgs } = job.data;

    if (!to) throw new Error('Email job missing "to" field.');

    let finalSubject = subject;
    let finalHtml    = html;

    // If a template name is provided, render it
    if (template && templates[template]) {
      const rendered = templates[template](...(templateArgs || []));
      finalSubject   = rendered.subject;
      finalHtml      = rendered.html;
    }

    if (!finalSubject || !finalHtml) {
      throw new Error(`Email job missing subject or html. template=${template}`);
    }

    await sendMail({
      to:      to,
      subject: finalSubject,
      html:    finalHtml,
    });

    return { sent: true, to, subject: finalSubject };
  });

  // Log progress
  queue.on('progress', (job, progress) => {
    console.log(`[EmailJob] Job ${job.id} is ${progress}% complete.`);
  });

};