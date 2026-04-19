/**
 * EduVerse — Institute Service
 * modules/institute/institute.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const { sendMail } = require('../../config/mailer');
const bcrypt       = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/* ── Helper: get institute record from user_id ── */
async function _getInstitute(userId) {
  const [[inst]] = await db.query(
    'SELECT * FROM institutes WHERE user_id = ?', [userId]
  );
  if (!inst) throw new AppError('Institute not found.', 404, 'NOT_FOUND');
  return inst;
}

/* ============================================================
   DASHBOARD
============================================================ */

async function getDashboard(userId) {
  const inst = await _getInstitute(userId);

  const [[stats]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM institute_members WHERE institute_id = ? AND role = 'student' AND status = 'active') AS total_students,
      (SELECT COUNT(*) FROM institute_members WHERE institute_id = ? AND role = 'teacher' AND status = 'active') AS total_teachers,
      (SELECT COUNT(*) FROM classes WHERE institute_id = ?) AS total_classes,
      (SELECT COUNT(*) FROM student_fees WHERE institute_id = ? AND status = 'pending') AS pending_fees,
      (SELECT COUNT(*) FROM student_fees WHERE institute_id = ? AND status = 'overdue') AS overdue_fees,
      (SELECT COALESCE(SUM(amount), 0) FROM student_fees WHERE institute_id = ? AND status = 'paid') AS fees_collected
  `, [inst.id, inst.id, inst.id, inst.id, inst.id, inst.id]);

  // Upcoming calendar events
  const [events] = await db.query(`
    SELECT id, event_name, event_type, event_date, color
    FROM academic_calendar
    WHERE institute_id = ? AND event_date >= CURDATE()
    ORDER BY event_date ASC
    LIMIT 5
  `, [inst.id]);

  // Recent student registrations
  const [recentStudents] = await db.query(`
    SELECT u.id, up.full_name AS name, up.photo_url AS avatar,
           im.joined_at
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    WHERE im.institute_id = ? AND im.role = 'student'
    ORDER BY im.joined_at DESC
    LIMIT 5
  `, [inst.id]);

  // Attendance rate today
  const [[attToday]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
    JOIN classes c ON c.id = ats.class_id
    WHERE c.institute_id = ? AND DATE(ats.date) = CURDATE()
  `, [inst.id]);

  const attendanceRate = attToday.total > 0
    ? Math.round((attToday.present / attToday.total) * 100)
    : null;

  return {
    institute: { id: inst.id, name: inst.name, type: inst.type, logo_url: inst.logo_url, subscription_plan: inst.subscription_plan, subscription_end: inst.subscription_end },
    stats: {
      total_students:  stats.total_students  || 0,
      total_teachers:  stats.total_teachers  || 0,
      total_classes:   stats.total_classes   || 0,
      pending_fees:    stats.pending_fees    || 0,
      overdue_fees:    stats.overdue_fees    || 0,
      fees_collected:  parseFloat(stats.fees_collected || 0),
      attendance_rate_today: attendanceRate,
    },
    upcoming_events:  events,
    recent_students:  recentStudents,
  };
}

/* ============================================================
   PROFILE
============================================================ */

async function getProfile(userId) {
  const [[row]] = await db.query(`
    SELECT i.*, up.full_name AS owner_name, u.email, u.phone
    FROM institutes i
    JOIN users u ON u.id = i.user_id
    JOIN user_profiles up ON up.user_id = i.user_id
    WHERE i.user_id = ?
  `, [userId]);
  if (!row) throw new AppError('Profile not found.', 404, 'NOT_FOUND');
  return row;
}

async function updateProfile(userId, data) {
  const inst = await _getInstitute(userId);
  const { name, type, address, city, state, contact_email, contact_phone, website } = data;

  await db.query(`
    UPDATE institutes SET
      name = COALESCE(?, name), type = COALESCE(?, type),
      address = COALESCE(?, address), city = COALESCE(?, city),
      state = COALESCE(?, state), contact_email = COALESCE(?, contact_email),
      contact_phone = COALESCE(?, contact_phone), website = COALESCE(?, website)
    WHERE id = ?
  `, [name, type, address, city, state, contact_email, contact_phone, website, inst.id]);

  return { message: 'Profile updated.' };
}

async function updateLogo(userId, url) {
  const inst = await _getInstitute(userId);
  await db.query('UPDATE institutes SET logo_url = ? WHERE id = ?', [url, inst.id]);
  return { message: 'Logo updated.', logo_url: url };
}

async function updateAccreditation(userId, url) {
  const inst = await _getInstitute(userId);
  await db.query('UPDATE institutes SET accreditation_doc_url = ? WHERE id = ?', [url, inst.id]);
  return { message: 'Document uploaded.', doc_url: url };
}

/* ============================================================
   STUDENT MANAGEMENT
============================================================ */

async function getStudents(userId, filters) {
  const inst = await _getInstitute(userId);
  const { q, class_id, status, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ["im.institute_id = ? AND im.role = 'student'"];
  const params = [inst.id];

  if (q) {
    where.push('(up.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status === 'active')   where.push('im.status = "active"');
  if (status === 'inactive') where.push('im.status = "inactive"');

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           up.photo_url AS avatar, im.status, im.joined_at,
           up.grade,
           (SELECT cs.class_id FROM class_students cs WHERE cs.student_id = u.id LIMIT 1) AS class_id,
           (SELECT c.name FROM classes c JOIN class_students cs ON cs.class_id = c.id WHERE cs.student_id = u.id LIMIT 1) AS class_name
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    ${whereSQL}
    ORDER BY im.joined_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(*) AS total
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    ${whereSQL}
  `, params);

  return {
    students: rows,
    pagination: { total: countRow.total, page: pageNum, per_page: limitNum, total_pages: Math.ceil(countRow.total / limitNum) },
  };
}

async function getStudent(studentId, userId) {
  const inst = await _getInstitute(userId);

  const [[student]] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           up.photo_url AS avatar, up.date_of_birth, up.gender,
           up.grade, im.status, im.joined_at
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    WHERE im.institute_id = ? AND im.user_id = ? AND im.role = 'student'
  `, [inst.id, studentId]);

  if (!student) throw new AppError('Student not found.', 404, 'NOT_FOUND');

  const [classes] = await db.query(`
    SELECT c.id, c.name, c.section, ct.subject
    FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
    LEFT JOIN class_teachers ct ON ct.class_id = c.id
    WHERE cs.student_id = ? AND c.institute_id = ?
  `, [studentId, inst.id]);

  return { ...student, classes };
}

async function addStudent(userId, data) {
  const inst = await _getInstitute(userId);
  const { name, email, phone, grade, class_id, roll_number } = data;

  if (!name || !email) throw new AppError('Name and email are required.', 400, 'MISSING_FIELDS');

  // Check if user already exists
  let [[existing]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

  let studentId;
  if (existing) {
    studentId = existing.id;
  } else {
    // Create new user with temp password
    const tempPassword = uuidv4().slice(0, 8);
    const hash = await bcrypt.hash(tempPassword, 12);

    const [result] = await db.query(
      "INSERT INTO users (email, phone, password_hash, role, is_verified) VALUES (?, ?, ?, 'student', 1)",
      [email.toLowerCase(), phone || null, hash]
    );
    studentId = result.insertId;

    await db.query(
      'INSERT INTO user_profiles (user_id, full_name, grade) VALUES (?, ?, ?)',
      [studentId, name, grade || null]
    );

    // Send welcome email with temp password
    await sendMail({
      to:      email,
      subject: `Welcome to ${inst.name} — EduVerse`,
      html:    `<p>Hi ${name}, you have been added to <strong>${inst.name}</strong> on EduVerse. Your temporary password is: <strong>${tempPassword}</strong>. Please change it after logging in.</p>`,
    });
  }

  // Add to institute members
  await db.query(
    "INSERT IGNORE INTO institute_members (institute_id, user_id, role) VALUES (?, ?, 'student')",
    [inst.id, studentId]
  );

  // Assign to class if provided
  if (class_id) {
    await db.query(
      'INSERT IGNORE INTO class_students (class_id, student_id, roll_number) VALUES (?, ?, ?)',
      [class_id, studentId, roll_number || null]
    );
  }

  return { student_id: studentId, message: 'Student added.' };
}

async function bulkImportStudents(userId, file) {
  // CSV/Excel parsing — in production use 'xlsx' or 'csv-parser' npm package
  // For now return structured response showing what the endpoint expects
  return {
    message: 'Bulk import processed.',
    imported: 0,
    failed: 0,
    note: 'Install xlsx package and parse req.file.path for full implementation.',
  };
}

async function updateStudent(studentId, userId, data) {
  const inst = await _getInstitute(userId);
  const { name, phone, grade } = data;

  await db.query(`
    UPDATE user_profiles SET
      full_name = COALESCE(?, full_name),
      grade     = COALESCE(?, grade)
    WHERE user_id = ?
  `, [name || null, grade || null, studentId]);

  if (phone) {
    await db.query('UPDATE users SET phone = ? WHERE id = ?', [phone, studentId]);
  }

  return { message: 'Student updated.' };
}

async function updateStudentStatus(studentId, userId, status) {
  const inst = await _getInstitute(userId);
  await db.query(
    'UPDATE institute_members SET status = ? WHERE institute_id = ? AND user_id = ?',
    [status, inst.id, studentId]
  );
  return { message: `Student ${status}.` };
}

async function removeStudent(studentId, userId) {
  const inst = await _getInstitute(userId);
  await db.query(
    'DELETE FROM institute_members WHERE institute_id = ? AND user_id = ? AND role = "student"',
    [inst.id, studentId]
  );
  return { message: 'Student removed from institute.' };
}

async function linkParent(studentId, userId, parentEmail, parentPhone, relation) {
  if (!parentEmail && !parentPhone) throw new AppError('Parent email or phone is required.', 400, 'MISSING_FIELDS');

  // Find parent user
  const [[parent]] = await db.query(
    'SELECT id FROM users WHERE email = ? OR phone = ?',
    [parentEmail || '', parentPhone || '']
  );

  if (!parent) throw new AppError('No parent account found with that email/phone.', 404, 'NOT_FOUND');

  await db.query(
    'INSERT IGNORE INTO parent_students (parent_id, student_id, relation, is_verified) VALUES (?, ?, ?, 1)',
    [parent.id, studentId, relation || 'guardian']
  );

  return { message: 'Parent linked to student.' };
}

async function generateIdCard(studentId, userId) {
  // In production: generate PDF with student name, photo, class, institute logo
  return {
    message:  'ID card generated.',
    file_url: null,
    note:     'PDF generation requires pdf-lib or puppeteer integration.',
  };
}

async function getPendingRegistrations(userId) {
  const inst = await _getInstitute(userId);
  const [rows] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           up.grade, u.created_at
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    WHERE up.institute_code = ? AND u.role = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM institute_members im
        WHERE im.institute_id = ? AND im.user_id = u.id
      )
    ORDER BY u.created_at DESC
  `, [inst.name, inst.id]);
  return rows;
}

async function approveRegistration(studentId, userId) {
  const inst = await _getInstitute(userId);
  await db.query(
    "INSERT IGNORE INTO institute_members (institute_id, user_id, role) VALUES (?, ?, 'student')",
    [inst.id, studentId]
  );
  return { message: 'Registration approved.' };
}

async function rejectRegistration(studentId, userId) {
  // Simply clear the institute_code so they can't auto-join
  await db.query("UPDATE user_profiles SET institute_code = NULL WHERE user_id = ?", [studentId]);
  return { message: 'Registration rejected.' };
}

/* ============================================================
   TEACHER MANAGEMENT
============================================================ */

async function getTeachers(userId, filters) {
  const inst = await _getInstitute(userId);
  const { q, page, per_page } = filters;

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ["im.institute_id = ? AND im.role = 'teacher'"];
  const params = [inst.id];

  if (q) {
    where.push('(up.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           up.photo_url AS avatar, up.subject, up.qualification,
           im.status, im.joined_at
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    ${whereSQL}
    ORDER BY im.joined_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  const [[countRow]] = await db.query(`
    SELECT COUNT(*) AS total FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    ${whereSQL}
  `, params);

  return {
    teachers: rows,
    pagination: { total: countRow.total, page: pageNum, per_page: limitNum, total_pages: Math.ceil(countRow.total / limitNum) },
  };
}

async function getTeacher(teacherId, userId) {
  const inst = await _getInstitute(userId);
  const [[teacher]] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, u.phone,
           up.subject, up.qualification, up.photo_url AS avatar, im.status
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    WHERE im.institute_id = ? AND im.user_id = ? AND im.role = 'teacher'
  `, [inst.id, teacherId]);

  if (!teacher) throw new AppError('Teacher not found.', 404, 'NOT_FOUND');

  const [classes] = await db.query(`
    SELECT c.id, c.name, c.section, ct.subject
    FROM class_teachers ct
    JOIN classes c ON c.id = ct.class_id
    WHERE ct.teacher_id = ? AND c.institute_id = ?
  `, [teacherId, inst.id]);

  return { ...teacher, classes };
}

async function addTeacher(userId, data) {
  const inst = await _getInstitute(userId);
  const { name, email, phone, subject, qualification } = data;

  if (!name || !email) throw new AppError('Name and email are required.', 400, 'MISSING_FIELDS');

  let [[existing]] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  let teacherId;

  if (existing) {
    teacherId = existing.id;
  } else {
    const tempPassword = uuidv4().slice(0, 8);
    const hash = await bcrypt.hash(tempPassword, 12);
    const [result] = await db.query(
      "INSERT INTO users (email, phone, password_hash, role, is_verified) VALUES (?, ?, ?, 'instructor', 1)",
      [email.toLowerCase(), phone || null, hash]
    );
    teacherId = result.insertId;

    await db.query(
      'INSERT INTO user_profiles (user_id, full_name, subject, qualification) VALUES (?, ?, ?, ?)',
      [teacherId, name, subject || null, qualification || null]
    );

    await sendMail({
      to:      email,
      subject: `You have been added to ${inst.name} — EduVerse`,
      html:    `<p>Hi ${name}, you have been added as a teacher at <strong>${inst.name}</strong>. Your temporary password is: <strong>${tempPassword}</strong>.</p>`,
    });
  }

  await db.query(
    "INSERT IGNORE INTO institute_members (institute_id, user_id, role) VALUES (?, ?, 'teacher')",
    [inst.id, teacherId]
  );

  return { teacher_id: teacherId, message: 'Teacher added.' };
}

async function bulkImportTeachers(userId, file) {
  return { message: 'Bulk import processed.', imported: 0, failed: 0 };
}

async function updateTeacher(teacherId, userId, data) {
  const { name, subject, qualification } = data;
  await db.query(`
    UPDATE user_profiles SET
      full_name     = COALESCE(?, full_name),
      subject       = COALESCE(?, subject),
      qualification = COALESCE(?, qualification)
    WHERE user_id = ?
  `, [name || null, subject || null, qualification || null, teacherId]);
  return { message: 'Teacher updated.' };
}

async function updateTeacherStatus(teacherId, userId, status) {
  const inst = await _getInstitute(userId);
  await db.query(
    'UPDATE institute_members SET status = ? WHERE institute_id = ? AND user_id = ?',
    [status, inst.id, teacherId]
  );
  return { message: `Teacher ${status}.` };
}

async function removeTeacher(teacherId, userId) {
  const inst = await _getInstitute(userId);
  await db.query(
    'DELETE FROM institute_members WHERE institute_id = ? AND user_id = ? AND role = "teacher"',
    [inst.id, teacherId]
  );
  return { message: 'Teacher removed.' };
}

/* ============================================================
   CLASSES
============================================================ */

async function getClasses(userId, filters) {
  const inst = await _getInstitute(userId);
  const [rows] = await db.query(`
    SELECT c.id, c.name, c.section, c.created_at,
           ay.name AS academic_year,
           (SELECT COUNT(*) FROM class_students WHERE class_id = c.id) AS student_count,
           (SELECT COUNT(DISTINCT teacher_id) FROM class_teachers WHERE class_id = c.id) AS teacher_count
    FROM classes c
    LEFT JOIN academic_years ay ON ay.id = c.academic_year_id
    WHERE c.institute_id = ?
    ORDER BY c.name ASC
  `, [inst.id]);
  return rows;
}

async function createClass(userId, data) {
  const inst = await _getInstitute(userId);
  const { name, section, academic_year_id, description } = data;
  if (!name) throw new AppError('Class name is required.', 400, 'MISSING_FIELDS');

  const [result] = await db.query(
    'INSERT INTO classes (institute_id, academic_year_id, name, section, description) VALUES (?, ?, ?, ?, ?)',
    [inst.id, academic_year_id || null, name, section || null, description || null]
  );
  return { id: result.insertId, message: 'Class created.' };
}

async function getClass(classId, userId) {
  const inst = await _getInstitute(userId);
  const [[cls]] = await db.query('SELECT * FROM classes WHERE id = ? AND institute_id = ?', [classId, inst.id]);
  if (!cls) throw new AppError('Class not found.', 404, 'NOT_FOUND');

  const [students] = await db.query(`
    SELECT u.id, up.full_name AS name, cs.roll_number
    FROM class_students cs
    JOIN users u ON u.id = cs.student_id
    JOIN user_profiles up ON up.user_id = cs.student_id
    WHERE cs.class_id = ?
    ORDER BY cs.roll_number ASC
  `, [classId]);

  const [teachers] = await db.query(`
    SELECT u.id, up.full_name AS name, ct.subject
    FROM class_teachers ct
    JOIN users u ON u.id = ct.teacher_id
    JOIN user_profiles up ON up.user_id = ct.teacher_id
    WHERE ct.class_id = ?
  `, [classId]);

  return { ...cls, students, teachers };
}

async function updateClass(classId, userId, data) {
  const inst = await _getInstitute(userId);
  const { name, section } = data;
  await db.query(
    'UPDATE classes SET name = COALESCE(?, name), section = COALESCE(?, section) WHERE id = ? AND institute_id = ?',
    [name || null, section || null, classId, inst.id]
  );
  return { message: 'Class updated.' };
}

async function deleteClass(classId, userId) {
  const inst = await _getInstitute(userId);
  await db.query('DELETE FROM classes WHERE id = ? AND institute_id = ?', [classId, inst.id]);
  return { message: 'Class deleted.' };
}

async function assignStudentToClass(classId, studentId, rollNumber) {
  await db.query(
    'INSERT IGNORE INTO class_students (class_id, student_id, roll_number) VALUES (?, ?, ?)',
    [classId, studentId, rollNumber || null]
  );
  return { message: 'Student assigned to class.' };
}

async function removeStudentFromClass(classId, studentId) {
  await db.query('DELETE FROM class_students WHERE class_id = ? AND student_id = ?', [classId, studentId]);
  return { message: 'Student removed from class.' };
}

async function assignTeacherToClass(classId, teacherId, subject) {
  await db.query(
    'INSERT IGNORE INTO class_teachers (class_id, teacher_id, subject) VALUES (?, ?, ?)',
    [classId, teacherId, subject || null]
  );
  return { message: 'Teacher assigned to class.' };
}

async function removeTeacherFromClass(classId, teacherId) {
  await db.query('DELETE FROM class_teachers WHERE class_id = ? AND teacher_id = ?', [classId, teacherId]);
  return { message: 'Teacher removed from class.' };
}

async function transferStudent(studentId, fromClassId, toClassId) {
  await db.query('DELETE FROM class_students WHERE class_id = ? AND student_id = ?', [fromClassId, studentId]);
  await db.query('INSERT IGNORE INTO class_students (class_id, student_id) VALUES (?, ?)', [toClassId, studentId]);
  return { message: 'Student transferred.' };
}

/* ============================================================
   ACADEMIC YEARS
============================================================ */

async function getAcademicYears(userId) {
  const inst = await _getInstitute(userId);
  const [rows] = await db.query('SELECT * FROM academic_years WHERE institute_id = ? ORDER BY start_date DESC', [inst.id]);
  return rows;
}

async function createAcademicYear(userId, data) {
  const inst = await _getInstitute(userId);
  const { name, start_date, end_date, is_current } = data;

  if (is_current) {
    await db.query('UPDATE academic_years SET is_current = 0 WHERE institute_id = ?', [inst.id]);
  }

  const [result] = await db.query(
    'INSERT INTO academic_years (institute_id, name, start_date, end_date, is_current) VALUES (?, ?, ?, ?, ?)',
    [inst.id, name, start_date, end_date, is_current ? 1 : 0]
  );
  return { id: result.insertId, message: 'Academic year created.' };
}

async function updateAcademicYear(yearId, userId, data) {
  const inst = await _getInstitute(userId);
  const { name, start_date, end_date, is_current } = data;

  if (is_current) {
    await db.query('UPDATE academic_years SET is_current = 0 WHERE institute_id = ?', [inst.id]);
  }

  await db.query(`
    UPDATE academic_years SET
      name = COALESCE(?, name),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      is_current = COALESCE(?, is_current)
    WHERE id = ? AND institute_id = ?
  `, [name || null, start_date || null, end_date || null, is_current !== undefined ? (is_current ? 1 : 0) : null, yearId, inst.id]);

  return { message: 'Academic year updated.' };
}

/* ============================================================
   TIMETABLE
============================================================ */

async function getTimetable(userId, filters) {
  const inst = await _getInstitute(userId);
  const { class_id, teacher_id } = filters;

  const where  = ['c.institute_id = ?'];
  const params = [inst.id];

  if (class_id)   { where.push('t.class_id = ?');   params.push(class_id); }
  if (teacher_id) { where.push('t.teacher_id = ?'); params.push(teacher_id); }

  const [rows] = await db.query(`
    SELECT t.id, t.subject, t.day_of_week, t.start_time, t.end_time, t.room,
           c.name AS class_name, c.section,
           up.full_name AS teacher_name
    FROM timetable t
    JOIN classes c ON c.id = t.class_id
    LEFT JOIN user_profiles up ON up.user_id = t.teacher_id
    WHERE ${where.join(' AND ')}
    ORDER BY t.day_of_week, t.start_time
  `, params);

  return rows;
}

async function createTimetableEntry(userId, data) {
  const inst = await _getInstitute(userId);
  const { class_id, teacher_id, subject, day_of_week, start_time, end_time, room } = data;

  const [result] = await db.query(
    'INSERT INTO timetable (class_id, teacher_id, subject, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [class_id, teacher_id || null, subject, day_of_week, start_time, end_time, room || null]
  );
  return { id: result.insertId, message: 'Timetable entry created.' };
}

async function updateTimetableEntry(entryId, data) {
  const { subject, teacher_id, start_time, end_time, room } = data;
  await db.query(`
    UPDATE timetable SET
      subject = COALESCE(?, subject),
      teacher_id = COALESCE(?, teacher_id),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time),
      room = COALESCE(?, room)
    WHERE id = ?
  `, [subject || null, teacher_id || null, start_time || null, end_time || null, room || null, entryId]);
  return { message: 'Entry updated.' };
}

async function deleteTimetableEntry(entryId) {
  await db.query('DELETE FROM timetable WHERE id = ?', [entryId]);
  return { message: 'Entry deleted.' };
}

/* ============================================================
   ACADEMIC CALENDAR
============================================================ */

async function getCalendar(userId, filters) {
  const inst = await _getInstitute(userId);
  const { month, year } = filters;

  const where  = ['ac.institute_id = ?'];
  const params = [inst.id];

  if (month && year) {
    where.push('MONTH(ac.event_date) = ? AND YEAR(ac.event_date) = ?');
    params.push(month, year);
  }

  const [rows] = await db.query(`
    SELECT * FROM academic_calendar
    WHERE ${where.join(' AND ')}
    ORDER BY event_date ASC
  `, params);

  return rows;
}

async function createCalendarEvent(userId, data) {
  const inst = await _getInstitute(userId);
  const { event_name, event_type, event_date, end_date, description, color } = data;

  if (!event_name || !event_date) throw new AppError('Event name and date are required.', 400, 'MISSING_FIELDS');

  const [result] = await db.query(
    'INSERT INTO academic_calendar (institute_id, event_name, event_type, event_date, end_date, description, color, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [inst.id, event_name, event_type || 'event', event_date, end_date || null, description || null, color || '#1A56DB', userId]
  );

  // Notify all institute members
  const [members] = await db.query(
    "SELECT user_id FROM institute_members WHERE institute_id = ?",
    [inst.id]
  );
  if (members.length) {
    const values = members.map(m => [m.user_id, event_name, description || '', 'calendar_event']);
    await db.query('INSERT INTO notifications (user_id, title, body, type) VALUES ?', [values]);
  }

  return { id: result.insertId, message: 'Event created.' };
}

async function updateCalendarEvent(eventId, userId, data) {
  const inst = await _getInstitute(userId);
  const { event_name, event_type, event_date, description, color } = data;

  await db.query(`
    UPDATE academic_calendar SET
      event_name = COALESCE(?, event_name),
      event_type = COALESCE(?, event_type),
      event_date = COALESCE(?, event_date),
      description = COALESCE(?, description),
      color = COALESCE(?, color)
    WHERE id = ? AND institute_id = ?
  `, [event_name || null, event_type || null, event_date || null, description || null, color || null, eventId, inst.id]);

  return { message: 'Event updated.' };
}

async function deleteCalendarEvent(eventId, userId) {
  const inst = await _getInstitute(userId);
  await db.query('DELETE FROM academic_calendar WHERE id = ? AND institute_id = ?', [eventId, inst.id]);
  return { message: 'Event deleted.' };
}

/* ============================================================
   ATTENDANCE
============================================================ */

async function getAttendanceSessions(userId, filters) {
  const inst = await _getInstitute(userId);
  const { class_id, date } = filters;

  const where  = ['c.institute_id = ?'];
  const params = [inst.id];
  if (class_id) { where.push('ats.class_id = ?'); params.push(class_id); }
  if (date)     { where.push('ats.date = ?');     params.push(date); }

  const [rows] = await db.query(`
    SELECT ats.id, ats.subject, ats.date, c.name AS class_name, c.section,
           up.full_name AS instructor_name
    FROM attendance_sessions ats
    JOIN classes c ON c.id = ats.class_id
    JOIN user_profiles up ON up.user_id = ats.instructor_id
    WHERE ${where.join(' AND ')}
    ORDER BY ats.date DESC
  `, params);

  return rows;
}

async function createAttendanceSession(userId, data) {
  const { class_id, subject, date } = data;
  if (!class_id || !date) throw new AppError('Class and date are required.', 400, 'MISSING_FIELDS');

  const [result] = await db.query(
    'INSERT INTO attendance_sessions (class_id, instructor_id, subject, date) VALUES (?, ?, ?, ?)',
    [class_id, userId, subject || null, date]
  );
  return { id: result.insertId, message: 'Session created.' };
}

async function markAttendance(sessionId, records) {
  if (!Array.isArray(records)) throw new AppError('Records must be an array.', 400, 'INVALID_INPUT');

  for (const rec of records) {
    await db.query(
      'INSERT INTO attendance_records (attendance_session_id, student_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
      [sessionId, rec.student_id, rec.status || 'present', rec.status || 'present']
    );
  }

  // Check low attendance and notify parents
  await _checkLowAttendance(sessionId);

  return { message: 'Attendance marked.', count: records.length };
}

async function overrideAttendance(recordId, status) {
  await db.query('UPDATE attendance_records SET status = ? WHERE id = ?', [status, recordId]);
  return { message: 'Attendance overridden.' };
}

async function getStudentAttendance(studentId, userId, filters) {
  const inst = await _getInstitute(userId);
  const { from, to } = filters;

  const where  = ['ar.student_id = ?'];
  const params = [studentId];
  if (from) { where.push('ats.date >= ?'); params.push(from); }
  if (to)   { where.push('ats.date <= ?'); params.push(to); }

  const [records] = await db.query(`
    SELECT ats.date, ats.subject, ar.status, c.name AS class_name
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
    JOIN classes c ON c.id = ats.class_id
    WHERE ${where.join(' AND ')} AND c.institute_id = ?
    ORDER BY ats.date DESC
  `, [...params, inst.id]);

  const total   = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return { records, summary: { total, present, percentage } };
}

async function getClassAttendance(classId, userId, filters) {
  const inst = await _getInstitute(userId);
  const { date } = filters;

  const where  = ['c.id = ? AND c.institute_id = ?'];
  const params = [classId, inst.id];
  if (date) { where.push('ats.date = ?'); params.push(date); }

  const [rows] = await db.query(`
    SELECT up.full_name AS student_name, ar.status, ats.date, ats.subject
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
    JOIN classes c ON c.id = ats.class_id
    JOIN user_profiles up ON up.user_id = ar.student_id
    WHERE ${where.join(' AND ')}
    ORDER BY ats.date DESC, up.full_name ASC
  `, params);

  return rows;
}

async function _checkLowAttendance(sessionId) {
  try {
    // Get threshold from settings
    const [[setting]] = await db.query(
      "SELECT value FROM platform_settings WHERE `key` = 'attendance_threshold'"
    );
    const threshold = parseInt(setting?.value || '75');

    // Get all students in this session's class
    const [[session]] = await db.query('SELECT class_id FROM attendance_sessions WHERE id = ?', [sessionId]);
    if (!session) return;

    const [students] = await db.query('SELECT student_id FROM class_students WHERE class_id = ?', [session.class_id]);

    for (const { student_id } of students) {
      const [[att]] = await db.query(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
        FROM attendance_records ar
        JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
        WHERE ats.class_id = ? AND ar.student_id = ?
      `, [session.class_id, student_id]);

      if (att.total > 0) {
        const pct = Math.round((att.present / att.total) * 100);
        if (pct < threshold) {
          // Notify student
          await db.query(
            "INSERT INTO notifications (user_id, title, body, type) VALUES (?, 'Low Attendance Alert', ?, 'attendance')",
            [student_id, `Your attendance is ${pct}%, which is below the required ${threshold}%.`]
          );

          // Notify parent
          const [[parent]] = await db.query(
            'SELECT parent_id FROM parent_students WHERE student_id = ? LIMIT 1', [student_id]
          );
          if (parent) {
            const [[student]] = await db.query('SELECT full_name FROM user_profiles WHERE user_id = ?', [student_id]);
            await db.query(
              "INSERT INTO notifications (user_id, title, body, type) VALUES (?, 'Child Attendance Alert', ?, 'attendance')",
              [parent.parent_id, `${student?.full_name}'s attendance is ${pct}%, below the ${threshold}% threshold.`]
            );
          }
        }
      }
    }
  } catch (e) { /* non-blocking */ }
}

/* ============================================================
   FEE MANAGEMENT
============================================================ */

async function getFeeStructures(userId) {
  const inst = await _getInstitute(userId);
  const [rows] = await db.query(
    'SELECT * FROM fee_structures WHERE institute_id = ? ORDER BY created_at DESC',
    [inst.id]
  );
  return rows;
}

async function createFeeStructure(userId, data) {
  const inst = await _getInstitute(userId);
  const { name, amount, type, academic_year, due_date, description } = data;
  if (!name || !amount) throw new AppError('Name and amount are required.', 400, 'MISSING_FIELDS');

  const [result] = await db.query(
    'INSERT INTO fee_structures (institute_id, name, amount, type, academic_year, due_date, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [inst.id, name, amount, type || 'tuition', academic_year || null, due_date || null, description || null]
  );
  return { id: result.insertId, message: 'Fee structure created.' };
}

async function updateFeeStructure(feeId, userId, data) {
  const inst = await _getInstitute(userId);
  const { name, amount, due_date } = data;
  await db.query(`
    UPDATE fee_structures SET
      name = COALESCE(?, name),
      amount = COALESCE(?, amount),
      due_date = COALESCE(?, due_date)
    WHERE id = ? AND institute_id = ?
  `, [name || null, amount || null, due_date || null, feeId, inst.id]);
  return { message: 'Fee structure updated.' };
}

async function deleteFeeStructure(feeId, userId) {
  const inst = await _getInstitute(userId);
  await db.query('DELETE FROM fee_structures WHERE id = ? AND institute_id = ?', [feeId, inst.id]);
  return { message: 'Fee structure deleted.' };
}

async function assignFee(userId, data) {
  const inst = await _getInstitute(userId);
  const { fee_structure_id, student_ids, class_id } = data;

  let students = student_ids || [];

  // If class_id provided, get all students in class
  if (class_id && !student_ids) {
    const [classStudents] = await db.query('SELECT student_id FROM class_students WHERE class_id = ?', [class_id]);
    students = classStudents.map(s => s.student_id);
  }

  const [[fee]] = await db.query('SELECT * FROM fee_structures WHERE id = ?', [fee_structure_id]);
  if (!fee) throw new AppError('Fee structure not found.', 404, 'NOT_FOUND');

  let assigned = 0;
  for (const studentId of students) {
    await db.query(
      'INSERT IGNORE INTO student_fees (fee_structure_id, student_id, institute_id, amount, due_date) VALUES (?, ?, ?, ?, ?)',
      [fee_structure_id, studentId, inst.id, fee.amount, fee.due_date]
    );
    assigned++;
  }

  return { message: `Fee assigned to ${assigned} students.`, assigned };
}

async function getStudentFees(userId, filters) {
  const inst = await _getInstitute(userId);
  const { status, class_id } = filters;

  const where  = ['sf.institute_id = ?'];
  const params = [inst.id];
  if (status)   { where.push('sf.status = ?');  params.push(status); }

  const [rows] = await db.query(`
    SELECT sf.id, sf.amount, sf.due_date, sf.status, sf.paid_at,
           up.full_name AS student_name, u.email AS student_email,
           fs.name AS fee_name, fs.type
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    JOIN users u ON u.id = sf.student_id
    JOIN user_profiles up ON up.user_id = sf.student_id
    WHERE ${where.join(' AND ')}
    ORDER BY sf.due_date ASC
  `, params);

  return rows;
}

async function recordManualPayment(feeId, userId, data) {
  const inst = await _getInstitute(userId);
  const { method, notes } = data;
  await db.query(
    "UPDATE student_fees SET status = 'paid', paid_at = NOW(), payment_method = ? WHERE id = ? AND institute_id = ?",
    [method || 'cash', feeId, inst.id]
  );
  return { message: 'Payment recorded.' };
}

async function sendFeeReminder(userId, data) {
  const inst = await _getInstitute(userId);
  const { student_ids } = data;

  const where = student_ids?.length
    ? `AND sf.student_id IN (${student_ids.map(() => '?').join(',')})`
    : '';
  const params = [inst.id, ...(student_ids || [])];

  const [fees] = await db.query(`
    SELECT sf.amount, sf.due_date, u.email, up.full_name AS name, fs.name AS fee_name
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    JOIN users u ON u.id = sf.student_id
    JOIN user_profiles up ON up.user_id = sf.student_id
    WHERE sf.institute_id = ? AND sf.status IN ('pending','overdue') ${where}
  `, params);

  let sent = 0;
  for (const fee of fees) {
    await sendMail({
      to:      fee.email,
      subject: `Fee Payment Reminder — ${inst.name}`,
      html:    `<p>Hi ${fee.name}, your fee <strong>${fee.fee_name}</strong> of ₹${fee.amount} is due on ${fee.due_date}. Please pay at your earliest.</p>`,
    });
    sent++;
  }

  return { message: `Reminders sent to ${sent} students.` };
}

/* ============================================================
   CONTENT MANAGEMENT
============================================================ */

async function getContent(userId, filters) {
  const inst = await _getInstitute(userId);
  const [rows] = await db.query(`
    SELECT sm.id, sm.title, sm.type, sm.subject, sm.status,
           sm.file_url, sm.file_size, sm.created_at,
           c.name AS class_name
    FROM study_materials sm
    LEFT JOIN classes c ON c.id = sm.class_id
    WHERE sm.institute_id = ?
    ORDER BY sm.created_at DESC
  `, [inst.id]);
  return rows;
}

async function uploadVideo(userId, data, file) {
  const inst = await _getInstitute(userId);
  const { title, subject, class_id } = data;
  if (!title) throw new AppError('Title is required.', 400, 'MISSING_TITLE');

  const fileUrl = '/uploads/videos/' + file.filename;

  const [result] = await db.query(
    "INSERT INTO study_materials (instructor_id, institute_id, class_id, title, subject, type, file_url, file_name, file_size, is_free, status) VALUES (?, ?, ?, ?, ?, 'notes', ?, ?, ?, 1, 'published')",
    [userId, inst.id, class_id || null, title, subject || null, fileUrl, file.originalname, file.size]
  );

  return { id: result.insertId, message: 'Video uploaded.' };
}

async function uploadMaterial(userId, data, file) {
  const inst = await _getInstitute(userId);
  const { title, subject, class_id, type } = data;
  if (!title) throw new AppError('Title is required.', 400, 'MISSING_TITLE');

  const fileUrl = '/uploads/materials/' + file.filename;

  const [result] = await db.query(
    "INSERT INTO study_materials (instructor_id, institute_id, class_id, title, subject, type, file_url, file_name, file_size, is_free, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'published')",
    [userId, inst.id, class_id || null, title, subject || null, type || 'notes', fileUrl, file.originalname, file.size]
  );

  return { id: result.insertId, message: 'Material uploaded.' };
}

async function updateContent(contentId, userId, data) {
  const inst = await _getInstitute(userId);
  const { title, subject } = data;
  await db.query(
    'UPDATE study_materials SET title = COALESCE(?, title), subject = COALESCE(?, subject) WHERE id = ? AND institute_id = ?',
    [title || null, subject || null, contentId, inst.id]
  );
  return { message: 'Content updated.' };
}

async function archiveContent(contentId, userId) {
  const inst = await _getInstitute(userId);
  await db.query("UPDATE study_materials SET status = 'archived' WHERE id = ? AND institute_id = ?", [contentId, inst.id]);
  return { message: 'Content archived.' };
}

/* ============================================================
   ANNOUNCEMENTS
============================================================ */

async function getAnnouncements(userId) {
  const inst = await _getInstitute(userId);
  const [rows] = await db.query(`
    SELECT a.id, a.title, a.body, a.target_role, a.created_at,
           up.full_name AS sender_name
    FROM announcements a
    JOIN user_profiles up ON up.user_id = a.sender_id
    WHERE a.institute_id = ?
    ORDER BY a.created_at DESC
    LIMIT 30
  `, [inst.id]);
  return rows;
}

async function createAnnouncement(userId, data) {
  const inst = await _getInstitute(userId);
  const { title, body, target_role } = data;
  if (!title || !body) throw new AppError('Title and body are required.', 400, 'MISSING_FIELDS');

  const [result] = await db.query(
    'INSERT INTO announcements (sender_id, institute_id, target_role, title, body) VALUES (?, ?, ?, ?, ?)',
    [userId, inst.id, target_role || 'all', title, body]
  );

  // Notify institute members
  const roleFilter = target_role && target_role !== 'all' ? `AND im.role = '${target_role}'` : '';
  const [members] = await db.query(
    `SELECT user_id FROM institute_members WHERE institute_id = ? ${roleFilter}`,
    [inst.id]
  );

  if (members.length) {
    const values = members.map(m => [m.user_id, title, body, 'announcement']);
    await db.query('INSERT INTO notifications (user_id, title, body, type) VALUES ?', [values]);
  }

  return { id: result.insertId, message: 'Announcement sent.' };
}

async function deleteAnnouncement(announcementId, userId) {
  const inst = await _getInstitute(userId);
  await db.query('DELETE FROM announcements WHERE id = ? AND institute_id = ?', [announcementId, inst.id]);
  return { message: 'Announcement deleted.' };
}

/* ============================================================
   CERTIFICATES
============================================================ */

async function issueBatchCertificates(userId, data) {
  const inst = await _getInstitute(userId);
  const { student_ids, course_id, title } = data;

  let issued = 0;
  for (const studentId of (student_ids || [])) {
    const code = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16);
    await db.query(
      "INSERT IGNORE INTO certificates (student_id, course_id, institute_id, title, certificate_code, type) VALUES (?, ?, ?, ?, ?, 'course_completion')",
      [studentId, course_id || null, inst.id, title || 'Course Completion', code]
    );
    issued++;
  }

  return { message: `${issued} certificates issued.`, issued };
}

async function generateTransferCert(studentId, userId) {
  const inst = await _getInstitute(userId);
  const code = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16);

  const [[student]] = await db.query('SELECT full_name FROM user_profiles WHERE user_id = ?', [studentId]);

  await db.query(
    "INSERT INTO certificates (student_id, institute_id, title, certificate_code, type) VALUES (?, ?, ?, ?, 'transfer')",
    [studentId, inst.id, `Transfer Certificate — ${student?.full_name}`, code]
  );

  return { message: 'Transfer certificate generated.', code };
}

async function generateBonafideCert(studentId, userId) {
  const inst = await _getInstitute(userId);
  const code = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16);

  const [[student]] = await db.query('SELECT full_name FROM user_profiles WHERE user_id = ?', [studentId]);

  await db.query(
    "INSERT INTO certificates (student_id, institute_id, title, certificate_code, type) VALUES (?, ?, ?, ?, 'bonafide')",
    [studentId, inst.id, `Bonafide Certificate — ${student?.full_name}`, code]
  );

  return { message: 'Bonafide certificate generated.', code };
}

/* ============================================================
   ANALYTICS & REPORTS
============================================================ */

async function getAnalytics(userId, filters) {
  const inst = await _getInstitute(userId);

  // Attendance trend — last 30 days
  const [attTrend] = await db.query(`
    SELECT ats.date,
           COUNT(ar.id) AS total,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present
    FROM attendance_sessions ats
    LEFT JOIN attendance_records ar ON ar.attendance_session_id = ats.id
    JOIN classes c ON c.id = ats.class_id
    WHERE c.institute_id = ? AND ats.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY ats.date
    ORDER BY ats.date ASC
  `, [inst.id]);

  // Class-wise quiz performance
  const [quizPerf] = await db.query(`
    SELECT c.name AS class_name,
           ROUND(AVG(qa.percentage), 1) AS avg_score,
           COUNT(qa.id) AS attempts
    FROM quiz_attempts qa
    JOIN class_students cs ON cs.student_id = qa.student_id
    JOIN classes c ON c.id = cs.class_id
    WHERE c.institute_id = ? AND qa.submitted_at IS NOT NULL
    GROUP BY c.id
    ORDER BY avg_score DESC
  `, [inst.id]);

  // Fee collection summary
  const [[feeSummary]] = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'paid'    THEN amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) AS overdue
    FROM student_fees WHERE institute_id = ?
  `, [inst.id]);

  return {
    attendance_trend: attTrend,
    quiz_performance: quizPerf,
    fee_summary: {
      collected: parseFloat(feeSummary.collected),
      pending:   parseFloat(feeSummary.pending),
      overdue:   parseFloat(feeSummary.overdue),
    },
  };
}

async function getStudentReport(studentId, userId) {
  const inst = await _getInstitute(userId);

  const [[student]] = await db.query(`
    SELECT u.id, up.full_name AS name, u.email, up.grade
    FROM institute_members im
    JOIN users u ON u.id = im.user_id
    JOIN user_profiles up ON up.user_id = im.user_id
    WHERE im.institute_id = ? AND im.user_id = ?
  `, [inst.id, studentId]);

  if (!student) throw new AppError('Student not found.', 404, 'NOT_FOUND');

  const [quizResults] = await db.query(`
    SELECT q.title, qa.score, qa.total_marks, qa.percentage, qa.passed, qa.submitted_at
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
    ORDER BY qa.submitted_at DESC
  `, [studentId]);

  const [assignments] = await db.query(`
    SELECT a.title, s.score, s.status, s.submitted_at, s.feedback
    FROM assignment_submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.student_id = ?
    ORDER BY s.submitted_at DESC
  `, [studentId]);

  const [[attendance]] = await db.query(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present
    FROM attendance_records ar
    WHERE ar.student_id = ?
  `, [studentId]);

  const attPct = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : null;

  return {
    student,
    quiz_results: quizResults,
    assignments,
    attendance: { ...attendance, percentage: attPct },
  };
}

async function getClassReport(classId, userId) {
  const inst = await _getInstitute(userId);

  const [[cls]] = await db.query('SELECT * FROM classes WHERE id = ? AND institute_id = ?', [classId, inst.id]);
  if (!cls) throw new AppError('Class not found.', 404, 'NOT_FOUND');

  const [students] = await db.query(`
    SELECT u.id, up.full_name AS name,
           (SELECT COUNT(*) FROM attendance_records ar
            JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
            WHERE ats.class_id = ? AND ar.student_id = u.id AND ar.status = 'present') AS present_count,
           (SELECT COUNT(*) FROM attendance_records ar
            JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
            WHERE ats.class_id = ? AND ar.student_id = u.id) AS total_count,
           (SELECT ROUND(AVG(qa.percentage), 1) FROM quiz_attempts qa WHERE qa.student_id = u.id AND qa.submitted_at IS NOT NULL) AS avg_score
    FROM class_students cs
    JOIN users u ON u.id = cs.student_id
    JOIN user_profiles up ON up.user_id = cs.student_id
    WHERE cs.class_id = ?
    ORDER BY up.full_name ASC
  `, [classId, classId, classId]);

  return { class: cls, students };
}

async function getAttendanceReport(userId, filters) {
  const inst = await _getInstitute(userId);
  const { from, to, class_id } = filters;

  const where  = ['c.institute_id = ?'];
  const params = [inst.id];
  if (class_id) { where.push('c.id = ?');        params.push(class_id); }
  if (from)     { where.push('ats.date >= ?');   params.push(from); }
  if (to)       { where.push('ats.date <= ?');   params.push(to); }

  const [rows] = await db.query(`
    SELECT up.full_name AS student_name, c.name AS class_name,
           COUNT(ar.id) AS total_sessions,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present,
           ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) / COUNT(ar.id) * 100, 1) AS percentage
    FROM attendance_records ar
    JOIN attendance_sessions ats ON ats.id = ar.attendance_session_id
    JOIN classes c ON c.id = ats.class_id
    JOIN user_profiles up ON up.user_id = ar.student_id
    WHERE ${where.join(' AND ')}
    GROUP BY ar.student_id, c.id
    ORDER BY percentage ASC
  `, params);

  return rows;
}

async function getFeeReport(userId, filters) {
  const inst = await _getInstitute(userId);

  const [[summary]] = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS collected,
      COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END), 0) AS outstanding,
      COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS overdue_count
    FROM student_fees WHERE institute_id = ?
  `, [inst.id]);

  const [breakdown] = await db.query(`
    SELECT fs.name, fs.type,
           COUNT(sf.id) AS total_students,
           SUM(CASE WHEN sf.status = 'paid' THEN sf.amount ELSE 0 END) AS collected,
           SUM(CASE WHEN sf.status != 'paid' THEN sf.amount ELSE 0 END) AS pending
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    WHERE sf.institute_id = ?
    GROUP BY fs.id
    ORDER BY fs.name ASC
  `, [inst.id]);

  return {
    summary: {
      collected:     parseFloat(summary.collected),
      outstanding:   parseFloat(summary.outstanding),
      overdue_count: summary.overdue_count,
    },
    breakdown,
  };
}

module.exports = {
  getDashboard, getProfile, updateProfile, updateLogo, updateAccreditation,
  getStudents, getStudent, addStudent, bulkImportStudents, updateStudent,
  updateStudentStatus, removeStudent, linkParent, generateIdCard,
  getPendingRegistrations, approveRegistration, rejectRegistration,
  getTeachers, getTeacher, addTeacher, bulkImportTeachers,
  updateTeacher, updateTeacherStatus, removeTeacher,
  getClasses, createClass, getClass, updateClass, deleteClass,
  assignStudentToClass, removeStudentFromClass,
  assignTeacherToClass, removeTeacherFromClass, transferStudent,
  getAcademicYears, createAcademicYear, updateAcademicYear,
  getTimetable, createTimetableEntry, updateTimetableEntry, deleteTimetableEntry,
  getCalendar, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  getAttendanceSessions, createAttendanceSession, markAttendance,
  overrideAttendance, getStudentAttendance, getClassAttendance,
  getFeeStructures, createFeeStructure, updateFeeStructure, deleteFeeStructure,
  assignFee, getStudentFees, recordManualPayment, sendFeeReminder,
  getContent, uploadVideo, uploadMaterial, updateContent, archiveContent,
  getAnnouncements, createAnnouncement, deleteAnnouncement,
  issueBatchCertificates, generateTransferCert, generateBonafideCert,
  getAnalytics, getStudentReport, getClassReport, getAttendanceReport, getFeeReport,
};