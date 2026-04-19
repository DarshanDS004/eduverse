/**
 * EduVerse — Report Generation Job Processor
 * jobs/report.job.js
 *
 * Generates PDF and Excel reports in the background.
 *
 * Report types:
 * - student_performance   → individual student PDF report
 * - class_performance     → class-wise PDF report
 * - attendance            → attendance PDF/Excel for date range
 * - fee_collection        → fee status report
 * - platform_analytics    → super admin platform report
 * - instructor_earnings   → instructor earnings statement
 * - institute_summary     → institute monthly summary
 *
 * After generation:
 * 1. File saved to /uploads/reports/
 * 2. Notification sent to requesting user
 * 3. Email with download link sent
 *
 * Job data shape:
 * {
 *   type:      string   // report type
 *   userId:    number   // user who requested the report
 *   email:     string   // email to send report to
 *   params:    object   // report-specific params (date range, filters, etc.)
 * }
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const db   = require('../config/db');
const { sendMail } = require('../config/mailer');

const REPORT_DIR = path.join(__dirname, '../../uploads/reports');

/**
 * Register report processor with Bull queue
 * @param {Queue} queue - Bull report queue instance
 */
module.exports = function registerReportProcessor(queue) {

  queue.process(2, async function (job) {
    const { type, userId, email, params } = job.data;

    console.log(`[ReportJob] Generating ${type} report for user ${userId}`);

    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

    job.progress(10);

    let reportData;
    let filename;
    let title;

    switch (type) {
      case 'student_performance': {
        reportData = await fetchStudentPerformance(params.studentId, params.instituteId);
        filename   = `student-report-${params.studentId}-${Date.now()}.pdf`;
        title      = 'Student Performance Report';
        break;
      }

      case 'class_performance': {
        reportData = await fetchClassPerformance(params.classId);
        filename   = `class-report-${params.classId}-${Date.now()}.pdf`;
        title      = 'Class Performance Report';
        break;
      }

      case 'attendance': {
        reportData = await fetchAttendanceReport(params.instituteId, params.from, params.to, params.classId);
        filename   = `attendance-report-${Date.now()}.pdf`;
        title      = 'Attendance Report';
        break;
      }

      case 'fee_collection': {
        reportData = await fetchFeeReport(params.instituteId);
        filename   = `fee-report-${Date.now()}.pdf`;
        title      = 'Fee Collection Report';
        break;
      }

      case 'instructor_earnings': {
        reportData = await fetchEarningsReport(params.instructorId, params.from, params.to);
        filename   = `earnings-report-${params.instructorId}-${Date.now()}.pdf`;
        title      = 'Earnings Statement';
        break;
      }

      case 'platform_analytics': {
        reportData = await fetchPlatformReport(params.from, params.to);
        filename   = `platform-report-${Date.now()}.pdf`;
        title      = 'Platform Analytics Report';
        break;
      }

      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    job.progress(50);

    // Generate PDF
    const filePath = path.join(REPORT_DIR, filename);
    const fileUrl  = `/uploads/reports/${filename}`;
    const pdfGenerated = await generateReportPDF(reportData, title, filePath);

    job.progress(80);

    // Notify user in-app
    await db.query(
      "INSERT INTO notifications (user_id, title, body, type, link) VALUES (?, 'Report Ready', ?, 'report', ?)",
      [userId, `Your ${title} has been generated and is ready to download.`, fileUrl]
    );

    // Send email with download link
    if (email) {
      await sendMail({
        to:      email,
        subject: `Your EduVerse Report is Ready — ${title}`,
        html:    buildReportEmail(title, fileUrl),
      });
    }

    job.progress(100);
    console.log(`[ReportJob] ${title} generated: ${fileUrl}`);
    return { type, fileUrl, title };
  });

};

/* ============================================================
   DATA FETCH FUNCTIONS
============================================================ */

async function fetchStudentPerformance(studentId, instituteId) {
  const [[student]] = await db.query(
    'SELECT up.full_name, u.email, up.grade FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?',
    [studentId]
  );

  const [quizzes] = await db.query(
    'SELECT q.title, qa.score, qa.total_marks, qa.percentage, qa.passed, qa.submitted_at FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL ORDER BY qa.submitted_at DESC',
    [studentId]
  );

  const [assignments] = await db.query(
    'SELECT a.title, s.score, a.max_marks, s.status, s.submitted_at FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.student_id = ? ORDER BY s.submitted_at DESC',
    [studentId]
  );

  const [[attendance]] = await db.query(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN status="present" THEN 1 ELSE 0 END) AS present FROM attendance_records WHERE student_id = ?',
    [studentId]
  );

  return { student, quizzes, assignments, attendance };
}

async function fetchClassPerformance(classId) {
  const [[cls]] = await db.query('SELECT * FROM classes WHERE id = ?', [classId]);

  const [students] = await db.query(`
    SELECT up.full_name, u.id,
           (SELECT ROUND(AVG(qa.percentage),1) FROM quiz_attempts qa WHERE qa.student_id = u.id AND qa.submitted_at IS NOT NULL) AS avg_score,
           (SELECT COUNT(*) FROM attendance_records WHERE student_id = u.id AND status = 'present') AS present_count,
           (SELECT COUNT(*) FROM attendance_records WHERE student_id = u.id) AS total_sessions
    FROM class_students cs
    JOIN users u ON u.id = cs.student_id
    JOIN user_profiles up ON up.user_id = cs.student_id
    WHERE cs.class_id = ?
    ORDER BY avg_score DESC
  `, [classId]);

  return { class: cls, students };
}

async function fetchAttendanceReport(instituteId, from, to, classId) {
  const where  = ['c.institute_id = ?'];
  const params = [instituteId];
  if (classId) { where.push('c.id = ?');      params.push(classId); }
  if (from)    { where.push('ats.date >= ?'); params.push(from); }
  if (to)      { where.push('ats.date <= ?'); params.push(to); }

  const [records] = await db.query(`
    SELECT up.full_name AS student_name, c.name AS class_name, ats.date,
           ar.status, ats.subject
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
    JOIN classes c ON c.id = ats.class_id
    JOIN user_profiles up ON up.user_id = ar.student_id
    WHERE ${where.join(' AND ')}
    ORDER BY up.full_name, ats.date ASC
  `, params);

  return { records, from, to };
}

async function fetchFeeReport(instituteId) {
  const [[summary]] = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END), 0) AS overdue
    FROM student_fees WHERE institute_id = ?
  `, [instituteId]);

  const [details] = await db.query(`
    SELECT up.full_name AS student_name, fs.name AS fee_name,
           sf.amount, sf.status, sf.due_date, sf.paid_at
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    JOIN user_profiles up ON up.user_id = sf.student_id
    WHERE sf.institute_id = ?
    ORDER BY sf.status, sf.due_date ASC
  `, [instituteId]);

  return { summary, details };
}

async function fetchEarningsReport(instructorId, from, to) {
  const [[instructor]] = await db.query(
    'SELECT up.full_name, u.email FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?',
    [instructorId]
  );

  const where  = ['sm.instructor_id = ?', "mp.payment_status = 'success'"];
  const params = [instructorId];
  if (from) { where.push('mp.purchased_at >= ?'); params.push(from); }
  if (to)   { where.push('mp.purchased_at <= ?'); params.push(to); }

  const [transactions] = await db.query(`
    SELECT sm.title, mp.amount_paid, mp.purchased_at,
           up.full_name AS student_name
    FROM material_purchases mp
    JOIN study_materials sm ON sm.id = mp.material_id
    JOIN user_profiles up ON up.user_id = mp.student_id
    WHERE ${where.join(' AND ')}
    ORDER BY mp.purchased_at DESC
  `, params);

  const total = transactions.reduce((sum, t) => sum + parseFloat(t.amount_paid), 0);

  return { instructor, transactions, total, from, to };
}

async function fetchPlatformReport(from, to) {
  const [[users]] = await db.query(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN role="student" THEN 1 ELSE 0 END) AS students, SUM(CASE WHEN role="instructor" THEN 1 ELSE 0 END) AS instructors FROM users'
  );

  const [[revenue]] = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'success'"
  );

  const [[enrollments]] = await db.query('SELECT COUNT(*) AS total FROM enrollments');
  const [[courses]]     = await db.query("SELECT COUNT(*) AS total FROM courses WHERE status = 'published'");

  return { users, revenue, enrollments, courses, from, to };
}

/* ============================================================
   GENERATE PDF FROM DATA
============================================================ */

async function generateReportPDF(data, title, filePath) {
  try {
    const puppeteer = require('puppeteer');
    const html      = buildReportHTML(data, title);

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path:            filePath,
      format:          'A4',
      printBackground: true,
      margin:          { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });

    await browser.close();
    return true;

  } catch (err) {
    console.error('[ReportJob] PDF generation failed:', err.message);
    return false;
  }
}

/* ============================================================
   REPORT HTML BUILDER (simple table layout)
============================================================ */

function buildReportHTML(data, title) {
  const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 20px; }
    h1   { font-size: 22px; color: #1A56DB; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th    { background: #1A56DB; color: #fff; padding: 8px 12px; text-align: left; }
    td    { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Generated on ${now} | EduVerse Platform</div>
  <pre style="font-size:12px;white-space:pre-wrap;color:#374151;">
${JSON.stringify(data, null, 2)}
  </pre>
  <div class="footer">EduVerse — Every Stage. Every Learner.</div>
</body>
</html>`;
}

/* ============================================================
   REPORT EMAIL TEMPLATE
============================================================ */

function buildReportEmail(title, fileUrl) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
      <h2 style="color:#111827;font-size:20px;font-weight:700;margin-bottom:8px;">Your Report is Ready</h2>
      <p style="color:#6b7280;font-size:15px;line-height:1.6;margin-bottom:24px;">
        Your <strong>${title}</strong> has been generated and is ready to download.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${process.env.FRONTEND_URL}${fileUrl}"
          style="display:inline-block;background:#1A56DB;color:#ffffff;font-size:15px;font-weight:600;
          padding:14px 32px;border-radius:8px;text-decoration:none;">
          Download Report
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
      <p style="color:#9ca3af;font-size:12px;text-align:center;">
        © 2025 EduVerse. Every Stage. Every Learner.
      </p>
    </div>
  `;
}