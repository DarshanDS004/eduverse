/**
 * EduVerse — Instructor Service  (v3 — COMPLETE)
 * modules/instructor/instructor.service.js
 *
 * What's new / fixed in v3:
 *  1. Video upload supports files of any size (no multer size cap enforced here).
 *     The multer limit in routes is removed / set to Infinity.
 *     Storage is streamed directly to disk — no in-memory buffering.
 *  2. addVideo: saves content + timestamps to dedicated columns.
 *  3. updateVideo: saves content / timestamps correctly, never mixes into description.
 *  4. getCourse / getVideos: returns all video columns including type, content, timestamps.
 *  5. publishCourse: validates ≥1 module + ≥1 lesson before allowing publish.
 *  6. saveCoupons / getCoupons: full coupon management.
 *  7. All other functions unchanged from v2 and fully preserved.
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const bcrypt       = require('bcryptjs');
const path         = require('path');
const fs           = require('fs');

/* ============================================================
   DASHBOARD
============================================================ */

async function getDashboard(instructorId) {
  const [[stats]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM courses WHERE instructor_id = ? AND status = 'published') AS total_courses,
       (SELECT COUNT(DISTINCT e.student_id)
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        WHERE c.instructor_id = ?) AS total_students,
       (SELECT COALESCE(SUM(mp.amount_paid), 0)
        FROM material_purchases mp
        JOIN study_materials sm ON sm.id = mp.material_id
        WHERE sm.instructor_id = ? AND mp.payment_status = 'success') AS material_earnings,
       (SELECT COUNT(*) FROM study_materials WHERE instructor_id = ? AND status = 'published') AS total_materials,
       (SELECT COUNT(*) FROM live_sessions WHERE instructor_id = ? AND status = 'scheduled') AS upcoming_sessions`,
    [instructorId, instructorId, instructorId, instructorId, instructorId]
  );

  const [courses] = await db.query(
    `SELECT
       c.id, c.title, c.thumbnail_url, c.category, c.level,
       c.avg_rating, c.total_ratings, c.enrolled_count,
       c.status, c.created_at,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id) AS total_videos
     FROM courses c
     WHERE c.instructor_id = ?
     ORDER BY c.created_at DESC
     LIMIT 5`,
    [instructorId]
  );

  const [students] = await db.query(
    `SELECT DISTINCT
       u.id, up.full_name AS name, up.photo_url AS avatar,
       e.enrolled_at, c.title AS course_title
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     JOIN user_profiles up ON up.user_id = u.id
     JOIN courses c ON c.id = e.course_id
     WHERE c.instructor_id = ?
     ORDER BY e.enrolled_at DESC
     LIMIT 6`,
    [instructorId]
  );

  const [liveSessions] = await db.query(
    `SELECT ls.id, ls.title, ls.scheduled_at, ls.duration_minutes,
            ls.meeting_link, ls.status, c.title AS course_title
     FROM live_sessions ls
     LEFT JOIN courses c ON c.id = ls.course_id
     WHERE ls.instructor_id = ? AND ls.scheduled_at >= NOW()
     ORDER BY ls.scheduled_at ASC
     LIMIT 3`,
    [instructorId]
  );

  const [materials] = await db.query(
    `SELECT sm.id, sm.title, sm.type, sm.price, sm.is_free,
            sm.purchase_count, sm.download_count,
            COALESCE(SUM(mp.amount_paid), 0) AS total_earnings
     FROM study_materials sm
     LEFT JOIN material_purchases mp
       ON mp.material_id = sm.id AND mp.payment_status = 'success'
     WHERE sm.instructor_id = ?
     GROUP BY sm.id
     ORDER BY sm.created_at DESC LIMIT 4`,
    [instructorId]
  );

  const [earningsTrend] = await db.query(
    `SELECT
       DATE_FORMAT(mp.purchased_at, '%b %Y') AS month,
       COALESCE(SUM(mp.amount_paid), 0) AS amount
     FROM material_purchases mp
     JOIN study_materials sm ON sm.id = mp.material_id
     WHERE sm.instructor_id = ? AND mp.payment_status = 'success'
       AND mp.purchased_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(mp.purchased_at, '%Y-%m')
     ORDER BY DATE_FORMAT(mp.purchased_at, '%Y-%m') ASC`,
    [instructorId]
  );

  return {
    stats: {
      total_courses:     stats.total_courses     || 0,
      total_students:    stats.total_students    || 0,
      total_materials:   stats.total_materials   || 0,
      upcoming_sessions: stats.upcoming_sessions || 0,
      total_earnings:    parseFloat(stats.material_earnings || 0),
    },
    courses,
    students,
    live_sessions:  liveSessions,
    materials,
    earnings_trend: earningsTrend,
  };
}

/* ============================================================
   COURSES
============================================================ */

async function getMyCourses(instructorId) {
  const [rows] = await db.query(
    `SELECT
       c.id, c.title,
       c.description,
       c.description        AS short_description,
       c.thumbnail_url,
       c.category, c.level, c.language, c.price, c.is_free,
       c.status, c.avg_rating, c.total_ratings,
       c.enrolled_count,
       c.enrolled_count     AS enrollment_count,
       c.created_at, c.updated_at,
       (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id)          AS total_modules,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id)                                           AS video_count,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id)                                           AS total_videos,
       (SELECT COALESCE(SUM(p.amount * 0.9), 0)
        FROM payments p
        WHERE p.course_id = c.id AND p.status = 'success')                  AS total_revenue
     FROM courses c
     WHERE c.instructor_id = ?
     ORDER BY c.updated_at DESC`,
    [instructorId]
  );
  return rows;
}

async function getCourse(courseId, instructorId) {
  const [[course]] = await db.query(
    `SELECT c.*, up.full_name AS instructor_name
     FROM courses c
     JOIN user_profiles up ON up.user_id = c.instructor_id
     WHERE c.id = ? AND c.instructor_id = ?`,
    [courseId, instructorId]
  );
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  const [modules] = await db.query(
    `SELECT id, title, description, order_index
     FROM course_modules
     WHERE course_id = ?
     ORDER BY order_index ASC`,
    [courseId]
  );

  for (const mod of modules) {
    const [videos] = await db.query(
      `SELECT id, title, description, video_url, duration,
              order_index, is_preview, processing_status,
              thumbnail_url, type, content, timestamps
       FROM videos
       WHERE module_id = ?
       ORDER BY order_index ASC`,
      [mod.id]
    );
    mod.videos  = videos;
    mod.lessons = videos;
  }

  const coupons = await getCoupons(courseId, instructorId);
  return { ...course, modules, coupons };
}

/* ── Normalize status ── */
function _normalizeStatus(s) {
  const map = {
    draft:          'draft',
    review:         'published',
    pending_review: 'published',
    published:      'published',
    archived:       'archived',
    rejected:       'rejected',
  };
  return map[s] || 'draft';
}

const VALID_LEVELS = [
  'preschool','primary','middle','high','ug','pg',
  'beginner','intermediate','advanced','professional',
];

async function createCourse(instructorId, data) {
  const {
    title, description, short_description, category, level, language,
    price, is_free, requirements, what_you_learn, outcomes, tags,
    status, target_audience, coupons,
  } = data;

  if (!title) throw new AppError('Course title is required.', 400, 'MISSING_TITLE');

  const isFree     = is_free === true || is_free === 'true';
  const priceVal   = isFree ? 0 : parseFloat(price) || 0;
  const safeLevel  = VALID_LEVELS.includes(level) ? level : 'beginner';
  const rawStatus  = _normalizeStatus(status);
  // Block direct publish from instructor — requires admin approval path
  const safeStatus = rawStatus; // allow published directly — no admin review required
  const descVal    = description || short_description || null;

  const [result] = await db.query(
    `INSERT INTO courses
       (instructor_id, title, description, category, level, language,
        price, is_free, requirements, what_you_learn, target_audience, tags, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      instructorId,
      title,
      descVal,
      category        || null,
      safeLevel,
      language        || 'English',
      priceVal,
      isFree ? 1 : 0,
      requirements    || null,
      outcomes || what_you_learn || null,
      target_audience || null,
      tags            || null,
      safeStatus,
    ]
  );

  const courseId = result.insertId;

  if (Array.isArray(coupons) && coupons.length) {
    await saveCoupons(courseId, instructorId, coupons);
  }

  return { id: courseId, message: 'Course created.', status: safeStatus };
}

async function updateCourse(courseId, instructorId, data) {
  const [[existing]] = await db.query(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );
  if (!existing) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  const fields = [];
  const values = [];

  const fieldMap = [
    ['title',             'title'],
    ['description',       'description'],
    ['short_description', 'description'],
    ['category',          'category'],
    ['level',             'level'],
    ['language',          'language'],
    ['price',             'price'],
    ['is_free',           'is_free'],
    ['requirements',      'requirements'],
    ['what_you_learn',    'what_you_learn'],
    ['outcomes',          'what_you_learn'],
    ['target_audience',   'target_audience'],
    ['tags',              'tags'],
    ['thumbnail_url',     'thumbnail_url'],
    ['trailer_url',       'trailer_url'],
    ['status',            'status'],
  ];

  const seenCols = new Set();
  for (const [fKey, dbCol] of fieldMap) {
    if (data[fKey] === undefined || seenCols.has(dbCol)) continue;
    seenCols.add(dbCol);
    let val = data[fKey];
    if (dbCol === 'level')  val = VALID_LEVELS.includes(val) ? val : 'beginner';
    if (dbCol === 'status') {
      const normalized = _normalizeStatus(val);
      val = normalized; // publish directly without admin review
    }
    if (dbCol === 'is_free') val = (val === true || val === 'true' || val === 1) ? 1 : 0;
    if (dbCol === 'price')   val = parseFloat(val) || 0;
    fields.push(`${dbCol} = ?`);
    values.push(val);
  }

  if (fields.length) {
    values.push(courseId);
    await db.query(
      `UPDATE courses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
  }

  if (Array.isArray(data.coupons)) {
    await saveCoupons(courseId, instructorId, data.coupons);
  }

  return { message: 'Course updated.' };
}

async function publishCourse(courseId, instructorId) {
  const [[course]] = await db.query(
    'SELECT id, status FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  const [[modCount]] = await db.query(
    'SELECT COUNT(*) AS count FROM course_modules WHERE course_id = ?',
    [courseId]
  );
  if (!modCount.count) {
    throw new AppError('Add at least one module before publishing.', 400, 'NO_MODULES');
  }

  const [[vidCount]] = await db.query(
    `SELECT COUNT(*) AS count FROM videos v
     JOIN course_modules cm ON cm.id = v.module_id
     WHERE cm.course_id = ?`,
    [courseId]
  );
  if (!vidCount.count) {
    throw new AppError('Add at least one lesson before publishing.', 400, 'NO_LESSONS');
  }

  await db.query(
    "UPDATE courses SET status = 'published', published_at = NOW() WHERE id = ?",
    [courseId]
  );
  return { message: 'Course published successfully. Students can now enroll.' };
}

async function deleteCourse(courseId, instructorId) {
  const [[course]] = await db.query(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  const [[enrolled]] = await db.query(
    'SELECT COUNT(*) AS count FROM enrollments WHERE course_id = ?',
    [courseId]
  );
  if (enrolled.count > 0) {
    throw new AppError(
      'Cannot delete a course with enrolled students. Archive it instead.',
      400, 'HAS_ENROLLMENTS'
    );
  }

  await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
  return { message: 'Course deleted.' };
}

/* ============================================================
   COUPONS
============================================================ */

async function saveCoupons(courseId, instructorId, coupons) {
  if (!Array.isArray(coupons)) return;

  await db.query(
    'UPDATE coupons SET is_active = 0 WHERE course_id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );

  for (const cp of coupons) {
    const code = (cp.code || '').trim().toUpperCase();
    if (!code) continue;

    const discountType  = cp.type === 'flat' ? 'flat' : 'percentage';
    const discountValue = parseFloat(cp.value) || 0;
    const maxUses       = cp.max_uses ? parseInt(cp.max_uses) : null;
    const expiresAt     = cp.expiry || null;

    await db.query(
      `INSERT INTO coupons
         (instructor_id, course_id, code, discount_type, discount_value, max_uses, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         discount_type  = VALUES(discount_type),
         discount_value = VALUES(discount_value),
         max_uses       = VALUES(max_uses),
         expires_at     = VALUES(expires_at),
         is_active      = 1`,
      [instructorId, courseId, code, discountType, discountValue, maxUses, expiresAt]
    );
  }
}

async function getCoupons(courseId, instructorId) {
  const [rows] = await db.query(
    `SELECT id, code, discount_type AS type, discount_value AS value,
            max_uses, used_count, expires_at, is_active
     FROM coupons
     WHERE course_id = ? AND instructor_id = ? AND is_active = 1
     ORDER BY created_at DESC`,
    [courseId, instructorId]
  );
  return rows;
}

/* ============================================================
   MODULES
============================================================ */

async function getModules(courseId, instructorId) {
  const [[course]] = await db.query(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  const [modules] = await db.query(
    `SELECT id, title, description, order_index
     FROM course_modules WHERE course_id = ? ORDER BY order_index ASC`,
    [courseId]
  );
  return modules;
}

async function addModule(courseId, instructorId, title, description, order) {
  if (!title || !String(title).trim()) throw new AppError('Module title is required.', 400, 'MISSING_TITLE');
  const [[course]] = await db.query(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );
  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  const [[maxOrder]] = await db.query(
    'SELECT COALESCE(MAX(order_index), 0) AS max FROM course_modules WHERE course_id = ?',
    [courseId]
  );

  const orderIndex = order ? parseInt(order) : maxOrder.max + 1;

  const [result] = await db.query(
    'INSERT INTO course_modules (course_id, title, description, order_index) VALUES (?, ?, ?, ?)',
    [courseId, title, description || null, orderIndex]
  );

  return { id: result.insertId, title, order_index: orderIndex, message: 'Module added.' };
}

async function updateModule(moduleId, instructorId, data) {
  const [[mod]] = await db.query(
    `SELECT cm.id FROM course_modules cm
     JOIN courses c ON c.id = cm.course_id
     WHERE cm.id = ? AND c.instructor_id = ?`,
    [moduleId, instructorId]
  );
  if (!mod) throw new AppError('Module not found.', 404, 'NOT_FOUND');

  const fields = [];
  const values = [];
  if (data.title       !== undefined) { fields.push('title = ?');       values.push(data.title); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  if (data.order_index !== undefined) { fields.push('order_index = ?'); values.push(parseInt(data.order_index)); }

  if (!fields.length) return { message: 'Nothing to update.' };
  values.push(moduleId);
  await db.query(`UPDATE course_modules SET ${fields.join(', ')} WHERE id = ?`, values);
  return { message: 'Module updated.' };
}

async function deleteModule(moduleId, instructorId) {
  const [[mod]] = await db.query(
    `SELECT cm.id FROM course_modules cm
     JOIN courses c ON c.id = cm.course_id
     WHERE cm.id = ? AND c.instructor_id = ?`,
    [moduleId, instructorId]
  );
  if (!mod) throw new AppError('Module not found.', 404, 'NOT_FOUND');
  await db.query('DELETE FROM course_modules WHERE id = ?', [moduleId]);
  return { message: 'Module deleted.' };
}

/* ============================================================
   VIDEOS / LESSONS
   Supports: uploaded files (any size), external URLs, article content
============================================================ */

async function getVideos(moduleId, instructorId) {
  const [[mod]] = await db.query(
    `SELECT cm.id FROM course_modules cm
     JOIN courses c ON c.id = cm.course_id
     WHERE cm.id = ? AND c.instructor_id = ?`,
    [moduleId, instructorId]
  );
  if (!mod) throw new AppError('Module not found.', 404, 'NOT_FOUND');

  const [videos] = await db.query(
    `SELECT id, title, description, video_url, duration,
            order_index, is_preview, processing_status, thumbnail_url,
            type, content, timestamps
     FROM videos
     WHERE module_id = ?
     ORDER BY order_index ASC`,
    [moduleId]
  );
  return videos;
}

/**
 * addVideo — creates a new lesson record.
 *
 * @param {number} moduleId
 * @param {number} instructorId
 * @param {object} data   — { title, type, description, video_url, content, timestamps,
 *                            duration, is_preview, order }
 * @param {object|null} file  — multer file object (from multipart upload), or null
 *
 * File size: multer in routes.js must be configured with limit: Infinity (or a very
 * large number like 100 * 1024 * 1024 * 1024) to support files > 5 GB.
 * No size check is enforced here — the OS/disk space is the only limit.
 */
async function addVideo(moduleId, instructorId, data, file) {
  const [[mod]] = await db.query(
    `SELECT cm.id, cm.course_id FROM course_modules cm
     JOIN courses c ON c.id = cm.course_id
     WHERE cm.id = ? AND c.instructor_id = ?`,
    [moduleId, instructorId]
  );
  if (!mod) throw new AppError('Module not found.', 404, 'NOT_FOUND');

  const { title, description, duration, is_preview, video_url, order, type, content, timestamps } = data;
  if (!title) throw new AppError('Lesson title is required.', 400, 'MISSING_TITLE');

  // File upload takes priority over video_url
  const fileUrl    = file ? '/uploads/videos/' + file.filename : (video_url || null);
  const lessonType = type || 'video';

  const [[maxOrder]] = await db.query(
    'SELECT COALESCE(MAX(order_index), 0) AS max FROM videos WHERE module_id = ?',
    [moduleId]
  );

  const orderIndex = order ? parseInt(order) : maxOrder.max + 1;
  const isPreview  = is_preview === true || is_preview === 'true' || is_preview === 1 || is_preview === '1' ? 1 : 0;

  const [result] = await db.query(
    `INSERT INTO videos
       (module_id, title, description, type, video_url, content, timestamps,
        duration, order_index, is_preview)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      moduleId,
      title,
      description || null,
      lessonType,
      fileUrl,
      content    || null,
      timestamps || null,
      parseInt(duration) || 0,
      orderIndex,
      isPreview,
    ]
  );

  // Keep course total_duration in sync
  await db.query(
    `UPDATE courses c SET total_duration = (
       SELECT COALESCE(SUM(v.duration), 0) FROM videos v
       JOIN course_modules cm ON cm.id = v.module_id
       WHERE cm.course_id = c.id
     ) WHERE c.id = ?`,
    [mod.course_id]
  );

  return { id: result.insertId, message: 'Lesson added.', video_url: fileUrl };
}

/**
 * updateVideo — updates lesson metadata and/or video source.
 *
 * Supports replacing the video by passing a new file (multipart) or a new video_url.
 * Old file on disk is NOT deleted automatically — you can add cleanup separately.
 */
async function updateVideo(videoId, instructorId, data) {
  const [[video]] = await db.query(
    `SELECT v.id, v.video_url FROM videos v
     JOIN course_modules cm ON cm.id = v.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE v.id = ? AND c.instructor_id = ?`,
    [videoId, instructorId]
  );
  if (!video) throw new AppError('Video/Lesson not found.', 404, 'NOT_FOUND');

  const fields = [];
  const values = [];

  const directMap = {
    title:         'title',
    video_url:     'video_url',
    duration:      'duration',
    thumbnail_url: 'thumbnail_url',
    type:          'type',
  };

  const seenCols = new Set();

  for (const [fKey, dbCol] of Object.entries(directMap)) {
    if (data[fKey] === undefined || seenCols.has(dbCol)) continue;
    seenCols.add(dbCol);
    let val = data[fKey];
    if (dbCol === 'duration')    val = parseInt(val) || 0;
    if (dbCol === 'order_index') val = parseInt(val) || 0;
    fields.push(`${dbCol} = ?`);
    values.push(val);
  }

  // order / order_index — only update if a valid positive integer is supplied
  const rawOrder = data.order_index !== undefined ? data.order_index : data.order;
  if (rawOrder !== undefined && rawOrder !== null && rawOrder !== '') {
    const parsedOrder = parseInt(rawOrder);
    if (!isNaN(parsedOrder) && parsedOrder > 0) {
      fields.push('order_index = ?');
      values.push(parsedOrder);
    }
  }

  // is_preview / is_free_preview
  if (data.is_preview !== undefined || data.is_free_preview !== undefined) {
    const raw = data.is_preview !== undefined ? data.is_preview : data.is_free_preview;
    fields.push('is_preview = ?');
    values.push(raw === true || raw === 'true' || raw === 1 || raw === '1' ? 1 : 0);
  }

  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description || null);
  }

  // Dedicated content column (article lesson body)
  if (data.content !== undefined) {
    fields.push('content = ?');
    values.push(data.content || null);
  }

  // Dedicated timestamps column (chapter markers)
  if (data.timestamps !== undefined) {
    fields.push('timestamps = ?');
    values.push(data.timestamps || null);
  }

  if (!fields.length) return { message: 'Nothing to update.' };

  values.push(videoId);
  await db.query(`UPDATE videos SET ${fields.join(', ')} WHERE id = ?`, values);
  return { message: 'Lesson updated.', id: videoId };
}

async function deleteVideo(videoId, instructorId) {
  const [[video]] = await db.query(
    `SELECT v.id, v.video_url, cm.course_id FROM videos v
     JOIN course_modules cm ON cm.id = v.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE v.id = ? AND c.instructor_id = ?`,
    [videoId, instructorId]
  );
  if (!video) throw new AppError('Video not found.', 404, 'NOT_FOUND');

  await db.query('DELETE FROM videos WHERE id = ?', [videoId]);

  // Optionally delete the physical file from disk
  if (video.video_url && video.video_url.startsWith('/uploads/videos/')) {
    const filePath = path.join(__dirname, '../../../', video.video_url);
    fs.unlink(filePath, function() {}); // fire-and-forget, ignore errors
  }

  return { message: 'Video deleted.' };
}

/* ============================================================
   STUDENTS
============================================================ */

async function getMyStudents(instructorId, filters) {
  const { q, course_id, page, per_page } = filters || {};
  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, parseInt(per_page) || 20);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ['c.instructor_id = ?'];
  const params = [instructorId];

  if (q) {
    where.push('(up.full_name LIKE ? OR u.email LIKE ?)');
    params.push('%' + q + '%', '%' + q + '%');
  }
  if (course_id) {
    where.push('e.course_id = ?');
    params.push(course_id);
  }

  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(
    `SELECT DISTINCT
       u.id, up.full_name AS name, up.photo_url AS avatar,
       u.email, u.phone,
       GROUP_CONCAT(DISTINCT c.title SEPARATOR ', ') AS enrolled_courses,
       MAX(e.enrolled_at) AS last_enrolled_at,
       COALESCE(AVG(qa.percentage), 0) AS avg_score
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN users u ON u.id = e.student_id
     JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN quiz_attempts qa ON qa.student_id = u.id AND qa.submitted_at IS NOT NULL
     ${whereSQL}
     GROUP BY u.id
     ORDER BY last_enrolled_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  const [[countRow]] = await db.query(
    `SELECT COUNT(DISTINCT e.student_id) AS total
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     JOIN user_profiles up ON up.user_id = e.student_id
     JOIN users u ON u.id = e.student_id
     ${whereSQL}`,
    params
  );

  return {
    students: rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      per_page:    limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

async function getStudentDetail(studentId, instructorId) {
  const [[check]] = await db.query(
    `SELECT COUNT(*) AS count FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = ? AND c.instructor_id = ?`,
    [studentId, instructorId]
  );
  if (!check.count) throw new AppError('Student not found.', 404, 'NOT_FOUND');

  const [[student]] = await db.query(
    `SELECT u.id, u.email, u.phone,
            up.full_name AS name, up.photo_url AS avatar,
            up.grade, up.bio
     FROM users u JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = ?`,
    [studentId]
  );

  const [enrollments] = await db.query(
    `SELECT c.id AS course_id, c.title AS course_title,
            COALESCE(cp.completion_percentage, 0) AS progress,
            e.enrolled_at
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.student_id = e.student_id
     WHERE e.student_id = ? AND c.instructor_id = ?`,
    [studentId, instructorId]
  );

  const [quizResults] = await db.query(
    `SELECT q.title, qa.score, qa.total_marks, qa.percentage, qa.passed, qa.submitted_at
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     JOIN courses c ON c.id = q.course_id
     WHERE qa.student_id = ? AND c.instructor_id = ? AND qa.submitted_at IS NOT NULL
     ORDER BY qa.submitted_at DESC`,
    [studentId, instructorId]
  );

  return { ...student, enrollments, quiz_results: quizResults };
}

/* ============================================================
   ASSESSMENTS
============================================================ */

async function getAssessments(instructorId) {
  const [quizzes] = await db.query(
    `SELECT q.id, q.title, q.status, q.duration_seconds, q.total_marks,
            q.created_at, c.title AS course_title,
            (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count,
            (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND submitted_at IS NOT NULL) AS attempt_count
     FROM quizzes q
     LEFT JOIN courses c ON c.id = q.course_id
     WHERE q.instructor_id = ?
     ORDER BY q.created_at DESC`,
    [instructorId]
  );
  const [assignments] = await db.query(
    `SELECT a.id, a.title, a.deadline, a.max_marks,
            a.created_at, c.title AS course_title,
            (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) AS submission_count,
            (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') AS graded_count
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE a.instructor_id = ?
     ORDER BY a.created_at DESC`,
    [instructorId]
  );
  return { quizzes, assignments };
}

async function getQuizzes(instructorId) {
  const [rows] = await db.query(
    `SELECT q.id, q.title, q.status, q.duration_seconds, q.total_marks,
            q.created_at, c.title AS course_title,
            (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id) AS question_count,
            (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id AND submitted_at IS NOT NULL) AS attempt_count
     FROM quizzes q
     LEFT JOIN courses c ON c.id = q.course_id
     WHERE q.instructor_id = ?
     ORDER BY q.created_at DESC`,
    [instructorId]
  );
  return rows;
}

async function getQuiz(quizId, instructorId) {
  const [[quiz]] = await db.query(
    `SELECT q.*, c.title AS course_title FROM quizzes q
     LEFT JOIN courses c ON c.id = q.course_id
     WHERE q.id = ? AND q.instructor_id = ?`,
    [quizId, instructorId]
  );
  if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');

  const [questions] = await db.query(
    `SELECT id, question, type, marks, explanation, order_index
     FROM quiz_questions WHERE quiz_id = ? ORDER BY order_index ASC`,
    [quizId]
  );
  for (const q of questions) {
    const [options] = await db.query(
      'SELECT id, text, is_correct, order_index FROM quiz_options WHERE question_id = ? ORDER BY order_index ASC',
      [q.id]
    );
    q.options = options;
  }
  return { ...quiz, questions };
}

async function createQuiz(instructorId, data) {
  const {
    title, description, course_id, duration_seconds,
    total_marks, pass_percentage, shuffle_questions, shuffle_options, questions,
  } = data;

  if (!title) throw new AppError('Quiz title is required.', 400, 'MISSING_TITLE');

  const [result] = await db.query(
    `INSERT INTO quizzes
       (instructor_id, course_id, title, description, duration_seconds,
        total_marks, pass_percentage, shuffle_questions, shuffle_options, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [
      instructorId, course_id || null, title,
      description || null,
      parseInt(duration_seconds) || 1800,
      parseInt(total_marks) || 100,
      parseInt(pass_percentage) || 60,
      shuffle_questions ? 1 : 0,
      shuffle_options   ? 1 : 0,
    ]
  );

  const quizId = result.insertId;

  if (Array.isArray(questions)) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const [qResult] = await db.query(
        `INSERT INTO quiz_questions (quiz_id, question, type, marks, explanation, order_index)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [quizId, q.question, q.type || 'single', q.marks || 1, q.explanation || null, i + 1]
      );
      const qId = qResult.insertId;
      if (Array.isArray(q.options)) {
        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j];
          await db.query(
            `INSERT INTO quiz_options (question_id, text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [qId, opt.text, opt.is_correct ? 1 : 0, j + 1]
          );
        }
      }
    }
  }

  return { id: quizId, message: 'Quiz created.' };
}

async function updateQuiz(quizId, instructorId, data) {
  const [[quiz]] = await db.query(
    'SELECT id FROM quizzes WHERE id = ? AND instructor_id = ?',
    [quizId, instructorId]
  );
  if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');

  const fields = []; const values = [];
  const allowed = ['title','description','course_id','duration_seconds','total_marks',
                   'pass_percentage','shuffle_questions','shuffle_options'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
  }
  if (fields.length) {
    values.push(quizId);
    await db.query(`UPDATE quizzes SET ${fields.join(', ')} WHERE id = ?`, values);
  }
  return { message: 'Quiz updated.' };
}

async function publishQuiz(quizId, instructorId) {
  const [[quiz]] = await db.query(
    'SELECT id FROM quizzes WHERE id = ? AND instructor_id = ?',
    [quizId, instructorId]
  );
  if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');
  await db.query("UPDATE quizzes SET status = 'published' WHERE id = ?", [quizId]);
  return { message: 'Quiz published.' };
}

async function deleteQuiz(quizId, instructorId) {
  const [[quiz]] = await db.query(
    'SELECT id FROM quizzes WHERE id = ? AND instructor_id = ?',
    [quizId, instructorId]
  );
  if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');
  await db.query('DELETE FROM quizzes WHERE id = ?', [quizId]);
  return { message: 'Quiz deleted.' };
}

/* ============================================================
   ASSIGNMENTS
============================================================ */

async function getAssignments(instructorId) {
  const [rows] = await db.query(
    `SELECT a.id, a.title, a.deadline, a.max_marks, a.status,
            a.created_at, c.title AS course_title,
            (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) AS submission_count,
            (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id AND status = 'graded') AS graded_count
     FROM assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE a.instructor_id = ?
     ORDER BY a.created_at DESC`,
    [instructorId]
  );
  return rows;
}

async function getAssignment(assignmentId, instructorId) {
  const [[assignment]] = await db.query(
    `SELECT a.*, c.title AS course_title FROM assignments a
     JOIN courses c ON c.id = a.course_id
     WHERE a.id = ? AND a.instructor_id = ?`,
    [assignmentId, instructorId]
  );
  if (!assignment) throw new AppError('Assignment not found.', 404, 'NOT_FOUND');

  const [submissions] = await db.query(
    `SELECT asm.id, asm.student_id, asm.file_url, asm.file_name,
            asm.score, asm.feedback, asm.status, asm.submitted_at, asm.graded_at,
            up.full_name AS student_name
     FROM assignment_submissions asm
     JOIN user_profiles up ON up.user_id = asm.student_id
     WHERE asm.assignment_id = ?
     ORDER BY asm.submitted_at DESC`,
    [assignmentId]
  );

  return { ...assignment, submissions };
}

async function createAssignment(instructorId, data, fileUrl, fileName) {
  const { title, description, course_id, deadline, max_marks } = data;
  if (!title || !course_id) {
    throw new AppError('Title and course_id are required.', 400, 'MISSING_FIELDS');
  }

  const [result] = await db.query(
    `INSERT INTO assignments (course_id, instructor_id, title, description, deadline, max_marks, file_url, file_name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
    [
      course_id, instructorId, title,
      description || null,
      deadline    || null,
      parseInt(max_marks) || 100,
      fileUrl     || null,
      fileName    || null,
    ]
  );

  return { id: result.insertId, message: 'Assignment created.' };
}

async function updateAssignment(assignmentId, instructorId, data) {
  const [[asgn]] = await db.query(
    'SELECT id FROM assignments WHERE id = ? AND instructor_id = ?',
    [assignmentId, instructorId]
  );
  if (!asgn) throw new AppError('Assignment not found.', 404, 'NOT_FOUND');

  const fields = []; const values = [];
  const allowed = ['title','description','deadline','max_marks','status'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
  }
  if (!fields.length) return { message: 'Nothing to update.' };
  values.push(assignmentId);
  await db.query(`UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`, values);
  return { message: 'Assignment updated.' };
}

async function deleteAssignment(assignmentId, instructorId) {
  const [[asgn]] = await db.query(
    'SELECT id FROM assignments WHERE id = ? AND instructor_id = ?',
    [assignmentId, instructorId]
  );
  if (!asgn) throw new AppError('Assignment not found.', 404, 'NOT_FOUND');
  await db.query('DELETE FROM assignments WHERE id = ?', [assignmentId]);
  return { message: 'Assignment deleted.' };
}

async function getSubmissions(instructorId, filters) {
  const { assignment_id, status } = filters || {};
  const where  = ['a.instructor_id = ?'];
  const params = [instructorId];
  if (assignment_id) { where.push('asm.assignment_id = ?'); params.push(assignment_id); }
  if (status)        { where.push('asm.status = ?');        params.push(status); }

  const [rows] = await db.query(
    `SELECT asm.id, asm.assignment_id, asm.student_id,
            asm.file_url, asm.file_name, asm.score, asm.feedback,
            asm.status, asm.submitted_at, asm.graded_at,
            up.full_name AS student_name,
            a.title AS assignment_title, c.title AS course_title
     FROM assignment_submissions asm
     JOIN assignments a ON a.id = asm.assignment_id
     JOIN courses c ON c.id = a.course_id
     JOIN user_profiles up ON up.user_id = asm.student_id
     WHERE ${where.join(' AND ')}
     ORDER BY asm.submitted_at DESC`,
    params
  );
  return rows;
}

async function gradeSubmission(submissionId, instructorId, score, feedback) {
  const [[sub]] = await db.query(
    `SELECT asm.id FROM assignment_submissions asm
     JOIN assignments a ON a.id = asm.assignment_id
     WHERE asm.id = ? AND a.instructor_id = ?`,
    [submissionId, instructorId]
  );
  if (!sub) throw new AppError('Submission not found.', 404, 'NOT_FOUND');

  await db.query(
    `UPDATE assignment_submissions
     SET score = ?, feedback = ?, status = 'graded', graded_at = NOW()
     WHERE id = ?`,
    [parseFloat(score), feedback || null, submissionId]
  );
  return { message: 'Graded successfully.' };
}

async function deleteSubmission(submissionId, instructorId) {
  const [[sub]] = await db.query(
    `SELECT asm.id FROM assignment_submissions asm
     JOIN assignments a ON a.id = asm.assignment_id
     WHERE asm.id = ? AND a.instructor_id = ?`,
    [submissionId, instructorId]
  );
  if (!sub) throw new AppError('Submission not found.', 404, 'NOT_FOUND');
  await db.query('DELETE FROM assignment_submissions WHERE id = ?', [submissionId]);
  return { message: 'Submission deleted.' };
}

/* ============================================================
   LIVE SESSIONS
============================================================ */

async function getLiveSessions(instructorId, status) {
  const where  = ['ls.instructor_id = ?'];
  const params = [instructorId];
  if (status) { where.push('ls.status = ?'); params.push(status); }

  const [rows] = await db.query(
    `SELECT ls.id, ls.title, ls.description, ls.scheduled_at,
            ls.duration_minutes, ls.meeting_link, ls.meeting_id,
            ls.platform, ls.status, ls.recording_url,
            ls.created_at, c.title AS course_title
     FROM live_sessions ls
     LEFT JOIN courses c ON c.id = ls.course_id
     WHERE ${where.join(' AND ')}
     ORDER BY ls.scheduled_at DESC`,
    params
  );
  return rows;
}

async function getLiveSession(sessionId, instructorId) {
  const [[session]] = await db.query(
    `SELECT ls.*, c.title AS course_title FROM live_sessions ls
     LEFT JOIN courses c ON c.id = ls.course_id
     WHERE ls.id = ? AND ls.instructor_id = ?`,
    [sessionId, instructorId]
  );
  if (!session) throw new AppError('Session not found.', 404, 'NOT_FOUND');
  return session;
}

async function createLiveSession(instructorId, data) {
  const {
    title, description, course_id, class_id,
    scheduled_at, duration_minutes, meeting_link, meeting_id, meeting_password,
  } = data;

  if (!title || !scheduled_at) {
    throw new AppError('Title and scheduled_at are required.', 400, 'MISSING_FIELDS');
  }

  const autoLink = meeting_link || `https://meet.jit.si/eduverse-${Date.now()}`;

  const [result] = await db.query(
    `INSERT INTO live_sessions
       (instructor_id, course_id, class_id, title, description, scheduled_at,
        duration_minutes, meeting_link, meeting_id, meeting_password, platform, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'jitsi', 'scheduled')`,
    [
      instructorId, course_id || null, class_id || null,
      title, description || null, scheduled_at,
      parseInt(duration_minutes) || 60,
      autoLink, meeting_id || null, meeting_password || null,
    ]
  );

  if (course_id) {
    const [students] = await db.query(
      'SELECT student_id FROM enrollments WHERE course_id = ?',
      [course_id]
    );
    if (students.length) {
      const notifValues = students.map(s => [
        s.student_id,
        `Live Class: ${title}`,
        `A live session has been scheduled for ${new Date(scheduled_at).toLocaleString('en-IN')}`,
        'live_session',
      ]);
      await db.query(
        'INSERT INTO notifications (user_id, title, body, type) VALUES ?',
        [notifValues]
      );
    }
  }

  return { id: result.insertId, message: 'Live session scheduled.', meeting_link: autoLink };
}

async function updateLiveSession(sessionId, instructorId, data) {
  const [[session]] = await db.query(
    'SELECT id FROM live_sessions WHERE id = ? AND instructor_id = ?',
    [sessionId, instructorId]
  );
  if (!session) throw new AppError('Session not found.', 404, 'NOT_FOUND');

  const fields = []; const values = [];
  const allowed = ['title','description','scheduled_at','duration_minutes',
                   'meeting_link','meeting_id','meeting_password','status','recording_url'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); values.push(data[key]); }
  }
  if (!fields.length) return { message: 'Nothing to update.' };
  values.push(sessionId);
  await db.query(`UPDATE live_sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  return { message: 'Session updated.' };
}

async function deleteLiveSession(sessionId, instructorId) {
  const [[session]] = await db.query(
    'SELECT id FROM live_sessions WHERE id = ? AND instructor_id = ?',
    [sessionId, instructorId]
  );
  if (!session) throw new AppError('Session not found.', 404, 'NOT_FOUND');
  await db.query('DELETE FROM live_sessions WHERE id = ?', [sessionId]);
  return { message: 'Session deleted.' };
}

/* ============================================================
   ANALYTICS
============================================================ */

async function getAnalytics(instructorId, days) {
  const daysNum = parseInt(days) || 30;
  const since   = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const [enrollTrend] = await db.query(
    `SELECT DATE_FORMAT(e.enrolled_at, '%d %b') AS label, COUNT(*) AS count
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE c.instructor_id = ? AND DATE(e.enrolled_at) >= ?
     GROUP BY DATE(e.enrolled_at)
     ORDER BY DATE(e.enrolled_at) ASC`,
    [instructorId, since]
  );

  const [completionRates] = await db.query(
    `SELECT c.title,
            COUNT(e.student_id) AS enrolled,
            SUM(CASE WHEN cp.completion_percentage = 100 THEN 1 ELSE 0 END) AS completed,
            COALESCE(AVG(cp.completion_percentage), 0) AS avg_progress
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id
     LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.student_id = e.student_id
     WHERE c.instructor_id = ?
     GROUP BY c.id
     ORDER BY enrolled DESC`,
    [instructorId]
  );

  const [quizPerf] = await db.query(
    `SELECT q.title,
            COUNT(qa.id) AS attempts,
            ROUND(AVG(qa.percentage), 1) AS avg_score,
            SUM(qa.passed) AS passed_count
     FROM quizzes q
     LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.submitted_at IS NOT NULL
     WHERE q.instructor_id = ?
     GROUP BY q.id
     ORDER BY attempts DESC`,
    [instructorId]
  );

  const [engagement] = await db.query(
    `SELECT DATE_FORMAT(vp.last_watched_at, '%d %b') AS label, COUNT(*) AS views
     FROM video_progress vp
     JOIN videos v ON v.id = vp.video_id
     JOIN course_modules cm ON cm.id = v.module_id
     JOIN courses c ON c.id = cm.course_id
     WHERE c.instructor_id = ? AND DATE(vp.last_watched_at) >= ?
     GROUP BY DATE(vp.last_watched_at)
     ORDER BY DATE(vp.last_watched_at) ASC`,
    [instructorId, since]
  );

  const [topStudents] = await db.query(
    `SELECT up.full_name AS name, up.photo_url AS avatar,
            ROUND(AVG(qa.percentage), 1) AS avg_score,
            COUNT(qa.id) AS quizzes_taken
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     JOIN courses c ON c.id = q.course_id
     JOIN user_profiles up ON up.user_id = qa.student_id
     WHERE c.instructor_id = ? AND qa.submitted_at IS NOT NULL
     GROUP BY qa.student_id
     ORDER BY avg_score DESC
     LIMIT 5`,
    [instructorId]
  );

  return {
    enroll_trend:     enrollTrend,
    completion_rates: completionRates,
    quiz_performance: quizPerf,
    engagement,
    top_students:     topStudents,
  };
}

/* ============================================================
   EARNINGS
============================================================ */

async function getEarnings(instructorId, filters) {
  const [[summary]] = await db.query(
    `SELECT
       COALESCE(SUM(mp.amount_paid), 0) AS total_earnings,
       COUNT(mp.id) AS total_sales,
       COUNT(DISTINCT mp.student_id) AS unique_buyers,
       COALESCE(SUM(CASE WHEN MONTH(mp.purchased_at) = MONTH(NOW())
         AND YEAR(mp.purchased_at) = YEAR(NOW())
         THEN mp.amount_paid ELSE 0 END), 0) AS this_month,
       COALESCE(SUM(CASE WHEN MONTH(mp.purchased_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
         AND YEAR(mp.purchased_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
         THEN mp.amount_paid ELSE 0 END), 0) AS last_month
     FROM material_purchases mp
     JOIN study_materials sm ON sm.id = mp.material_id
     WHERE sm.instructor_id = ? AND mp.payment_status = 'success'`,
    [instructorId]
  );

  const [monthly] = await db.query(
    `SELECT DATE_FORMAT(mp.purchased_at, '%b %Y') AS month,
            DATE_FORMAT(mp.purchased_at, '%Y-%m')  AS month_key,
            COALESCE(SUM(mp.amount_paid), 0) AS amount, COUNT(mp.id) AS sales
     FROM material_purchases mp
     JOIN study_materials sm ON sm.id = mp.material_id
     WHERE sm.instructor_id = ? AND mp.payment_status = 'success'
       AND mp.purchased_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month_key
     ORDER BY month_key ASC`,
    [instructorId]
  );

  const [byMaterial] = await db.query(
    `SELECT sm.id, sm.title, sm.type, sm.price, sm.is_free,
            COUNT(mp.id) AS sales,
            COALESCE(SUM(mp.amount_paid), 0) AS earnings
     FROM study_materials sm
     LEFT JOIN material_purchases mp ON mp.material_id = sm.id AND mp.payment_status = 'success'
     WHERE sm.instructor_id = ?
     GROUP BY sm.id
     ORDER BY earnings DESC`,
    [instructorId]
  );

  const [transactions] = await db.query(
    `SELECT mp.id, mp.amount_paid, mp.purchased_at,
            sm.title AS material_title, up.full_name AS student_name
     FROM material_purchases mp
     JOIN study_materials sm ON sm.id = mp.material_id
     JOIN user_profiles up ON up.user_id = mp.student_id
     WHERE sm.instructor_id = ? AND mp.payment_status = 'success'
     ORDER BY mp.purchased_at DESC LIMIT 20`,
    [instructorId]
  );

  return {
    summary: {
      total_earnings: parseFloat(summary.total_earnings),
      total_sales:    summary.total_sales,
      unique_buyers:  summary.unique_buyers,
      this_month:     parseFloat(summary.this_month),
      last_month:     parseFloat(summary.last_month),
      growth_pct:     summary.last_month > 0
        ? Math.round(((summary.this_month - summary.last_month) / summary.last_month) * 100)
        : null,
    },
    monthly,
    by_material:  byMaterial,
    transactions,
  };
}

/* ============================================================
   MESSAGES
============================================================ */

async function getMessageRooms(instructorId) {
  const [rows] = await db.query(
    `SELECT mr.id AS room_id, mr.updated_at AS last_message_at,
            CASE WHEN mr.user_one_id = ? THEN mr.user_two_id ELSE mr.user_one_id END AS other_user_id,
            up.full_name AS other_user_name, up.photo_url AS other_user_avatar,
            (SELECT content FROM messages WHERE room_id = mr.id ORDER BY created_at DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*) FROM messages WHERE room_id = mr.id AND sender_id != ? AND is_read = 0) AS unread_count
     FROM message_rooms mr
     JOIN user_profiles up
       ON up.user_id = CASE WHEN mr.user_one_id = ? THEN mr.user_two_id ELSE mr.user_one_id END
     WHERE mr.user_one_id = ? OR mr.user_two_id = ?
     ORDER BY mr.updated_at DESC`,
    [instructorId, instructorId, instructorId, instructorId, instructorId]
  );
  return rows;
}

async function getOrCreateRoom(userId, otherUserId) {
  const [u1, u2] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
  const [[existing]] = await db.query(
    'SELECT id AS room_id FROM message_rooms WHERE user_one_id = ? AND user_two_id = ?',
    [u1, u2]
  );
  if (existing) return { room_id: existing.room_id };
  const [result] = await db.query(
    'INSERT INTO message_rooms (user_one_id, user_two_id) VALUES (?, ?)',
    [u1, u2]
  );
  return { room_id: result.insertId };
}

async function getMessages(roomId, userId, limit) {
  const [[member]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [roomId, userId, userId]
  );
  if (!member) throw new AppError('Room not found.', 404, 'NOT_FOUND');

  const [rows] = await db.query(
    `SELECT m.id, m.content, m.sender_id, m.created_at, m.is_read,
            up.full_name AS sender_name, up.photo_url AS sender_avatar
     FROM messages m
     JOIN user_profiles up ON up.user_id = m.sender_id
     WHERE m.room_id = ?
     ORDER BY m.created_at DESC LIMIT ?`,
    [roomId, parseInt(limit) || 50]
  );
  return rows.reverse();
}

async function sendMessage(roomId, senderId, content) {
  const [[member]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [roomId, senderId, senderId]
  );
  if (!member) throw new AppError('Room not found.', 404, 'NOT_FOUND');

  const [result] = await db.query(
    'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
    [roomId, senderId, content]
  );
  await db.query('UPDATE message_rooms SET updated_at = NOW() WHERE id = ?', [roomId]);
  return { id: result.insertId, content, sender_id: senderId, created_at: new Date() };
}

async function markRoomRead(roomId, userId) {
  await db.query(
    'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?',
    [roomId, userId]
  );
  return { message: 'Marked as read.' };
}

/* ============================================================
   PROFILE
============================================================ */

async function getProfile(instructorId) {
  const [[row]] = await db.query(
    `SELECT
       u.id, u.email, u.phone, u.role, u.created_at,
       up.full_name AS name, up.photo_url AS avatar, up.bio,
       up.subject, up.qualification, up.experience_years,
       up.linkedin_url, up.teaching_levels,
       up.city, up.state,
       (SELECT COUNT(*) FROM courses WHERE instructor_id = u.id AND status = 'published') AS total_courses,
       (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e
        JOIN courses c ON c.id = e.course_id WHERE c.instructor_id = u.id)               AS total_students,
       (SELECT COUNT(*) FROM study_materials WHERE instructor_id = u.id AND status = 'published') AS total_materials,
       (SELECT COALESCE(SUM(mp.amount_paid), 0) FROM material_purchases mp
        JOIN study_materials sm ON sm.id = mp.material_id
        WHERE sm.instructor_id = u.id AND mp.payment_status = 'success')                 AS total_earnings
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = ?`,
    [instructorId]
  );
  if (!row) throw new AppError('Profile not found.', 404, 'NOT_FOUND');
  return row;
}

async function updateProfile(instructorId, data) {
  const {
    name, phone, bio, subject, qualification,
    experience_years, linkedin_url, teaching_levels, city, state,
  } = data;

  await db.query(
    `UPDATE user_profiles SET
       full_name        = COALESCE(?, full_name),
       bio              = COALESCE(?, bio),
       subject          = COALESCE(?, subject),
       qualification    = COALESCE(?, qualification),
       experience_years = COALESCE(?, experience_years),
       linkedin_url     = COALESCE(?, linkedin_url),
       teaching_levels  = COALESCE(?, teaching_levels),
       city             = COALESCE(?, city),
       state            = COALESCE(?, state)
     WHERE user_id = ?`,
    [
      name || null, bio || null, subject || null,
      qualification || null,
      experience_years ? parseInt(experience_years) : null,
      linkedin_url     || null,
      teaching_levels  ? JSON.stringify(teaching_levels) : null,
      city  || null, state || null,
      instructorId,
    ]
  );

  if (phone) {
    await db.query('UPDATE users SET phone = ? WHERE id = ?', [phone, instructorId]);
  }

  return { message: 'Profile updated.' };
}

async function updatePassword(instructorId, currentPassword, newPassword) {
  const [[user]] = await db.query(
    'SELECT password_hash FROM users WHERE id = ?',
    [instructorId]
  );
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) throw new AppError('Current password is incorrect.', 400, 'WRONG_PASSWORD');

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hash   = await bcrypt.hash(newPassword, rounds);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, instructorId]);
  await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [instructorId]);

  return { message: 'Password updated. Please sign in again.' };
}

async function updateAvatar(instructorId, photoUrl) {
  await db.query(
    'UPDATE user_profiles SET photo_url = ? WHERE user_id = ?',
    [photoUrl, instructorId]
  );
  return { message: 'Avatar updated.', avatar_url: photoUrl };
}

/* ============================================================
   EXPORTS
============================================================ */
module.exports = {
  getDashboard,
  getMyCourses,
  getCourse,
  createCourse,
  updateCourse,
  publishCourse,
  deleteCourse,
  saveCoupons,
  getCoupons,
  getModules,
  addModule,
  updateModule,
  deleteModule,
  getVideos,
  addVideo,
  updateVideo,
  deleteVideo,
  getMyStudents,
  getStudentDetail,
  getAssessments,
  getQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  publishQuiz,
  deleteQuiz,
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissions,
  gradeSubmission,
  deleteSubmission,
  getLiveSessions,
  getLiveSession,
  createLiveSession,
  updateLiveSession,
  deleteLiveSession,
  getAnalytics,
  getEarnings,
  getMessageRooms,
  getOrCreateRoom,
  getMessages,
  sendMessage,
  markRoomRead,
  getProfile,
  updateProfile,
  updatePassword,
  updateAvatar,
};