/**
 * EduVerse — Certificate Generation Job Processor
 * jobs/certificate.job.js
 *
 * Generates PDF certificates for students after course completion.
 *
 * Approach:
 * 1. Load the HTML certificate template from the DB
 * 2. Inject student name, course title, date, certificate code
 * 3. Render to PDF using Puppeteer (headless Chrome)
 * 4. Save PDF to storage (/uploads/certificates/)
 * 5. Update the certificate record in DB with file_url
 * 6. Send email + notification to student
 *
 * Job data shape:
 * {
 *   certificateId: number   // certificates.id
 *   studentId:     number   // student user ID
 *   courseId:      number   // course ID (nullable for institute certs)
 *   type:          string   // 'course_completion' | 'transfer' | 'bonafide'
 * }
 *
 * NOTE: Puppeteer must be installed for PDF generation.
 * npm install puppeteer
 * For servers without Chrome: npm install puppeteer-core + chromium
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const db   = require('../config/db');
const { sendMail } = require('../config/mailer');

/* ── Output directory for certificate PDFs ── */
const CERT_DIR = path.join(__dirname, '../../uploads/certificates');

/**
 * Register certificate processor with Bull queue
 * @param {Queue} queue - Bull certificate queue instance
 */
module.exports = function registerCertificateProcessor(queue) {

  queue.process(3, async function (job) {
    const { certificateId, studentId, courseId, type } = job.data;

    console.log(`[CertJob] Generating certificate ${certificateId} for student ${studentId}`);

    // Fetch certificate + student + course info
    const [[cert]] = await db.query(
      'SELECT * FROM certificates WHERE id = ?',
      [certificateId]
    );
    if (!cert) throw new Error(`Certificate ${certificateId} not found.`);

    const [[student]] = await db.query(
      'SELECT up.full_name, u.email FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?',
      [studentId]
    );
    if (!student) throw new Error(`Student ${studentId} not found.`);

    let courseTitle = null;
    let instructorName = null;

    if (courseId) {
      const [[course]] = await db.query(
        'SELECT c.title, up.full_name AS instructor_name FROM courses c JOIN user_profiles up ON up.user_id = c.instructor_id WHERE c.id = ?',
        [courseId]
      );
      courseTitle    = course?.title;
      instructorName = course?.instructor_name;
    }

    job.progress(20);

    // Load certificate template
    const templateHtml = await loadTemplate(cert, type);

    job.progress(30);

    // Inject variables into template
    const issuedDate = new Date(cert.issued_at).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const finalHtml = templateHtml
      .replace(/\{\{student_name\}\}/g,    student.full_name || '')
      .replace(/\{\{course_title\}\}/g,    courseTitle || cert.title || '')
      .replace(/\{\{instructor_name\}\}/g, instructorName || '')
      .replace(/\{\{issued_date\}\}/g,     issuedDate)
      .replace(/\{\{certificate_code\}\}/g, cert.certificate_code)
      .replace(/\{\{verify_url\}\}/g,
        `${process.env.FRONTEND_URL}/pages/auth/verify-cert.html?code=${cert.certificate_code}`
      );

    job.progress(40);

    // Ensure output directory exists
    if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

    const filename = `cert-${certificateId}-${cert.certificate_code}.pdf`;
    const filePath = path.join(CERT_DIR, filename);
    const fileUrl  = `/uploads/certificates/${filename}`;

    // Generate PDF using Puppeteer
    const pdfGenerated = await generatePDF(finalHtml, filePath);

    job.progress(80);

    if (pdfGenerated) {
      // Update certificate record with file URL
      await db.query(
        'UPDATE certificates SET file_url = ? WHERE id = ?',
        [fileUrl, certificateId]
      );
    }

    // Notify student in-app
    await db.query(
      "INSERT INTO notifications (user_id, title, body, type, link) VALUES (?, '🎉 Certificate Ready!', ?, 'certificate', ?)",
      [
        studentId,
        `Your certificate for "${courseTitle || cert.title}" is ready to download!`,
        `/pages/student/certificates.html`,
      ]
    );

    // Send email with certificate
    await sendMail({
      to:      student.email,
      subject: `Your EduVerse Certificate — ${courseTitle || cert.title}`,
      html:    buildCertificateEmail(student.full_name, courseTitle || cert.title, fileUrl, cert.certificate_code),
    });

    job.progress(100);

    console.log(`[CertJob] Certificate ${certificateId} generated successfully.`);
    return { certificateId, fileUrl, sent_to: student.email };
  });

};

/* ============================================================
   LOAD HTML TEMPLATE
   Priority: DB template → institute template → default template
============================================================ */

async function loadTemplate(cert, type) {
  // Try institute-specific template first
  if (cert.institute_id) {
    const [[instTmpl]] = await db.query(
      'SELECT template_html FROM certificate_templates WHERE institute_id = ? LIMIT 1',
      [cert.institute_id]
    );
    if (instTmpl?.template_html) return instTmpl.template_html;
  }

  // Try platform default template
  const [[defaultTmpl]] = await db.query(
    'SELECT template_html FROM certificate_templates WHERE institute_id IS NULL AND is_default = 1 LIMIT 1'
  );
  if (defaultTmpl?.template_html) return defaultTmpl.template_html;

  // Hardcoded fallback HTML template
  return getBuiltinTemplate(type);
}

/* ============================================================
   BUILT-IN CERTIFICATE HTML TEMPLATE (fallback)
============================================================ */

function getBuiltinTemplate(type) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 1122px; height: 794px;
      font-family: 'Inter', sans-serif;
      background: #ffffff;
      display: flex; align-items: center; justify-content: center;
    }

    .cert {
      width: 100%; height: 100%;
      border: 16px solid #1A56DB;
      padding: 60px 80px;
      position: relative;
      text-align: center;
    }

    .cert::before {
      content: '';
      position: absolute; inset: 24px;
      border: 2px solid rgba(26,86,219,0.2);
      pointer-events: none;
    }

    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 28px; font-weight: 700;
      color: #1A56DB; margin-bottom: 8px;
    }

    .tagline {
      font-size: 13px; color: #6b7280;
      letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 40px;
    }

    .cert-type {
      font-size: 13px; color: #6b7280;
      letter-spacing: 0.1em; text-transform: uppercase;
      margin-bottom: 16px;
    }

    .cert-title {
      font-family: 'Playfair Display', serif;
      font-size: 42px; color: #111827;
      margin-bottom: 32px; line-height: 1.2;
    }

    .awarded-to { font-size: 15px; color: #6b7280; margin-bottom: 12px; }

    .student-name {
      font-family: 'Playfair Display', serif;
      font-size: 36px; color: #1A56DB;
      border-bottom: 2px solid #1A56DB;
      display: inline-block; padding-bottom: 8px;
      margin-bottom: 24px;
    }

    .course-label { font-size: 14px; color: #6b7280; margin-bottom: 8px; }

    .course-name {
      font-size: 22px; font-weight: 600;
      color: #111827; margin-bottom: 40px;
    }

    .footer {
      display: flex; justify-content: space-between;
      align-items: flex-end; margin-top: 40px;
    }

    .sign-block { text-align: center; }
    .sign-line { width: 180px; border-bottom: 1px solid #374151; margin-bottom: 6px; }
    .sign-label { font-size: 12px; color: #6b7280; }

    .cert-id {
      position: absolute; bottom: 30px; right: 40px;
      font-size: 10px; color: #9ca3af; font-family: monospace;
    }
  </style>
</head>
<body>
<div class="cert">
  <div class="logo">EduVerse</div>
  <div class="tagline">Every Stage. Every Learner.</div>

  <div class="cert-type">Certificate of Completion</div>
  <div class="cert-title">Certificate of Completion</div>

  <div class="awarded-to">This is to certify that</div>
  <div class="student-name">{{student_name}}</div>

  <div class="course-label">has successfully completed the course</div>
  <div class="course-name">{{course_title}}</div>

  <div class="footer">
    <div class="sign-block">
      <div class="sign-line"></div>
      <div class="sign-label">{{instructor_name}}</div>
      <div class="sign-label" style="font-size:11px;color:#9ca3af;">Instructor</div>
    </div>
    <div style="text-align:center;">
      <div style="font-size:20px;font-weight:700;color:#1A56DB;font-family:monospace;">{{certificate_code}}</div>
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Issued on {{issued_date}}</div>
    </div>
    <div class="sign-block">
      <div class="sign-line"></div>
      <div class="sign-label">EduVerse Platform</div>
      <div class="sign-label" style="font-size:11px;color:#9ca3af;">Authorized Signatory</div>
    </div>
  </div>

  <div class="cert-id">Verify at: {{verify_url}}</div>
</div>
</body>
</html>`;
}

/* ============================================================
   GENERATE PDF WITH PUPPETEER
============================================================ */

async function generatePDF(html, outputPath) {
  try {
    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path:      outputPath,
      format:    'A4',
      landscape: true,
      printBackground: true,
      margin:    { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();
    return true;

  } catch (err) {
    console.error('[CertJob] PDF generation failed (puppeteer error):', err.message);
    console.warn('[CertJob] Certificate saved without PDF. Install puppeteer to enable PDF generation.');
    return false;
  }
}

/* ============================================================
   CERTIFICATE EMAIL TEMPLATE
============================================================ */

function buildCertificateEmail(name, courseTitle, fileUrl, code) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:48px;">🎉</div>
        <h1 style="font-size:24px;font-weight:800;color:#111827;margin:12px 0 0;">Congratulations, ${name}!</h1>
      </div>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px;text-align:center;">
        You have successfully completed <strong>${courseTitle}</strong> on EduVerse.
        Your certificate is ready to download.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${process.env.FRONTEND_URL}/pages/student/certificates.html"
          style="display:inline-block;background:#1A56DB;color:#ffffff;font-size:15px;font-weight:600;
          padding:14px 32px;border-radius:8px;text-decoration:none;">
          Download Certificate
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;">
        Certificate ID: <strong>${code}</strong>
        <br/>Anyone can verify this certificate at ${process.env.FRONTEND_URL}/verify?code=${code}
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
      <p style="color:#9ca3af;font-size:12px;text-align:center;">
        © 2025 EduVerse. Every Stage. Every Learner.
      </p>
    </div>
  `;
}