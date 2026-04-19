/**
 * EduVerse — Super Admin Service
 * modules/superadmin/superadmin.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const { sendMail, templates } = require('../../config/mailer');
const { v4: uuidv4 } = require('uuid');
const os           = require('os');

/* ============================================================
   DASHBOARD
============================================================ */

async function getDashboard() {

  // Platform-wide stats
  const [[stats]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role != 'superadmin') AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'student')     AS total_students,
      (SELECT COUNT(*) FROM users WHERE role = 'instructor')  AS total_instructors,
      (SELECT COUNT(*) FROM institutes)                       AS total_institutes,
      (SELECT COUNT(*) FROM courses WHERE status = 'published') AS total_courses,
      (SELECT COUNT(*) FROM institutes WHERE status = 'pending') AS pending_institutes,
      (SELECT COUNT(*) FROM courses WHERE status = 'pending_review') AS pending_courses,
      (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS open_tickets,
      (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) AS signups_today,
      (SELECT COALESCE(SUM(amount), 0) FROM payments
        WHERE status = 'success' AND DATE(created_at) = CURDATE()) AS revenue_today,
      (SELECT COALESCE(SUM(amount), 0) FROM payments
        WHERE status = 'success' AND MONTH(created_at) = MONTH(NOW())
        AND YEAR(created_at) = YEAR(NOW())) AS revenue_this_month
  `);

  // Revenue trend — last 30 days
  const [revenueTrend] = await db.query(`
    SELECT DATE_FORMAT(created_at, '%d %b') AS label,
           COALESCE(SUM(amount), 0) AS amount
    FROM payments
    WHERE status = 'success'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `);

  // Recent signups
  const [recentUsers] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.role, u.created_at
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    ORDER BY u.created_at DESC
    LIMIT 8
  `);

  // Top courses by enrollment
  const [topCourses] = await db.query(`
    SELECT c.id, c.title, c.enrolled_count, c.avg_rating,
           up.full_name AS instructor_name
    FROM courses c
    JOIN user_profiles up ON up.user_id = c.instructor_id
    WHERE c.status = 'published'
    ORDER BY c.enrolled_count DESC
    LIMIT 5
  `);

  // Pending institutes
  const [pendingInstitutes] = await db.query(`
    SELECT i.id, i.name, i.type, i.city, i.created_at,
           up.full_name AS owner_name
    FROM institutes i
    JOIN user_profiles up ON up.user_id = i.user_id
    WHERE i.status = 'pending'
    ORDER BY i.created_at ASC
    LIMIT 5
  `);

  // Server health (basic)
  const serverHealth = {
    uptime_seconds: process.uptime(),
    memory_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    memory_total_mb: Math.round(os.totalmem() / 1024 / 1024),
    cpu_count: os.cpus().length,
    platform: os.platform(),
    node_version: process.version,
  };

  return {
    stats: {
      total_users:        stats.total_users        || 0,
      total_students:     stats.total_students     || 0,
      total_instructors:  stats.total_instructors  || 0,
      total_institutes:   stats.total_institutes   || 0,
      total_courses:      stats.total_courses      || 0,
      pending_institutes: stats.pending_institutes || 0,
      pending_courses:    stats.pending_courses    || 0,
      open_tickets:       stats.open_tickets       || 0,
      signups_today:      stats.signups_today      || 0,
      revenue_today:      parseFloat(stats.revenue_today      || 0),
      revenue_this_month: parseFloat(stats.revenue_this_month || 0),
    },
    revenue_trend:      revenueTrend,
    recent_users:       recentUsers,
    top_courses:        topCourses,
    pending_institutes: pendingInstitutes,
    server_health:      serverHealth,
  };
}

/* ============================================================
   USER MANAGEMENT
============================================================ */

async function getUsers(filters) {
  const { q, role, status, page, per_page, date_from, date_to } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ["u.role != 'superadmin'"];
  const params = [];

  if (q) {
    where.push('(up.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (role)      { where.push('u.role = ?');       params.push(role); }
  if (status === 'active')   where.push('u.is_active = 1');
  if (status === 'inactive') where.push('u.is_active = 0');
  if (date_from) { where.push('DATE(u.created_at) >= ?'); params.push(date_from); }
  if (date_to)   { where.push('DATE(u.created_at) <= ?'); params.push(date_to); }

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           u.role, u.is_active, u.is_verified,
           u.created_at, u.last_login_at,
           up.photo_url AS avatar
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    ${whereSQL}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(*) AS total FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    ${whereSQL}
  `, params);

  return {
    users: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function getUser(userId) {
  const [[user]] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           u.role, u.is_active, u.is_verified, u.created_at,
           up.photo_url AS avatar, up.bio, up.city, up.state,
           up.subject, up.qualification, up.institute_name
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = ?
  `, [userId]);

  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
  return user;
}

async function updateUserStatus(userId, status, adminId, ip) {
  const isActive = status === 'active' ? 1 : 0;
  await db.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, userId]);
  await _auditLog(adminId, `user_${status}`, 'user', userId, ip);
  return { message: `User ${status}.` };
}

async function verifyUser(userId) {
  await db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [userId]);
  return { message: 'User verified.' };
}

async function resetUserPassword(userId) {
  const [[user]] = await db.query(
    'SELECT u.email, up.full_name FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?',
    [userId]
  );
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);
  await db.query('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]);

  const resetUrl = `${process.env.FRONTEND_URL}/pages/auth/reset-password.html?token=${token}`;
  const tmpl     = templates.resetPassword(user.full_name, resetUrl);
  await sendMail({ to: user.email, subject: tmpl.subject, html: tmpl.html });

  return { message: 'Password reset link sent.' };
}

async function deleteUser(userId, adminId, ip) {
  const [[user]] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');
  if (user.role === 'superadmin') throw new AppError('Cannot delete superadmin.', 403, 'FORBIDDEN');

  await db.query('DELETE FROM users WHERE id = ?', [userId]);
  await _auditLog(adminId, 'user_deleted', 'user', userId, ip);
  return { message: 'User deleted.' };
}

/* ============================================================
   INSTITUTE MANAGEMENT
============================================================ */

async function getInstitutes(filters) {
  const { q, status, type, plan, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = [];
  const params = [];

  if (q)      { where.push('(i.name LIKE ? OR u.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (status) { where.push('i.status = ?');            params.push(status); }
  if (type)   { where.push('i.type = ?');              params.push(type); }
  if (plan)   { where.push('i.subscription_plan = ?'); params.push(plan); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(`
    SELECT i.id, i.name, i.type, i.status, i.city,
           i.subscription_plan, i.subscription_end,
           i.created_at, u.email,
           up.full_name AS owner_name,
           (SELECT COUNT(*) FROM institute_members
            WHERE institute_id = i.id AND role = 'student') AS student_count
    FROM institutes i
    JOIN users u ON u.id = i.user_id
    JOIN user_profiles up ON up.user_id = i.user_id
    ${whereSQL}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(*) AS total FROM institutes i
    JOIN users u ON u.id = i.user_id
    ${whereSQL}
  `, params);

  return {
    institutes: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function getInstitute(instituteId) {
  const [[inst]] = await db.query(`
    SELECT i.*, up.full_name AS owner_name, u.email AS owner_email,
           (SELECT COUNT(*) FROM institute_members WHERE institute_id = i.id AND role = 'student') AS student_count,
           (SELECT COUNT(*) FROM institute_members WHERE institute_id = i.id AND role = 'teacher')  AS teacher_count
    FROM institutes i
    JOIN users u ON u.id = i.user_id
    JOIN user_profiles up ON up.user_id = i.user_id
    WHERE i.id = ?
  `, [instituteId]);

  if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');
  return inst;
}

async function approveInstitute(instituteId, adminId) {
  const [[inst]] = await db.query(
    'SELECT i.*, u.email, up.full_name FROM institutes i JOIN users u ON u.id = i.user_id JOIN user_profiles up ON up.user_id = i.user_id WHERE i.id = ?',
    [instituteId]
  );
  if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');

  const now   = new Date();
  const end   = new Date(now);
  end.setMonth(end.getMonth() + 1); // 1 month default

  await db.query(`
    UPDATE institutes SET status = 'active', approved_by = ?, approved_at = NOW(),
    subscription_start = ?, subscription_end = ?
    WHERE id = ?
  `, [adminId, now, end, instituteId]);

  // Activate institute user
  await db.query('UPDATE users SET is_active = 1 WHERE id = ?', [inst.user_id]);

  // Send approval email
  await sendMail({
    to:      inst.email,
    subject: 'Your EduVerse Institute Account is Approved!',
    html:    `<p>Hi ${inst.full_name}, your institute <strong>${inst.name}</strong> has been approved. You can now log in and start managing your institution.</p>`,
  });

  return { message: 'Institute approved.' };
}

async function rejectInstitute(instituteId, reason, adminId) {
  await db.query(
    "UPDATE institutes SET status = 'rejected', rejection_reason = ?, approved_by = ? WHERE id = ?",
    [reason || 'Did not meet requirements.', adminId, instituteId]
  );

  const [[inst]] = await db.query(
    'SELECT i.name, u.email, up.full_name FROM institutes i JOIN users u ON u.id = i.user_id JOIN user_profiles up ON up.user_id = i.user_id WHERE i.id = ?',
    [instituteId]
  );
  if (inst) {
    await sendMail({
      to:      inst.email,
      subject: 'EduVerse Institute Application Update',
      html:    `<p>Hi ${inst.full_name}, unfortunately your application for <strong>${inst.name}</strong> was rejected. Reason: ${reason}</p>`,
    });
  }

  return { message: 'Institute rejected.' };
}

async function updateInstituteStatus(instituteId, status) {
  await db.query('UPDATE institutes SET status = ? WHERE id = ?', [status, instituteId]);
  return { message: `Institute ${status}.` };
}

async function updateSubscription(instituteId, plan, endDate) {
  await db.query(
    'UPDATE institutes SET subscription_plan = ?, subscription_end = ? WHERE id = ?',
    [plan, endDate, instituteId]
  );
  return { message: 'Subscription updated.' };
}

async function sendRenewalReminder(instituteId) {
  const [[inst]] = await db.query(
    'SELECT i.name, i.subscription_end, u.email, up.full_name FROM institutes i JOIN users u ON u.id = i.user_id JOIN user_profiles up ON up.user_id = i.user_id WHERE i.id = ?',
    [instituteId]
  );
  if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');

  await sendMail({
    to:      inst.email,
    subject: 'EduVerse Subscription Renewal Reminder',
    html:    `<p>Hi ${inst.full_name}, your EduVerse subscription for <strong>${inst.name}</strong> expires on ${inst.subscription_end}. Please renew to continue uninterrupted access.</p>`,
  });

  return { message: 'Renewal reminder sent.' };
}

/* ============================================================
   INSTRUCTOR MANAGEMENT
============================================================ */

async function getInstructors(filters) {
  const { q, status, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ["u.role = 'instructor'"];
  const params = [];

  if (q) {
    where.push('(up.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (status === 'active')    where.push('u.is_active = 1');
  if (status === 'suspended') where.push('u.is_active = 0');
  if (status === 'verified')  where.push('up.is_verified_instructor = 1');

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.is_active,
           up.is_verified_instructor AS is_verified,
           up.subject, up.qualification, up.photo_url AS avatar,
           u.created_at,
           (SELECT COUNT(*) FROM courses WHERE instructor_id = u.id AND status = 'published') AS total_courses,
           (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e
            JOIN courses c ON c.id = e.course_id WHERE c.instructor_id = u.id) AS total_students
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    ${whereSQL}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(*) AS total FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    ${whereSQL}
  `, params);

  return {
    instructors: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function getInstructor(instructorId) {
  const [[inst]] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone, u.is_active,
           up.bio, up.subject, up.qualification, up.experience_years,
           up.linkedin_url, up.photo_url AS avatar,
           up.is_verified_instructor AS is_verified, u.created_at
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = ? AND u.role = 'instructor'
  `, [instructorId]);

  if (!inst) throw new AppError('Instructor not found.', 404, 'NOT_FOUND');

  const [courses] = await db.query(
    'SELECT id, title, status, enrolled_count, avg_rating FROM courses WHERE instructor_id = ? ORDER BY created_at DESC LIMIT 10',
    [instructorId]
  );

  return { ...inst, courses };
}

async function approveInstructor(instructorId, adminId) {
  await db.query(
    'UPDATE user_profiles SET is_verified_instructor = 1 WHERE user_id = ?',
    [instructorId]
  );
  await db.query('UPDATE users SET is_active = 1 WHERE id = ?', [instructorId]);
  await _auditLog(adminId, 'instructor_approved', 'user', instructorId);
  return { message: 'Instructor approved.' };
}

async function suspendInstructor(instructorId) {
  await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [instructorId]);
  return { message: 'Instructor suspended.' };
}

async function markPayoutDone(instructorId, amount) {
  // Log the payout in audit logs (full payout system is in payments module)
  await db.query(`
    INSERT INTO audit_logs (user_id, action, reference_type, reference_id)
    VALUES (?, 'payout_marked_done', 'instructor', ?)
  `, [instructorId, instructorId]);
  return { message: 'Payout marked as done.', amount };
}

/* ============================================================
   CONTENT MODERATION
============================================================ */

async function getPendingCourses() {
  const [rows] = await db.query(`
    SELECT c.id, c.title, c.category, c.level, c.created_at,
           c.thumbnail_url, up.full_name AS instructor_name, u.email AS instructor_email,
           (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) AS module_count,
           (SELECT COUNT(*) FROM videos v JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = c.id) AS video_count
    FROM courses c
    JOIN users u ON u.id = c.instructor_id
    JOIN user_profiles up ON up.user_id = c.instructor_id
    WHERE c.status = 'pending_review'
    ORDER BY c.created_at ASC
  `);
  return rows;
}

async function getAllCourses(filters) {
  const { q, status, category, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = [];
  const params = [];

  if (q)        { where.push('c.title LIKE ?');    params.push(`%${q}%`); }
  if (status)   { where.push('c.status = ?');      params.push(status); }
  if (category) { where.push('c.category = ?');    params.push(category); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(`
    SELECT c.id, c.title, c.status, c.category, c.level,
           c.price, c.is_free, c.is_featured,
           c.enrolled_count, c.avg_rating, c.created_at,
           up.full_name AS instructor_name
    FROM courses c
    JOIN user_profiles up ON up.user_id = c.instructor_id
    ${whereSQL}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM courses c ${whereSQL}`, params
  );

  return {
    courses: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function approveCourse(courseId, adminId) {
  await db.query(
    "UPDATE courses SET status = 'published', published_at = NOW() WHERE id = ?",
    [courseId]
  );

  // Notify instructor
  const [[course]] = await db.query(
    'SELECT c.title, u.email, up.full_name FROM courses c JOIN users u ON u.id = c.instructor_id JOIN user_profiles up ON up.user_id = c.instructor_id WHERE c.id = ?',
    [courseId]
  );
  if (course) {
    await sendMail({
      to:      course.email,
      subject: 'Your course has been approved — EduVerse',
      html:    `<p>Hi ${course.full_name}, your course <strong>${course.title}</strong> has been approved and is now live on EduVerse!</p>`,
    });
  }

  await _auditLog(adminId, 'course_approved', 'course', courseId);
  return { message: 'Course approved and published.' };
}

async function rejectCourse(courseId, reason, adminId) {
  await db.query(
    "UPDATE courses SET status = 'rejected', rejection_reason = ? WHERE id = ?",
    [reason || 'Did not meet content standards.', courseId]
  );

  const [[course]] = await db.query(
    'SELECT c.title, u.email, up.full_name FROM courses c JOIN users u ON u.id = c.instructor_id JOIN user_profiles up ON up.user_id = c.instructor_id WHERE c.id = ?',
    [courseId]
  );
  if (course) {
    await sendMail({
      to:      course.email,
      subject: 'Course Review Update — EduVerse',
      html:    `<p>Hi ${course.full_name}, your course <strong>${course.title}</strong> was not approved. Reason: ${reason}</p><p>Please make the necessary changes and resubmit.</p>`,
    });
  }

  await _auditLog(adminId, 'course_rejected', 'course', courseId);
  return { message: 'Course rejected.' };
}

async function featureCourse(courseId, featured) {
  await db.query('UPDATE courses SET is_featured = ? WHERE id = ?', [featured ? 1 : 0, courseId]);
  return { message: featured ? 'Course featured.' : 'Course unfeatured.' };
}

async function removeCourse(courseId, reason, adminId, ip) {
  await db.query("UPDATE courses SET status = 'archived' WHERE id = ?", [courseId]);
  await _auditLog(adminId, 'course_removed', 'course', courseId, ip);
  return { message: 'Course removed from platform.' };
}

/* ============================================================
   REVENUE & PAYMENTS
============================================================ */

async function getRevenue(filters) {
  const { period } = filters;

  // Summary
  const [[summary]] = await db.query(`
    SELECT
      COALESCE(SUM(amount), 0) AS total_lifetime,
      COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW()) THEN amount ELSE 0 END), 0) AS this_month,
      COALESCE(SUM(CASE WHEN WEEK(created_at) = WEEK(NOW()) THEN amount ELSE 0 END), 0) AS this_week,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN amount ELSE 0 END), 0) AS today,
      SUM(CASE WHEN type = 'course_purchase' THEN amount ELSE 0 END) AS course_revenue,
      SUM(CASE WHEN type = 'subscription'    THEN amount ELSE 0 END) AS subscription_revenue,
      SUM(CASE WHEN type = 'fee'             THEN amount ELSE 0 END) AS fee_revenue,
      SUM(CASE WHEN type = 'material'        THEN amount ELSE 0 END) AS material_revenue
    FROM payments WHERE status = 'success'
  `);

  // Monthly trend
  const [trend] = await db.query(`
    SELECT DATE_FORMAT(created_at, '%b %Y') AS month,
           DATE_FORMAT(created_at, '%Y-%m') AS month_key,
           COALESCE(SUM(amount), 0) AS amount,
           COUNT(*) AS transactions
    FROM payments
    WHERE status = 'success'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY month_key
    ORDER BY month_key ASC
  `);

  // Top earning instructors
  const [topInstructors] = await db.query(`
    SELECT up.full_name AS name, up.photo_url AS avatar,
           COUNT(mp.id) AS sales,
           COALESCE(SUM(mp.amount_paid), 0) AS earnings
    FROM material_purchases mp
    JOIN study_materials sm ON sm.id = mp.material_id
    JOIN user_profiles up ON up.user_id = sm.instructor_id
    WHERE mp.payment_status = 'success'
    GROUP BY sm.instructor_id
    ORDER BY earnings DESC
    LIMIT 5
  `);

  return {
    summary: {
      total_lifetime:        parseFloat(summary.total_lifetime        || 0),
      this_month:            parseFloat(summary.this_month            || 0),
      this_week:             parseFloat(summary.this_week             || 0),
      today:                 parseFloat(summary.today                 || 0),
      course_revenue:        parseFloat(summary.course_revenue        || 0),
      subscription_revenue:  parseFloat(summary.subscription_revenue  || 0),
      fee_revenue:           parseFloat(summary.fee_revenue           || 0),
      material_revenue:      parseFloat(summary.material_revenue      || 0),
    },
    trend,
    top_instructors: topInstructors,
  };
}

async function getPayments(filters) {
  const { status, type, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = [];
  const params = [];
  if (status) { where.push('p.status = ?'); params.push(status); }
  if (type)   { where.push('p.type = ?');   params.push(type); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(`
    SELECT p.id, p.amount, p.currency, p.type, p.status,
           p.gateway, p.gateway_payment_id, p.created_at,
           up.full_name AS user_name, u.email AS user_email
    FROM payments p
    JOIN users u ON u.id = p.user_id
    JOIN user_profiles up ON up.user_id = p.user_id
    ${whereSQL}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM payments p ${whereSQL}`, params
  );

  return {
    payments: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function getRefunds(filters) {
  const { status } = filters;
  const where  = [];
  const params = [];
  if (status) { where.push('rr.status = ?'); params.push(status); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(`
    SELECT rr.id, rr.reason, rr.status, rr.created_at,
           p.amount, p.type AS payment_type,
           up.full_name AS student_name, u.email AS student_email
    FROM refund_requests rr
    JOIN payments p ON p.id = rr.payment_id
    JOIN users u ON u.id = rr.student_id
    JOIN user_profiles up ON up.user_id = rr.student_id
    ${whereSQL}
    ORDER BY rr.created_at DESC
  `, params);

  return rows;
}

async function resolveRefund(refundId, status, adminId, note) {
  await db.query(
    'UPDATE refund_requests SET status = ?, admin_note = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?',
    [status, note || null, adminId, refundId]
  );
  return { message: `Refund ${status}.` };
}

/* ============================================================
   ANALYTICS
============================================================ */

async function getAnalytics(filters) {
  const { days } = filters;
  const daysNum = parseInt(days) || 30;
  const since   = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // User growth by role
  const [userGrowth] = await db.query(`
    SELECT DATE_FORMAT(created_at, '%d %b') AS label,
           role, COUNT(*) AS count
    FROM users
    WHERE DATE(created_at) >= ?
    GROUP BY DATE(created_at), role
    ORDER BY DATE(created_at) ASC
  `, [since]);

  // Enrollment trend
  const [enrollTrend] = await db.query(`
    SELECT DATE_FORMAT(enrolled_at, '%d %b') AS label, COUNT(*) AS count
    FROM enrollments
    WHERE DATE(enrolled_at) >= ?
    GROUP BY DATE(enrolled_at)
    ORDER BY DATE(enrolled_at) ASC
  `, [since]);

  // Top categories
  const [topCategories] = await db.query(`
    SELECT c.category, COUNT(e.id) AS enrollments
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE c.category IS NOT NULL
    GROUP BY c.category
    ORDER BY enrollments DESC
    LIMIT 10
  `);

  // Geographic distribution
  const [geoDistribution] = await db.query(`
    SELECT up.country, up.state, COUNT(*) AS users
    FROM user_profiles up
    JOIN users u ON u.id = up.user_id
    WHERE u.role = 'student'
    GROUP BY up.country, up.state
    ORDER BY users DESC
    LIMIT 20
  `);

  return {
    user_growth:      userGrowth,
    enroll_trend:     enrollTrend,
    top_categories:   topCategories,
    geo_distribution: geoDistribution,
  };
}

/* ============================================================
   SETTINGS
============================================================ */

async function getSettings() {
  const [rows] = await db.query('SELECT `key`, value, type, category FROM platform_settings ORDER BY category, `key`');
  // Group by category
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = {};
    grouped[row.category][row.key] = row.type === 'boolean'
      ? row.value === '1'
      : row.type === 'number'
      ? parseFloat(row.value)
      : row.value;
  }
  return grouped;
}

async function updateSettings(data, adminId) {
  for (const [key, value] of Object.entries(data)) {
    await db.query(
      'UPDATE platform_settings SET value = ?, updated_by = ? WHERE `key` = ?',
      [String(value), adminId, key]
    );
  }
  return { message: 'Settings updated.' };
}

async function getFeatureFlags() {
  const [rows] = await db.query('SELECT feature_name, is_enabled, description FROM feature_flags');
  return rows;
}

async function updateFeatureFlag(featureName, isEnabled, adminId) {
  await db.query(
    'INSERT INTO feature_flags (feature_name, is_enabled, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE is_enabled = ?, updated_by = ?',
    [featureName, isEnabled ? 1 : 0, adminId, isEnabled ? 1 : 0, adminId]
  );
  return { message: 'Feature flag updated.' };
}

/* ============================================================
   ANNOUNCEMENTS
============================================================ */

async function getAnnouncements() {
  const [rows] = await db.query(`
    SELECT a.id, a.title, a.body, a.target_role, a.is_active, a.created_at,
           up.full_name AS sender_name
    FROM announcements a
    JOIN user_profiles up ON up.user_id = a.sender_id
    ORDER BY a.created_at DESC
    LIMIT 50
  `);
  return rows;
}

async function createAnnouncement(senderId, data) {
  const { title, body, target_role, institute_id } = data;
  if (!title || !body) throw new AppError('Title and body are required.', 400, 'MISSING_FIELDS');

  const [result] = await db.query(
    'INSERT INTO announcements (sender_id, institute_id, target_role, title, body) VALUES (?, ?, ?, ?, ?)',
    [senderId, institute_id || null, target_role || 'all', title, body]
  );

  // Create in-app notifications for target users
  const roleFilter = target_role && target_role !== 'all'
    ? `AND u.role = '${target_role}'`
    : '';

  const [users] = await db.query(
    `SELECT id FROM users WHERE is_active = 1 ${roleFilter}`
  );

  if (users.length) {
    const values = users.map(u => [u.id, title, body, 'announcement']);
    await db.query(
      'INSERT INTO notifications (user_id, title, body, type) VALUES ?',
      [values]
    );
  }

  return { id: result.insertId, message: 'Announcement sent.' };
}

async function deleteAnnouncement(announcementId) {
  await db.query('DELETE FROM announcements WHERE id = ?', [announcementId]);
  return { message: 'Announcement deleted.' };
}

/* ============================================================
   SUPPORT TICKETS
============================================================ */

async function getTickets(filters) {
  const { status, priority, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = [];
  const params = [];
  if (status)   { where.push('t.status = ?');   params.push(status); }
  if (priority) { where.push('t.priority = ?'); params.push(priority); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(`
    SELECT t.id, t.subject, t.category, t.priority, t.status,
           t.created_at, t.updated_at,
           up.full_name AS user_name, u.email AS user_email, u.role AS user_role
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    JOIN user_profiles up ON up.user_id = t.user_id
    ${whereSQL}
    ORDER BY
      FIELD(t.priority, 'urgent','high','medium','low'),
      t.created_at ASC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM support_tickets t ${whereSQL}`, params
  );

  return {
    tickets: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function getTicket(ticketId) {
  const [[ticket]] = await db.query(`
    SELECT t.*, up.full_name AS user_name, u.email AS user_email, u.role AS user_role
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    JOIN user_profiles up ON up.user_id = t.user_id
    WHERE t.id = ?
  `, [ticketId]);

  if (!ticket) throw new AppError('Ticket not found.', 404, 'NOT_FOUND');

  const [replies] = await db.query(`
    SELECT tr.id, tr.message, tr.is_internal, tr.created_at,
           up.full_name AS sender_name, u.role AS sender_role
    FROM ticket_replies tr
    JOIN users u ON u.id = tr.user_id
    JOIN user_profiles up ON up.user_id = tr.user_id
    WHERE tr.ticket_id = ?
    ORDER BY tr.created_at ASC
  `, [ticketId]);

  return { ...ticket, replies };
}

async function replyTicket(ticketId, userId, message) {
  await db.query(
    'INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)',
    [ticketId, userId, message]
  );
  await db.query(
    "UPDATE support_tickets SET status = 'in_progress', updated_at = NOW() WHERE id = ? AND status = 'open'",
    [ticketId]
  );
  return { message: 'Reply sent.' };
}

async function updateTicketStatus(ticketId, status) {
  const extra = status === 'resolved' ? ', resolved_at = NOW()' : '';
  await db.query(
    `UPDATE support_tickets SET status = ? ${extra} WHERE id = ?`,
    [status, ticketId]
  );
  return { message: 'Ticket updated.' };
}

async function assignTicket(ticketId, assignedTo) {
  await db.query(
    "UPDATE support_tickets SET assigned_to = ?, status = 'in_progress' WHERE id = ?",
    [assignedTo, ticketId]
  );
  return { message: 'Ticket assigned.' };
}

/* ============================================================
   AUDIT LOGS
============================================================ */

async function getAuditLogs(filters) {
  const { user_id, action, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = [];
  const params = [];
  if (user_id) { where.push('al.user_id = ?');  params.push(user_id); }
  if (action)  { where.push('al.action LIKE ?'); params.push(`%${action}%`); }

  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(`
    SELECT al.id, al.action, al.reference_type, al.reference_id,
           al.ip_address, al.created_at,
           up.full_name AS user_name
    FROM audit_logs al
    LEFT JOIN user_profiles up ON up.user_id = al.user_id
    ${whereSQL}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total FROM audit_logs al ${whereSQL}`, params
  );

  return {
    logs: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

/* ============================================================
   HELPER
============================================================ */

async function _auditLog(userId, action, refType, refId, ip) {
  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, action, reference_type, reference_id, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId || null, action, refType || null, refId || null, ip || null]
    );
  } catch (e) { /* non-blocking */ }
}

module.exports = {
  getDashboard,
  getUsers, getUser, updateUserStatus, verifyUser, resetUserPassword, deleteUser,
  getInstitutes, getInstitute, approveInstitute, rejectInstitute,
  updateInstituteStatus, updateSubscription, sendRenewalReminder,
  getInstructors, getInstructor, approveInstructor, suspendInstructor, markPayoutDone,
  getPendingCourses, getAllCourses, approveCourse, rejectCourse, featureCourse, removeCourse,
  getRevenue, getPayments, getRefunds, resolveRefund,
  getAnalytics,
  getSettings, updateSettings, getFeatureFlags, updateFeatureFlag,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  getTickets, getTicket, replyTicket, updateTicketStatus, assignTicket,
  getAuditLogs,
};