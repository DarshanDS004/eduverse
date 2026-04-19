/**
 * EduVerse — Student Service (Extended)
 * modules/student/student.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const bcrypt       = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/* ============================================================
   DASHBOARD
============================================================ */

async function getDashboard(userId) {

  const [courses] = await db.query(
    `SELECT
       c.id, c.title, c.thumbnail_url, c.category, c.level,
       up.full_name AS instructor_name,
       COALESCE(cp.completion_percentage, 0) AS progress,
       cp.last_activity_at,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id) AS total_videos,
       (SELECT COUNT(*) FROM video_progress vp2
        JOIN videos v2 ON v2.id = vp2.video_id
        JOIN course_modules cm2 ON cm2.id = v2.module_id
        WHERE cm2.course_id = c.id AND vp2.student_id = e.student_id
          AND vp2.completed = 1) AS watched_videos
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN users u ON u.id = c.instructor_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN course_progress cp
       ON cp.course_id = c.id AND cp.student_id = e.student_id
     WHERE e.student_id = ?
     ORDER BY COALESCE(cp.last_activity_at, e.enrolled_at) DESC
     LIMIT 5`,
    [userId]
  );

  const [assignments] = await db.query(
    `SELECT
       a.id, a.title, a.deadline, a.max_marks AS max_score,
       a.description,
       c.title AS course_title,
       COALESCE(sub.status, 'pending') AS status
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     LEFT JOIN assignment_submissions sub
       ON sub.assignment_id = a.id AND sub.student_id = ?
     WHERE (sub.id IS NULL OR sub.status = 'pending')
       AND (a.deadline IS NULL OR a.deadline >= CURDATE())
     ORDER BY a.deadline ASC
     LIMIT 5`,
    [userId, userId]
  );

  const [liveSessions] = await db.query(
    `SELECT
       ls.id, ls.title, ls.scheduled_at,
       ls.duration_minutes, ls.meeting_link,
       c.title AS course_title,
       up.full_name AS instructor_name
     FROM live_sessions ls
     JOIN courses c ON c.id = ls.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     LEFT JOIN user_profiles up ON up.user_id = ls.instructor_id
     WHERE ls.scheduled_at >= NOW()
       AND ls.status != 'ended'
     ORDER BY ls.scheduled_at ASC
     LIMIT 3`,
    [userId]
  );

  const [[statsRow]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM enrollments WHERE student_id = ?) AS total_courses,
       (SELECT COUNT(*)
        FROM assignments a
        JOIN courses c ON c.id = a.course_id
        JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
        LEFT JOIN assignment_submissions sub
          ON sub.assignment_id = a.id AND sub.student_id = ?
        WHERE (sub.id IS NULL OR sub.status = 'pending')
          AND (a.deadline IS NULL OR a.deadline >= CURDATE())
       ) AS pending_assignments,
       (SELECT COALESCE(ROUND(AVG(percentage), 1), 0)
        FROM quiz_attempts
        WHERE student_id = ? AND submitted_at IS NOT NULL
       ) AS avg_score`,
    [userId, userId, userId, userId]
  );

  const [[attendanceRow]] = await db.query(
    `SELECT
       COUNT(*) AS total_sessions,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count
     FROM attendance_records
     WHERE student_id = ?`,
    [userId]
  );

  const attendanceRate = attendanceRow.total_sessions > 0
    ? Math.round((attendanceRow.present_count / attendanceRow.total_sessions) * 100)
    : 0;

  const [streakRows] = await db.query(
    `SELECT DATE(last_watched_at) AS study_date
     FROM video_progress
     WHERE student_id = ? AND last_watched_at IS NOT NULL
     GROUP BY DATE(last_watched_at)
     ORDER BY study_date DESC
     LIMIT 30`,
    [userId]
  );

  const streak = _calculateStreak(streakRows.map(r => r.study_date));

  const [activity] = await db.query(
    `SELECT
       'video_watched' AS type,
       v.title AS item_title,
       c.title AS course_title,
       vp.last_watched_at AS created_at
     FROM video_progress vp
     JOIN videos v ON v.id = vp.video_id
     JOIN course_modules cm ON cm.id = v.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE vp.student_id = ?
     ORDER BY vp.last_watched_at DESC
     LIMIT 10`,
    [userId]
  );

  const [notifications] = await db.query(
    `SELECT id, title, body, type, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    stats: {
      total_courses:       statsRow.total_courses       || 0,
      pending_assignments: statsRow.pending_assignments || 0,
      attendance_rate:     attendanceRate,
      avg_score:           statsRow.avg_score           || 0,
    },
    streak:        { count: streak.count, days: streak.days },
    courses:       courses,
    assignments:   assignments,
    live_sessions: liveSessions,
    activity:      activity,
    notifications: { items: notifications, unread_count: unreadCount },
  };
}

/* ============================================================
   COURSES — Enrolled list
============================================================ */

async function getCourses(userId) {
  const [rows] = await db.query(
    `SELECT
       c.id, c.title, c.description, c.thumbnail_url,
       c.category, c.level, c.language,
       up.full_name AS instructor_name,
       COALESCE(cp.completion_percentage, 0) AS progress,
       cp.last_activity_at, cp.completed_at,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id) AS total_videos,
       (SELECT COUNT(*) FROM video_progress vp
        JOIN videos v ON v.id = vp.video_id
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id
          AND vp.student_id = e.student_id AND vp.completed = 1) AS watched_videos,
       e.enrolled_at
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN user_profiles up ON up.user_id = c.instructor_id
     LEFT JOIN course_progress cp
       ON cp.course_id = c.id AND cp.student_id = e.student_id
     WHERE e.student_id = ?
     ORDER BY COALESCE(cp.last_activity_at, e.enrolled_at) DESC`,
    [userId]
  );
  return rows;
}

/* ============================================================
   ASSIGNMENTS
============================================================ */

async function getAssignments(userId) {
  const [rows] = await db.query(
    `SELECT
       a.id, a.title, a.description, a.deadline,
       a.max_marks AS max_score,
       c.id AS course_id,
       c.title AS course_title,
       sub.id AS submission_id,
       COALESCE(sub.status, 'pending') AS status,
       sub.score, sub.feedback, sub.submitted_at,
       sub.file_url AS submitted_file_url,
       sub.text AS submitted_text
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     LEFT JOIN assignment_submissions sub
       ON sub.assignment_id = a.id AND sub.student_id = ?
     ORDER BY
       CASE COALESCE(sub.status,'pending')
         WHEN 'pending' THEN 1
         WHEN 'submitted' THEN 2
         WHEN 'graded' THEN 3
       END,
       a.deadline ASC`,
    [userId, userId]
  );
  return rows;
}

async function submitAssignment(userId, assignmentId, text, fileUrl, fileName) {
  // Verify enrolled in the course
  const [assignRows] = await db.query(
    `SELECT a.id, a.deadline, a.course_id
     FROM assignments a
     JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
     WHERE a.id = ?`,
    [userId, assignmentId]
  );

  if (!assignRows.length) {
    throw new AppError('Assignment not found or you are not enrolled.', 404, 'NOT_FOUND');
  }

  const assignment = assignRows[0];
  const isLate = assignment.deadline && new Date() > new Date(assignment.deadline);

  await db.query(
    `INSERT INTO assignment_submissions
       (assignment_id, student_id, text, file_url, file_name, status)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       text = VALUES(text),
       file_url = VALUES(file_url),
       file_name = VALUES(file_name),
       status = VALUES(status),
       submitted_at = NOW()`,
    [assignmentId, userId, text || null, fileUrl || null, fileName || null,
     isLate ? 'late' : 'submitted']
  );

  return { message: 'Assignment submitted successfully.', is_late: isLate };
}

/* ============================================================
   PERFORMANCE
============================================================ */

async function getPerformance(userId, days) {
  const daysNum = parseInt(days) || 30;
  const since   = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

  // Overall stats
  const [[stats]] = await db.query(
    `SELECT
       COALESCE(ROUND(AVG(percentage), 1), 0) AS avg_score,
       COALESCE(MAX(percentage), 0)            AS highest_score,
       COALESCE(MIN(percentage), 0)            AS lowest_score,
       COUNT(*)                                AS quizzes_taken
     FROM quiz_attempts
     WHERE student_id = ? AND submitted_at IS NOT NULL`,
    [userId]
  );

  const [[assignStats]] = await db.query(
    `SELECT COUNT(*) AS assignments_completed
     FROM assignment_submissions
     WHERE student_id = ? AND status = 'graded'`,
    [userId]
  );

  const [[attRow]] = await db.query(
    `SELECT
       COUNT(*) AS total_sessions,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count
     FROM attendance_records
     WHERE student_id = ?`,
    [userId]
  );

  const attendanceRate = attRow.total_sessions > 0
    ? Math.round((attRow.present_count / attRow.total_sessions) * 100) : 0;

  const [[courseStats]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM enrollments WHERE student_id = ?) AS courses_enrolled,
       (SELECT COUNT(*) FROM course_progress
        WHERE student_id = ? AND completion_percentage = 100) AS courses_completed`,
    [userId, userId]
  );

  // Score trend (weekly buckets)
  const [trendRows] = await db.query(
    `SELECT
       DATE_FORMAT(submitted_at, '%d %b') AS label,
       ROUND(AVG(percentage), 1)          AS score
     FROM quiz_attempts
     WHERE student_id = ? AND submitted_at >= ?
     GROUP BY DATE(submitted_at)
     ORDER BY submitted_at ASC`,
    [userId, since]
  );

  // Subject-wise
  const [subjectRows] = await db.query(
    `SELECT
       c.category AS subject,
       ROUND(AVG(qa.percentage), 1) AS avg_score
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     JOIN courses c ON c.id = q.course_id
     WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
       AND c.category IS NOT NULL
     GROUP BY c.category
     ORDER BY avg_score DESC`,
    [userId]
  );

  // Recent quizzes
  const [recentQuizzes] = await db.query(
    `SELECT
       q.title, qa.score, qa.total_marks AS total,
       qa.percentage, qa.passed, qa.submitted_at AS taken_at
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.student_id = ? AND qa.submitted_at IS NOT NULL
     ORDER BY qa.submitted_at DESC
     LIMIT 10`,
    [userId]
  );

  // Assignment grades
  const [grades] = await db.query(
    `SELECT
       a.title, c.title AS course_title,
       sub.score, a.max_marks AS max_score,
       sub.graded_at
     FROM assignment_submissions sub
     JOIN assignments a ON a.id = sub.assignment_id
     JOIN courses c ON c.id = a.course_id
     WHERE sub.student_id = ? AND sub.status = 'graded'
     ORDER BY sub.graded_at DESC
     LIMIT 10`,
    [userId]
  );

  return {
    avg_score:             stats.avg_score,
    highest_score:         stats.highest_score,
    lowest_score:          stats.lowest_score,
    quizzes_taken:         stats.quizzes_taken,
    assignments_completed: assignStats.assignments_completed,
    attendance_rate:       attendanceRate,
    courses_enrolled:      courseStats.courses_enrolled,
    courses_completed:     courseStats.courses_completed,
    score_trend:           trendRows,
    subject_scores:        subjectRows,
    recent_quizzes:        recentQuizzes,
    assignment_grades:     grades,
  };
}

/* ============================================================
   PROFILE
============================================================ */

async function getProfile(userId) {
  const [[row]] = await db.query(
    `SELECT
       u.id, u.email, u.phone, u.role, u.created_at,
       up.full_name AS name, up.photo_url AS avatar,
       up.bio, up.date_of_birth AS dob,
       up.grade, up.institute_code,
       up.city, up.state, up.country,
       (SELECT COUNT(*) FROM enrollments WHERE student_id = u.id) AS enrolled_courses,
       (SELECT COUNT(*) FROM certificates WHERE student_id = u.id) AS certificates,
       (SELECT COALESCE(ROUND(AVG(percentage),1),0) FROM quiz_attempts
        WHERE student_id = u.id AND submitted_at IS NOT NULL) AS avg_score
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  if (!row) throw new AppError('Profile not found.', 404, 'NOT_FOUND');
  return row;
}

async function updateProfile(userId, data) {
  const { name, phone, dob, grade, bio, institute_code, city, state } = data;

  await db.query(
    `UPDATE user_profiles SET
       full_name = COALESCE(?, full_name),
       bio = COALESCE(?, bio),
       date_of_birth = COALESCE(?, date_of_birth),
       grade = COALESCE(?, grade),
       institute_code = COALESCE(?, institute_code),
       city = COALESCE(?, city),
       state = COALESCE(?, state)
     WHERE user_id = ?`,
    [name || null, bio || null, dob || null, grade || null,
     institute_code || null, city || null, state || null, userId]
  );

  if (phone) {
    await db.query(
      'UPDATE users SET phone = ? WHERE id = ?',
      [phone, userId]
    );
  }

  // Update localStorage-cached user object fields
  const [[updated]] = await db.query(
    `SELECT u.id, u.email, u.role, up.full_name AS name, up.photo_url AS avatar
     FROM users u JOIN user_profiles up ON up.user_id = u.id WHERE u.id = ?`,
    [userId]
  );

  return { message: 'Profile updated successfully.', user: updated };
}

async function updatePassword(userId, currentPassword, newPassword) {
  const [[user]] = await db.query(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );

  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new AppError('Current password is incorrect.', 400, 'WRONG_PASSWORD');
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hash   = await bcrypt.hash(newPassword, rounds);

  await db.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [hash, userId]
  );

  // Invalidate all refresh tokens
  await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

  return { message: 'Password updated. Please sign in again.' };
}

async function updateAvatar(userId, photoUrl) {
  await db.query(
    'UPDATE user_profiles SET photo_url = ? WHERE user_id = ?',
    [photoUrl, userId]
  );
  return { message: 'Avatar updated.', avatar_url: photoUrl };
}

/* ============================================================
   CALENDAR
============================================================ */

async function getCalendar(userId, year, month) {
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;

  // First and last day of the requested month
  const from = `${y}-${String(m).padStart(2,'0')}-01`;
  const to   = new Date(y, m, 0).toISOString().split('T')[0];

  const events = [];

  // Assignment deadlines
  const [assignments] = await db.query(
    `SELECT
       a.id, a.title, a.deadline AS date,
       c.title AS course_title,
       'assignment' AS type
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     WHERE DATE(a.deadline) BETWEEN ? AND ?`,
    [userId, from, to]
  );
  events.push(...assignments);

  // Live sessions
  const [sessions] = await db.query(
    `SELECT
       ls.id, ls.title,
       DATE(ls.scheduled_at) AS date,
       ls.scheduled_at,
       c.title AS course_title,
       'live' AS type
     FROM live_sessions ls
     JOIN courses c ON c.id = ls.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     WHERE DATE(ls.scheduled_at) BETWEEN ? AND ?`,
    [userId, from, to]
  );
  events.push(...sessions);

  // Quizzes (from enrolled courses)
  const [quizzes] = await db.query(
    `SELECT
       q.id, q.title,
       DATE(q.created_at) AS date,
       c.title AS course_title,
       'quiz' AS type
     FROM quizzes q
     JOIN courses c ON c.id = q.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     WHERE q.status = 'published'
       AND DATE(q.created_at) BETWEEN ? AND ?`,
    [userId, from, to]
  );
  events.push(...quizzes);

  return events;
}

/* ============================================================
   LESSON PROGRESS
============================================================ */

async function updateLessonProgress(userId, videoId, watchedSeconds) {
  const seconds = parseInt(watchedSeconds) || 0;

  // Get video duration
  const [[video]] = await db.query(
    `SELECT v.id, v.duration, cm.course_id
     FROM videos v
     JOIN course_modules cm ON cm.id = v.module_id
     WHERE v.id = ?`,
    [videoId]
  );

  if (!video) throw new AppError('Video not found.', 404, 'NOT_FOUND');

  const durationSecs = (video.duration || 0) * 60;
  const completed    = durationSecs > 0
    ? (seconds / durationSecs) >= 0.9  // 90% watched = completed
    : false;

  await db.query(
    `INSERT INTO video_progress
       (student_id, video_id, watched_seconds, completed, last_watched_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       watched_seconds = GREATEST(watched_seconds, VALUES(watched_seconds)),
       completed = GREATEST(completed, VALUES(completed)),
       last_watched_at = NOW()`,
    [userId, videoId, seconds, completed ? 1 : 0]
  );

  // Update course completion percentage
  await _updateCourseProgress(userId, video.course_id);

  return { message: 'Progress saved.', completed };
}

async function _updateCourseProgress(userId, courseId) {
  const [[totals]] = await db.query(
    `SELECT
       COUNT(*) AS total_videos,
       (SELECT COUNT(*) FROM video_progress vp
        JOIN videos v ON v.id = vp.video_id
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = ? AND vp.student_id = ? AND vp.completed = 1
       ) AS completed_videos
     FROM videos v
     JOIN course_modules cm ON cm.id = v.module_id
     WHERE cm.course_id = ?`,
    [courseId, userId, courseId]
  );

  const pct = totals.total_videos > 0
    ? Math.round((totals.completed_videos / totals.total_videos) * 100)
    : 0;

  await db.query(
    `INSERT INTO course_progress (student_id, course_id, completion_percentage, last_activity_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       completion_percentage = ?,
       last_activity_at = NOW(),
       completed_at = CASE WHEN ? = 100 THEN NOW() ELSE completed_at END`,
    [userId, courseId, pct, pct, pct]
  );

  // Auto-issue certificate if 100%
  if (pct === 100) {
    await _issueCertificateIfNotExists(userId, courseId);
  }
}

async function _issueCertificateIfNotExists(userId, courseId) {
  const [[exists]] = await db.query(
    'SELECT id FROM certificates WHERE student_id = ? AND course_id = ?',
    [userId, courseId]
  );
  if (exists) return;

  const [[course]] = await db.query(
    'SELECT title FROM courses WHERE id = ?', [courseId]
  );
  if (!course) return;

  const code = 'EV-' + uuidv4().split('-')[0].toUpperCase() + '-' + courseId;
  await db.query(
    `INSERT INTO certificates (student_id, course_id, title, certificate_code)
     VALUES (?, ?, ?, ?)`,
    [userId, courseId, course.title, code]
  );
}

/* ============================================================
   NOTIFICATIONS
============================================================ */

async function getNotifications(userId) {
  const [rows] = await db.query(
    `SELECT id, title, body, type, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  );
  return rows;
}

async function markNotifRead(userId, notifId) {
  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notifId, userId]
  );
  return { message: 'Notification marked as read.' };
}

async function markAllRead(userId) {
  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
    [userId]
  );
  return { message: 'All notifications marked as read.' };
}

/* ============================================================
   ACTIVITY
============================================================ */

async function getActivity(userId, limit) {
  const [rows] = await db.query(
    `SELECT
       'video_watched' AS type,
       v.title AS item_title,
       c.title AS course_title,
       vp.last_watched_at AS created_at
     FROM video_progress vp
     JOIN videos v ON v.id = vp.video_id
     JOIN course_modules cm ON cm.id = v.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE vp.student_id = ?
     ORDER BY vp.last_watched_at DESC
     LIMIT ?`,
    [userId, parseInt(limit) || 20]
  );
  return rows;
}

/* ============================================================
   HELPER — Streak calculation
============================================================ */

function _calculateStreak(dates) {
  if (!dates || dates.length === 0) return { count: 0, days: [] };

  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  const dateSet = new Set(dates.map(d => new Date(d).toDateString()));

  let count   = 0;
  let current = new Date(today);
  while (dateSet.has(current.toDateString())) {
    count++;
    current.setDate(current.getDate() - 1);
  }

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d       = new Date(today);
    d.setDate(d.getDate() - i);
    const done    = dateSet.has(d.toDateString());
    const isToday = d.toDateString() === today.toDateString();
    days.push({
      label: ['S','M','T','W','T','F','S'][d.getDay()],
      date:  d.getDate(),
      done,
      today: isToday,
    });
  }

  return { count, days };
}

async function getCourseProgress(userId, courseId) {
  const [lessons] = await db.query(
    `SELECT
       vp.video_id, vp.watched_seconds, vp.completed, vp.last_watched_at,
       v.title, v.duration
     FROM video_progress vp
     JOIN videos v ON v.id = vp.video_id
     JOIN course_modules cm ON cm.id = v.module_id
     WHERE cm.course_id = ? AND vp.student_id = ?`,
    [courseId, userId]
  );
  const [[courseRow]] = await db.query(
    `SELECT completion_percentage AS progress, last_activity_at, completed_at,
            last_lesson_id
     FROM course_progress WHERE course_id = ? AND student_id = ?`,
    [courseId, userId]
  );
  return { lessons, course: courseRow || { progress: 0 } };
}

module.exports = {
  getDashboard,
  getCourses,
  getAssignments,
  submitAssignment,
  getPerformance,
  getProfile,
  updateProfile,
  updatePassword,
  updateAvatar,
  getCalendar,
  updateLessonProgress,
  getCourseProgress,
  getNotifications,
  markNotifRead,
  markAllRead,
  getActivity,
};