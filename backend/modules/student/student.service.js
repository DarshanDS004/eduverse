/**
 * EduVerse — Student Service
 * modules/student/student.service.js
 */

'use strict';

const db = require('../../config/db');

/* ============================================================
   DASHBOARD
============================================================ */

async function getDashboard(userId) {

  // ── Enrolled courses with progress ──
  const [courses] = await db.query(
    `SELECT
       e.id           AS enrollment_id,
       c.id           AS course_id,
       c.title,
       c.thumbnail_url,
       c.category,
       c.level,
       CONCAT(up.full_name) AS instructor_name,
       COALESCE(cp.completion_percentage, 0) AS progress,
       cp.last_activity_at,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id) AS total_videos,
       (SELECT COUNT(*) FROM video_progress vp2
        JOIN videos v2 ON v2.id = vp2.video_id
        JOIN course_modules cm2 ON cm2.id = v2.module_id
        WHERE cm2.course_id = c.id AND vp2.student_id = e.student_id AND vp2.completed = 1) AS watched_videos
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN users u ON u.id = c.instructor_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.student_id = e.student_id
     WHERE e.student_id = ?
     ORDER BY COALESCE(cp.last_activity_at, e.enrolled_at) DESC
     LIMIT 5`,
    [userId]
  );

  // ── Pending assignments ──
  const [assignments] = await db.query(
    `SELECT
       a.id, a.title, a.deadline, a.max_marks,
       c.title AS course_title,
       COALESCE(sub.status, 'pending') AS status
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
     WHERE (sub.id IS NULL OR sub.status = 'pending')
       AND (a.deadline IS NULL OR a.deadline >= CURDATE())
     ORDER BY a.deadline ASC
     LIMIT 5`,
    [userId, userId]
  );

  // ── Upcoming live sessions ──
  const [liveSessions] = await db.query(
    `SELECT
       ls.id, ls.title, ls.scheduled_at,
       ls.duration_minutes, ls.meeting_link,
       c.title AS course_title,
       up.full_name AS instructor_name
     FROM live_sessions ls
     JOIN courses c ON c.id = ls.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
     LEFT JOIN users u ON u.id = ls.instructor_id
     LEFT JOIN user_profiles up ON up.user_id = u.id
     WHERE ls.scheduled_at >= NOW()
       AND ls.status != 'ended'
     ORDER BY ls.scheduled_at ASC
     LIMIT 3`,
    [userId]
  );

  // ── Stats ──
  const [[statsRow]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM enrollments WHERE student_id = ?) AS total_courses,
       (SELECT COUNT(*)
        FROM assignments a
        JOIN courses c ON c.id = a.course_id
        JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
        LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
        WHERE (sub.id IS NULL OR sub.status = 'pending')
          AND (a.deadline IS NULL OR a.deadline >= CURDATE())
       ) AS pending_assignments,
       (SELECT COALESCE(ROUND(AVG(qa.score), 1), 0)
        FROM quiz_attempts qa
        WHERE qa.student_id = ?
          AND qa.submitted_at IS NOT NULL
       ) AS avg_score`,
    [userId, userId, userId, userId]
  );

  // ── Attendance ──
  const [[attendanceRow]] = await db.query(
    `SELECT
       COUNT(*) AS total_sessions,
       SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present_count
     FROM attendance_records ar
     WHERE ar.student_id = ?`,
    [userId]
  );

  const attendanceRate = attendanceRow.total_sessions > 0
    ? Math.round((attendanceRow.present_count / attendanceRow.total_sessions) * 100)
    : 0;

  // ── Study streak ──
  const [streakRows] = await db.query(
    `SELECT DATE(last_watched_at) AS study_date
     FROM video_progress
     WHERE student_id = ?
       AND last_watched_at IS NOT NULL
     GROUP BY DATE(last_watched_at)
     ORDER BY study_date DESC
     LIMIT 30`,
    [userId]
  );

  const streak = _calculateStreak(streakRows.map(r => r.study_date));

  // ── Recent activity ──
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

  // ── Notifications ──
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
    streak: {
      count: streak.count,
      days:  streak.days,
    },
    courses:       courses,
    assignments:   assignments,
    live_sessions: liveSessions,
    activity:      activity,
    notifications: {
      items:        notifications,
      unread_count: unreadCount,
    },
  };
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
    [userId, limit || 20]
  );
  return rows;
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
    `UPDATE notifications SET is_read = 1
     WHERE id = ? AND user_id = ?`,
    [notifId, userId]
  );
  return { message: 'Notification marked as read.' };
}

async function markAllRead(userId) {
  await db.query(
    `UPDATE notifications SET is_read = 1
     WHERE user_id = ?`,
    [userId]
  );
  return { message: 'All notifications marked as read.' };
}

/* ============================================================
   HELPER — Calculate streak
============================================================ */

function _calculateStreak(dates) {
  if (!dates || dates.length === 0) return { count: 0, days: [] };

  const today    = new Date();
  today.setHours(0, 0, 0, 0);

  const dateSet  = new Set(dates.map(d => new Date(d).toDateString()));
  let   count    = 0;
  let   current  = new Date(today);

  while (dateSet.has(current.toDateString())) {
    count++;
    current.setDate(current.getDate() - 1);
  }

  // Last 7 days for display
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d    = new Date(today);
    d.setDate(d.getDate() - i);
    const done = dateSet.has(d.toDateString());
    const isToday = d.toDateString() === today.toDateString();
    days.push({
      label: ['S','M','T','W','T','F','S'][d.getDay()],
      date:  d.getDate(),
      done:  done,
      today: isToday,
    });
  }

  return { count, days };
}

module.exports = {
  getDashboard,
  getActivity,
  getNotifications,
  markNotifRead,
  markAllRead,
};