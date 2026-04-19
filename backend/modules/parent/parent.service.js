/**
 * EduVerse — Parent Service
 * modules/parent/parent.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const bcrypt       = require('bcryptjs');

/* ── Helper: verify parent-child link ── */
async function _verifyLink(parentId, studentId) {
  const [[link]] = await db.query(
    'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parentId, studentId]
  );
  if (!link) throw new AppError('Child not found or not linked to your account.', 403, 'FORBIDDEN');
  return link;
}

/* ============================================================
   DASHBOARD
============================================================ */

async function getDashboard(parentId) {
  // All linked children
  const [children] = await db.query(`
    SELECT u.id, up.full_name AS name, up.photo_url AS avatar,
           up.grade, ps.relation
    FROM parent_students ps
    JOIN users u ON u.id = ps.student_id
    JOIN user_profiles up ON up.user_id = ps.student_id
    WHERE ps.parent_id = ?
  `, [parentId]);

  // Per-child summary
  const summaries = [];
  for (const child of children) {
    const [[att]] = await db.query(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
      FROM attendance_records WHERE student_id = ?
    `, [child.id]);

    const attPct = att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

    const [[pending]] = await db.query(`
      SELECT COUNT(*) AS count FROM assignment_submissions
      WHERE student_id = ? AND status IN ('pending','submitted')
    `, [child.id]);

    const [[upcomingQuiz]] = await db.query(`
      SELECT COUNT(*) AS count FROM quizzes q
      JOIN enrollments e ON e.course_id = q.course_id
      WHERE e.student_id = ? AND q.status = 'published'
        AND q.scheduled_at > NOW()
    `, [child.id]);

    const [[fees]] = await db.query(`
      SELECT COUNT(*) AS count FROM student_fees
      WHERE student_id = ? AND status IN ('pending','overdue')
    `, [child.id]);

    summaries.push({
      ...child,
      attendance_pct:   attPct,
      pending_assignments: pending.count,
      upcoming_quizzes: upcomingQuiz.count,
      pending_fees:     fees.count,
    });
  }

  // Recent notifications
  const [notifications] = await db.query(`
    SELECT id, title, body, type, is_read, created_at
    FROM notifications
    WHERE user_id = ? AND is_read = 0
    ORDER BY created_at DESC
    LIMIT 5
  `, [parentId]);

  return {
    children: summaries,
    notifications,
  };
}

/* ============================================================
   CHILDREN MANAGEMENT
============================================================ */

async function getChildren(parentId) {
  const [rows] = await db.query(`
    SELECT u.id, up.full_name AS name, up.photo_url AS avatar,
           up.grade, u.email, ps.relation, ps.linked_at
    FROM parent_students ps
    JOIN users u ON u.id = ps.student_id
    JOIN user_profiles up ON up.user_id = ps.student_id
    WHERE ps.parent_id = ?
    ORDER BY ps.linked_at ASC
  `, [parentId]);
  return rows;
}

async function linkChild(parentId, studentId, relation) {
  // Verify student exists
  const [[student]] = await db.query(
    "SELECT id FROM users WHERE id = ? AND role = 'student'",
    [studentId]
  );
  if (!student) throw new AppError('Student not found.', 404, 'NOT_FOUND');

  // Check if already linked
  const [[existing]] = await db.query(
    'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parentId, studentId]
  );
  if (existing) throw new AppError('Child already linked.', 409, 'ALREADY_LINKED');

  await db.query(
    'INSERT INTO parent_students (parent_id, student_id, relation, is_verified) VALUES (?, ?, ?, 1)',
    [parentId, studentId, relation || 'guardian']
  );

  const [[child]] = await db.query(
    'SELECT full_name FROM user_profiles WHERE user_id = ?', [studentId]
  );

  return { message: `${child?.full_name || 'Child'} linked to your account.` };
}

async function unlinkChild(parentId, studentId) {
  await db.query(
    'DELETE FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parentId, studentId]
  );
  return { message: 'Child unlinked.' };
}

/* ============================================================
   CHILD OVERVIEW
============================================================ */

async function getChildOverview(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  const [[student]] = await db.query(`
    SELECT u.id, up.full_name AS name, up.photo_url AS avatar,
           up.grade, up.date_of_birth, u.email
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = ?
  `, [studentId]);

  // Enrolled courses count
  const [[courses]] = await db.query(
    'SELECT COUNT(*) AS count FROM enrollments WHERE student_id = ?', [studentId]
  );

  // Overall attendance
  const [[att]] = await db.query(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present
    FROM attendance_records WHERE student_id = ?
  `, [studentId]);

  const attPct = att.total > 0 ? Math.round((att.present / att.total) * 100) : null;

  // Average quiz score
  const [[quiz]] = await db.query(`
    SELECT ROUND(AVG(percentage), 1) AS avg_score, COUNT(*) AS total_attempts
    FROM quiz_attempts
    WHERE student_id = ? AND submitted_at IS NOT NULL
  `, [studentId]);

  // Certificates count
  const [[certs]] = await db.query(
    'SELECT COUNT(*) AS count FROM certificates WHERE student_id = ?', [studentId]
  );

  // Today's activity
  const [[todayActivity]] = await db.query(`
    SELECT COUNT(*) AS videos_watched
    FROM video_progress
    WHERE student_id = ? AND DATE(last_watched_at) = CURDATE()
  `, [studentId]);

  return {
    student,
    summary: {
      enrolled_courses:  courses.count,
      attendance_pct:    attPct,
      avg_quiz_score:    quiz.avg_score,
      total_quiz_attempts: quiz.total_attempts,
      certificates_earned: certs.count,
      videos_watched_today: todayActivity.videos_watched,
    },
  };
}

/* ============================================================
   CHILD COURSES
============================================================ */

async function getChildCourses(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  const [rows] = await db.query(`
    SELECT c.id, c.title, c.thumbnail_url, c.category, c.level,
           e.enrolled_at,
           COALESCE(cp.completion_percentage, 0) AS progress,
           cp.last_activity_at,
           up.full_name AS instructor_name
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.student_id = e.student_id
    JOIN user_profiles up ON up.user_id = c.instructor_id
    WHERE e.student_id = ?
    ORDER BY cp.last_activity_at DESC
  `, [studentId]);

  return rows;
}

/* ============================================================
   CHILD PERFORMANCE
============================================================ */

async function getChildPerformance(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  // Quiz history
  const [quizHistory] = await db.query(`
    SELECT q.title, qa.score, qa.total_marks, qa.percentage,
           qa.passed, qa.submitted_at, c.title AS course_title
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    LEFT JOIN courses c ON c.id = q.course_id
    WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
    ORDER BY qa.submitted_at DESC
    LIMIT 20
  `, [studentId]);

  // Assignment grades
  const [assignmentGrades] = await db.query(`
    SELECT a.title, s.score, a.max_marks, s.status, s.feedback,
           s.submitted_at, s.graded_at, c.title AS course_title
    FROM assignment_submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN courses c ON c.id = a.course_id
    WHERE s.student_id = ?
    ORDER BY s.submitted_at DESC
    LIMIT 20
  `, [studentId]);

  // Course progress
  const [courseProgress] = await db.query(`
    SELECT c.title, cp.completion_percentage AS progress, cp.last_activity_at
    FROM course_progress cp
    JOIN courses c ON c.id = cp.course_id
    WHERE cp.student_id = ?
    ORDER BY cp.last_activity_at DESC
  `, [studentId]);

  // Study time (last 7 days)
  const [studyTime] = await db.query(`
    SELECT DATE_FORMAT(last_watched_at, '%a') AS day,
           COUNT(*) AS videos_watched
    FROM video_progress
    WHERE student_id = ?
      AND last_watched_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY DATE(last_watched_at)
    ORDER BY DATE(last_watched_at) ASC
  `, [studentId]);

  return {
    quiz_history:      quizHistory,
    assignment_grades: assignmentGrades,
    course_progress:   courseProgress,
    study_time:        studyTime,
  };
}

/* ============================================================
   CHILD ATTENDANCE
============================================================ */

async function getChildAttendance(parentId, studentId, filters) {
  await _verifyLink(parentId, studentId);

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
    WHERE ${where.join(' AND ')}
    ORDER BY ats.date DESC
  `, params);

  const total   = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const absent  = records.filter(r => r.status === 'absent').length;
  const late    = records.filter(r => r.status === 'late').length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : null;

  return {
    records,
    summary: { total, present, absent, late, percentage },
  };
}

/* ============================================================
   CHILD ASSIGNMENTS
============================================================ */

async function getChildAssignments(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  const [rows] = await db.query(`
    SELECT a.id, a.title, a.deadline, a.max_marks,
           c.title AS course_title,
           s.status, s.score, s.feedback, s.submitted_at, s.graded_at
    FROM assignments a
    JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
    JOIN courses c ON c.id = a.course_id
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
    ORDER BY a.deadline DESC
  `, [studentId, studentId]);

  return rows;
}

/* ============================================================
   CHILD QUIZZES
============================================================ */

async function getChildQuizzes(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  const [rows] = await db.query(`
    SELECT q.id, q.title, qa.score, qa.total_marks,
           qa.percentage, qa.passed, qa.submitted_at,
           c.title AS course_title
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    LEFT JOIN courses c ON c.id = q.course_id
    WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
    ORDER BY qa.submitted_at DESC
  `, [studentId]);

  return rows;
}

/* ============================================================
   CHILD CERTIFICATES
============================================================ */

async function getChildCertificates(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  const [rows] = await db.query(`
    SELECT cert.id, cert.title, cert.certificate_code,
           cert.issued_at, cert.file_url, cert.type,
           c.title AS course_title
    FROM certificates cert
    LEFT JOIN courses c ON c.id = cert.course_id
    WHERE cert.student_id = ?
    ORDER BY cert.issued_at DESC
  `, [studentId]);

  return rows;
}

/* ============================================================
   CHILD ACTIVITY
============================================================ */

async function getChildActivity(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  // Videos watched today
  const [videosToday] = await db.query(`
    SELECT v.title, c.title AS course_title, vp.last_watched_at
    FROM video_progress vp
    JOIN videos v ON v.id = vp.video_id
    JOIN course_modules cm ON cm.id = v.module_id
    JOIN courses c ON c.id = cm.course_id
    WHERE vp.student_id = ? AND DATE(vp.last_watched_at) = CURDATE()
    ORDER BY vp.last_watched_at DESC
  `, [studentId]);

  // Recent quiz attempts
  const [recentQuizzes] = await db.query(`
    SELECT q.title, qa.percentage, qa.passed, qa.submitted_at
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
    ORDER BY qa.submitted_at DESC
    LIMIT 5
  `, [studentId]);

  // Recent submissions
  const [recentSubmissions] = await db.query(`
    SELECT a.title, s.status, s.submitted_at
    FROM assignment_submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.student_id = ?
    ORDER BY s.submitted_at DESC
    LIMIT 5
  `, [studentId]);

  return {
    videos_today:       videosToday,
    recent_quizzes:     recentQuizzes,
    recent_submissions: recentSubmissions,
  };
}

/* ============================================================
   FEES & PAYMENTS
============================================================ */

async function getChildFees(parentId, studentId) {
  await _verifyLink(parentId, studentId);

  const [rows] = await db.query(`
    SELECT sf.id, sf.amount, sf.due_date, sf.status,
           sf.paid_at, sf.payment_method,
           fs.name AS fee_name, fs.type,
           i.name AS institute_name
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    JOIN institutes i ON i.id = sf.institute_id
    WHERE sf.student_id = ?
    ORDER BY sf.due_date ASC
  `, [studentId]);

  return rows;
}

async function getPaymentHistory(parentId) {
  const [rows] = await db.query(`
    SELECT p.id, p.amount, p.currency, p.type, p.status,
           p.created_at, p.gateway_payment_id
    FROM payments p
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT 50
  `, [parentId]);
  return rows;
}

/* ============================================================
   MESSAGES (reuses messages module logic)
============================================================ */

async function getMessageRooms(parentId) {
  const [rows] = await db.query(`
    SELECT
      mr.id,
      CASE WHEN mr.user_one_id = ? THEN mr.user_two_id ELSE mr.user_one_id END AS other_user_id,
      CASE WHEN mr.user_one_id = ? THEN up2.full_name ELSE up1.full_name END AS other_user_name,
      CASE WHEN mr.user_one_id = ? THEN up2.photo_url ELSE up1.photo_url END AS other_user_avatar,
      CASE WHEN mr.user_one_id = ? THEN u2.role ELSE u1.role END AS other_user_role,
      (SELECT content FROM messages WHERE room_id = mr.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE room_id = mr.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
      (SELECT COUNT(*) FROM messages WHERE room_id = mr.id AND sender_id != ? AND is_read = 0) AS unread_count
    FROM message_rooms mr
    JOIN users u1 ON u1.id = mr.user_one_id
    JOIN users u2 ON u2.id = mr.user_two_id
    JOIN user_profiles up1 ON up1.user_id = mr.user_one_id
    JOIN user_profiles up2 ON up2.user_id = mr.user_two_id
    WHERE mr.user_one_id = ? OR mr.user_two_id = ?
    ORDER BY COALESCE(last_message_at, mr.created_at) DESC
  `, [parentId, parentId, parentId, parentId, parentId, parentId, parentId]);

  return rows;
}

async function getOrCreateRoom(parentId, otherUserId) {
  if (parentId === parseInt(otherUserId)) throw new AppError('Cannot message yourself.', 400, 'INVALID_REQUEST');

  const u1 = Math.min(parentId, parseInt(otherUserId));
  const u2 = Math.max(parentId, parseInt(otherUserId));

  const [[existing]] = await db.query(
    'SELECT id FROM message_rooms WHERE user_one_id = ? AND user_two_id = ?', [u1, u2]
  );

  if (existing) return { id: existing.id };

  const [result] = await db.query(
    'INSERT INTO message_rooms (user_one_id, user_two_id) VALUES (?, ?)', [u1, u2]
  );

  return { id: result.insertId };
}

async function getMessages(roomId, parentId, limit) {
  const [[room]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [roomId, parentId, parentId]
  );
  if (!room) throw new AppError('Room not found.', 404, 'NOT_FOUND');

  const [msgs] = await db.query(`
    SELECT m.id, m.content, m.is_read, m.created_at,
           m.sender_id, up.full_name AS sender_name,
           up.photo_url AS sender_avatar,
           (m.sender_id = ?) AS is_mine
    FROM messages m
    JOIN user_profiles up ON up.user_id = m.sender_id
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC
    LIMIT ?
  `, [parentId, roomId, parseInt(limit) || 50]);

  return { messages: msgs };
}

async function sendMessage(roomId, parentId, content) {
  if (!content?.trim()) throw new AppError('Message cannot be empty.', 400, 'EMPTY_MESSAGE');

  const [[room]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [roomId, parentId, parentId]
  );
  if (!room) throw new AppError('Room not found.', 404, 'NOT_FOUND');

  const [result] = await db.query(
    'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
    [roomId, parentId, content.trim()]
  );

  await db.query('UPDATE message_rooms SET updated_at = NOW() WHERE id = ?', [roomId]);

  const [[msg]] = await db.query(`
    SELECT m.id, m.content, m.is_read, m.created_at,
           m.sender_id, up.full_name AS sender_name, 1 AS is_mine
    FROM messages m
    JOIN user_profiles up ON up.user_id = m.sender_id
    WHERE m.id = ?
  `, [result.insertId]);

  return msg;
}

async function markRoomRead(roomId, parentId) {
  await db.query(
    'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?',
    [roomId, parentId]
  );
  return { message: 'Messages marked as read.' };
}

/* ============================================================
   ANNOUNCEMENTS
============================================================ */

async function getAnnouncements(parentId) {
  const [rows] = await db.query(`
    SELECT a.id, a.title, a.body, a.created_at,
           up.full_name AS sender_name,
           i.name AS institute_name
    FROM announcements a
    JOIN user_profiles up ON up.user_id = a.sender_id
    LEFT JOIN institutes i ON i.id = a.institute_id
    WHERE a.target_role IN ('all','parent') AND a.is_active = 1
    ORDER BY a.created_at DESC
    LIMIT 30
  `);
  return rows;
}

/* ============================================================
   MEETINGS
============================================================ */

async function getMeetings(parentId) {
  const [rows] = await db.query(`
    SELECT ptm.id, ptm.scheduled_at, ptm.duration_min,
           ptm.meeting_link, ptm.status, ptm.notes,
           up_t.full_name AS teacher_name,
           up_s.full_name AS student_name,
           i.name AS institute_name
    FROM ptm_meetings ptm
    JOIN user_profiles up_t ON up_t.user_id = ptm.teacher_id
    JOIN user_profiles up_s ON up_s.user_id = ptm.student_id
    JOIN institutes i ON i.id = ptm.institute_id
    WHERE ptm.parent_id = ?
    ORDER BY ptm.scheduled_at DESC
  `, [parentId]);
  return rows;
}

async function requestMeeting(parentId, data) {
  const { teacher_id, student_id, institute_id, scheduled_at, notes } = data;

  if (!teacher_id || !student_id || !institute_id || !scheduled_at) {
    throw new AppError('teacher_id, student_id, institute_id and scheduled_at are required.', 400, 'MISSING_FIELDS');
  }

  // Verify this parent is linked to the student
  await _verifyLink(parentId, student_id);

  const [result] = await db.query(`
    INSERT INTO ptm_meetings
      (institute_id, teacher_id, parent_id, student_id, scheduled_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [institute_id, teacher_id, parentId, student_id, scheduled_at, notes || null]);

  // Notify teacher
  await db.query(
    "INSERT INTO notifications (user_id, title, body, type) VALUES (?, 'PTM Meeting Request', ?, 'meeting')",
    [teacher_id, `A parent has requested a meeting on ${new Date(scheduled_at).toLocaleDateString('en-IN')}.`]
  );

  return { id: result.insertId, message: 'Meeting requested.' };
}

async function cancelMeeting(meetingId, parentId) {
  const [[meeting]] = await db.query(
    'SELECT id FROM ptm_meetings WHERE id = ? AND parent_id = ?',
    [meetingId, parentId]
  );
  if (!meeting) throw new AppError('Meeting not found.', 404, 'NOT_FOUND');

  await db.query(
    "UPDATE ptm_meetings SET status = 'cancelled' WHERE id = ?",
    [meetingId]
  );
  return { message: 'Meeting cancelled.' };
}

/* ============================================================
   NOTIFICATIONS
============================================================ */

async function getNotifications(parentId, filters) {
  const limit = parseInt(filters.limit) || 20;
  const [rows] = await db.query(`
    SELECT id, title, body, type, is_read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `, [parentId, limit]);
  return rows;
}

async function markAllRead(parentId) {
  await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [parentId]);
  return { message: 'All notifications marked as read.' };
}

async function markOneRead(notifId, parentId) {
  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notifId, parentId]
  );
  return { message: 'Notification marked as read.' };
}

/* ============================================================
   PROFILE
============================================================ */

async function getProfile(parentId) {
  const [[row]] = await db.query(`
    SELECT u.id, u.email, u.phone, u.created_at,
           up.full_name AS name, up.photo_url AS avatar,
           up.relation, up.notif_prefs
    FROM users u
    JOIN user_profiles up ON up.user_id = u.id
    WHERE u.id = ?
  `, [parentId]);

  if (!row) throw new AppError('Profile not found.', 404, 'NOT_FOUND');
  return row;
}

async function updateProfile(parentId, data) {
  const { name, phone, relation } = data;

  await db.query(`
    UPDATE user_profiles SET
      full_name = COALESCE(?, full_name),
      relation  = COALESCE(?, relation)
    WHERE user_id = ?
  `, [name || null, relation || null, parentId]);

  if (phone) {
    await db.query('UPDATE users SET phone = ? WHERE id = ?', [phone, parentId]);
  }

  return { message: 'Profile updated.' };
}

async function updatePassword(parentId, currentPassword, newPassword) {
  const [[user]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [parentId]);
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) throw new AppError('Current password is incorrect.', 400, 'WRONG_PASSWORD');

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hash   = await bcrypt.hash(newPassword, rounds);

  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, parentId]);
  await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [parentId]);

  return { message: 'Password updated. Please sign in again.' };
}

async function updateNotifPrefs(parentId, prefs) {
  await db.query(
    'UPDATE user_profiles SET notif_prefs = ? WHERE user_id = ?',
    [JSON.stringify(prefs), parentId]
  );
  return { message: 'Notification preferences updated.' };
}

module.exports = {
  getDashboard,
  getChildren, linkChild, unlinkChild,
  getChildOverview, getChildCourses, getChildPerformance,
  getChildAttendance, getChildAssignments, getChildQuizzes,
  getChildCertificates, getChildActivity,
  getChildFees, getPaymentHistory,
  getMessageRooms, getOrCreateRoom, getMessages, sendMessage, markRoomRead,
  getAnnouncements,
  getMeetings, requestMeeting, cancelMeeting,
  getNotifications, markAllRead, markOneRead,
  getProfile, updateProfile, updatePassword, updateNotifPrefs,
};