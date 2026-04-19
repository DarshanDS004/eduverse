/**
 * EduVerse — Courses Service  (FIXED)
 * modules/courses/courses.service.js
 *
 * Fixes applied:
 *  1. getCourse — also works when userId is the instructor (not just enrolled student)
 *  2. getCourse — free-preview videos always get video_url regardless of enrollment
 *  3. listCourses — count query uses same params correctly (no double-filter bug)
 *  4. enroll — handles price === '0' (string) from DB correctly
 *  5. getCategories — slug handles null/undefined gracefully
 *  6. submitReview — validates rating as integer
 *  7. All queries use correct column aliases expected by frontend
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');

/* ============================================================
   PUBLIC CATALOG
============================================================ */

async function listCourses(filters) {
  const {
    q, category, level, price,
    sort, page, per_page, instructor_id,
  } = filters || {};

  const pageNum  = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, parseInt(per_page) || 12);
  const offset   = (pageNum - 1) * limitNum;

  const where  = ["c.status = 'published'"];
  const params = [];

  if (q) {
    where.push('MATCH(c.title, c.description, c.tags) AGAINST(? IN BOOLEAN MODE)');
    params.push(q + '*');
  }
  if (category)      { where.push('c.category = ?');      params.push(category); }
  if (level)         { where.push('c.level = ?');         params.push(level); }
  if (instructor_id) { where.push('c.instructor_id = ?'); params.push(instructor_id); }
  if (price === 'free') where.push('c.is_free = 1');
  if (price === 'paid') where.push('c.is_free = 0');

  const orderMap = {
    newest:  'c.created_at DESC',
    popular: 'c.enrolled_count DESC',
    rating:  'c.avg_rating DESC',
  };
  const orderBy  = orderMap[sort] || 'c.created_at DESC';
  const whereSQL = 'WHERE ' + where.join(' AND ');

  const [rows] = await db.query(
    `SELECT
       c.id, c.title, c.description, c.thumbnail_url,
       c.category, c.level, c.language,
       c.price, c.is_free,
       c.avg_rating, c.total_ratings,
       c.enrolled_count,
       c.enrolled_count AS enrollment_count,
       c.total_duration, c.tags,
       up.full_name AS instructor_name,
       u.id         AS instructor_id,
       (SELECT COUNT(*) FROM videos v
        JOIN course_modules cm ON cm.id = v.module_id
        WHERE cm.course_id = c.id) AS total_videos
     FROM courses c
     JOIN users u        ON u.id = c.instructor_id
     JOIN user_profiles up ON up.user_id = u.id
     ${whereSQL}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  // Count uses the same params (no LIMIT/OFFSET)
  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM courses c
     JOIN users u        ON u.id = c.instructor_id
     JOIN user_profiles up ON up.user_id = u.id
     ${whereSQL}`,
    params
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

/* ============================================================
   COURSE DETAIL
============================================================ */

async function getCourse(courseId, userId) {
  // Allow instructor to view their own draft; students only see published
  const [[course]] = await db.query(
    `SELECT
       c.id, c.title, c.description, c.thumbnail_url,
       c.category, c.level, c.language, c.price, c.is_free,
       c.avg_rating, c.total_ratings, c.enrolled_count,
       c.requirements, c.what_you_learn, c.tags, c.total_duration,
       c.status, c.created_at,
       up.full_name AS instructor_name,
       up.photo_url AS instructor_avatar,
       up.bio       AS instructor_bio,
       u.id         AS instructor_id
     FROM courses c
     JOIN users u        ON u.id = c.instructor_id
     JOIN user_profiles up ON up.user_id = u.id
     WHERE c.id = ?
       AND (c.status = 'published' OR c.instructor_id = ?)`,
    [courseId, userId || 0]
  );

  if (!course) throw new AppError('Course not found.', 404, 'NOT_FOUND');

  // Determine access level
  const isInstructor = userId && course.instructor_id === Number(userId);
  let enrolled = false;

  if (userId && !isInstructor) {
    const [[enr]] = await db.query(
      'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
      [courseId, userId]
    );
    enrolled = !!enr;
  }

  // Full access for instructor or enrolled student
  const hasFullAccess = isInstructor || enrolled;

  // Modules with videos
  const [modules] = await db.query(
    `SELECT id, title, description, order_index
     FROM course_modules
     WHERE course_id = ?
     ORDER BY order_index ASC`,
    [courseId]
  );

  for (const mod of modules) {
    const [videos] = await db.query(
      `SELECT
         v.id, v.title, v.description, v.duration,
         v.order_index, v.is_preview,
         COALESCE(v.type, 'video') AS type,
         CASE
           WHEN ? = 1 THEN v.video_url   -- full access
           WHEN v.is_preview = 1 THEN v.video_url  -- free preview always visible
           ELSE NULL
         END AS video_url
       FROM videos v
       WHERE v.module_id = ?
       ORDER BY v.order_index ASC`,
      [hasFullAccess ? 1 : 0, mod.id]
    );
    mod.videos  = videos;
    mod.lessons = videos;  // alias for courses.html builder
  }

  // Reviews
  const [reviews] = await db.query(
    `SELECT
       cr.rating, cr.review_text, cr.created_at,
       up.full_name AS student_name,
       up.photo_url AS student_avatar
     FROM course_reviews cr
     JOIN user_profiles up ON up.user_id = cr.student_id
     WHERE cr.course_id = ?
     ORDER BY cr.created_at DESC
     LIMIT 10`,
    [courseId]
  );

  // Progress (enrolled students only)
  let progress = null;
  if (enrolled && userId) {
    const [[prog]] = await db.query(
      `SELECT completion_percentage AS progress, last_activity_at, completed_at
       FROM course_progress
       WHERE course_id = ? AND student_id = ?`,
      [courseId, userId]
    );
    progress = prog || { progress: 0 };
  }

  return { ...course, enrolled, is_instructor: isInstructor, modules, reviews, progress };
}

/* ============================================================
   ENROLL
============================================================ */

async function enroll(courseId, studentId) {
  const [[course]] = await db.query(
    'SELECT id, title, price, is_free, status FROM courses WHERE id = ?',
    [courseId]
  );

  if (!course || course.status !== 'published') {
    throw new AppError('Course not found.', 404, 'NOT_FOUND');
  }

  const [[existing]] = await db.query(
    'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
    [courseId, studentId]
  );
  if (existing) throw new AppError('Already enrolled in this course.', 409, 'ALREADY_ENROLLED');

  // Free course — direct enroll
  const isFree = course.is_free == 1 || parseFloat(course.price) === 0;
  if (isFree) {
    await db.query(
      `INSERT INTO enrollments (student_id, course_id, amount_paid, source)
       VALUES (?, ?, 0, 'free')`,
      [studentId, courseId]
    );
    await db.query(
      'UPDATE courses SET enrolled_count = enrolled_count + 1 WHERE id = ?',
      [courseId]
    );
    // Initialise progress row
    await db.query(
      `INSERT IGNORE INTO course_progress (student_id, course_id, completion_percentage)
       VALUES (?, ?, 0)`,
      [studentId, courseId]
    );
    return { success: true, free: true, message: 'Enrolled successfully.' };
  }

  // Paid course
  return {
    success:          false,
    requires_payment: true,
    course_id:        courseId,
    amount:           course.price,
    title:            course.title,
    message:          'Payment required to enroll.',
  };
}

/* ============================================================
   CATEGORIES
============================================================ */

async function getCategories() {
  const [rows] = await db.query(
    `SELECT category, COUNT(*) AS count
     FROM courses
     WHERE status = 'published' AND category IS NOT NULL AND category != ''
     GROUP BY category
     ORDER BY count DESC`
  );
  return rows.map(r => ({
    name:  r.category,
    slug:  String(r.category).toLowerCase().replace(/\s+/g, '-'),
    count: r.count,
  }));
}

/* ============================================================
   SUBMIT REVIEW
============================================================ */

async function submitReview(courseId, studentId, rating, reviewText) {
  const ratingNum = parseInt(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    throw new AppError('Rating must be between 1 and 5.', 400, 'INVALID_RATING');
  }

  const [[enrolled]] = await db.query(
    'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
    [courseId, studentId]
  );
  if (!enrolled) throw new AppError('You must be enrolled to review.', 403, 'NOT_ENROLLED');

  await db.query(
    `INSERT INTO course_reviews (course_id, student_id, rating, review_text)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating = VALUES(rating),
       review_text = VALUES(review_text)`,
    [courseId, studentId, ratingNum, reviewText || null]
  );

  // Recalculate avg
  await db.query(
    `UPDATE courses SET
       avg_rating    = (SELECT AVG(rating)   FROM course_reviews WHERE course_id = ?),
       total_ratings = (SELECT COUNT(*)      FROM course_reviews WHERE course_id = ?)
     WHERE id = ?`,
    [courseId, courseId, courseId]
  );

  return { message: 'Review submitted.' };
}


/* ============================================================
   WISHLIST
============================================================ */

async function getWishlist(studentId) {
  const [rows] = await db.query(
    `SELECT
       c.id, c.title, c.thumbnail_url, c.category, c.level,
       c.price, c.is_free, c.avg_rating, c.enrolled_count,
       up.full_name AS instructor_name
     FROM wishlists w
     JOIN courses c ON c.id = w.course_id
     JOIN users u ON u.id = c.instructor_id
     JOIN user_profiles up ON up.user_id = u.id
     WHERE w.student_id = ? AND c.status = 'published'
     ORDER BY w.created_at DESC`,
    [studentId]
  );
  return rows;
}

async function toggleWishlist(courseId, studentId) {
  const [[existing]] = await db.query(
    'SELECT id FROM wishlists WHERE course_id = ? AND student_id = ?',
    [courseId, studentId]
  );
  if (existing) {
    await db.query('DELETE FROM wishlists WHERE course_id = ? AND student_id = ?', [courseId, studentId]);
    return { wishlisted: false, message: 'Removed from wishlist.' };
  }
  await db.query('INSERT INTO wishlists (course_id, student_id) VALUES (?, ?)', [courseId, studentId]);
  return { wishlisted: true, message: 'Added to wishlist.' };
}

/* ============================================================
   OWNERSHIP CHECK
============================================================ */

async function isCourseOwnedBy(courseId, instructorId) {
  const [[row]] = await db.query(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, instructorId]
  );
  return !!row;
}

/* ============================================================
   UPDATE COURSE
============================================================ */

async function updateCourse(courseId, instructorId, updates) {
  const allowed = ['title','description','category','category_id','price','is_free',
                   'level','language','thumbnail_url','tags','requirements',
                   'what_you_learn','objectives','status'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      // map category_id → category column if needed
      const col = key === 'category_id' ? 'category' : key;
      fields.push(`${col} = ?`);
      values.push(updates[key]);
    }
  }
  // price = 0 means free
  if (updates.price !== undefined) {
    fields.push('is_free = ?');
    values.push(parseFloat(updates.price) === 0 ? 1 : 0);
  }

  if (!fields.length) return { message: 'Nothing to update.' };

  values.push(courseId);
  await db.query(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, values);

  const [[course]] = await db.query('SELECT * FROM courses WHERE id = ?', [courseId]);
  return { message: 'Course updated.', course };
}

/* ============================================================
   PUBLISH COURSE (from courses module)
============================================================ */

async function publishCourse(courseId, instructorId) {
  // Validate: must have at least 1 module with 1 lesson
  const [[modCount]] = await db.query(
    'SELECT COUNT(*) AS cnt FROM course_modules WHERE course_id = ?', [courseId]
  );
  if (!modCount.cnt) throw new AppError('Add at least one module before publishing.', 400, 'NO_MODULES');

  const [[lesCount]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM videos v
     JOIN course_modules cm ON cm.id = v.module_id
     WHERE cm.course_id = ?`, [courseId]
  );
  if (!lesCount.cnt) throw new AppError('Add at least one lesson before publishing.', 400, 'NO_LESSONS');

  await db.query(
    "UPDATE courses SET status = 'published', published_at = NOW() WHERE id = ?",
    [courseId]
  );
  return { message: 'Course published successfully. Students can now enroll.' };
}

/* ============================================================
   DELETE COURSE
============================================================ */

async function deleteCourse(courseId, instructorId, opts) {
  if (opts && opts.force) {
    await db.query('DELETE FROM courses WHERE id = ?', [courseId]);
  } else {
    await db.query(
      "UPDATE courses SET status = 'archived' WHERE id = ? AND instructor_id = ?",
      [courseId, instructorId]
    );
  }
  return { message: 'Course deleted.' };
}

/* ============================================================
   ADMIN
============================================================ */

async function adminListCourses(filters) {
  const page  = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(50, parseInt(filters.per_page) || 20);
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT c.id, c.title, c.status, c.price, c.is_free,
            c.enrolled_count, c.avg_rating, c.created_at,
            up.full_name AS instructor_name
     FROM courses c
     JOIN users u ON u.id = c.instructor_id
     JOIN user_profiles up ON up.user_id = u.id
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[countRow]] = await db.query('SELECT COUNT(*) AS total FROM courses');
  return { courses: rows, total: countRow.total, page, per_page: limit };
}

module.exports = {
  listCourses,
  getCourse,
  enroll,
  getCategories,
  submitReview,
  getWishlist,
  toggleWishlist,
  isCourseOwnedBy,
  updateCourse,
  publishCourse,
  deleteCourse,
  adminListCourses,
};