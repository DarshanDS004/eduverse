/**
 * EduVerse — Study Materials Service
 * modules/materials/materials.service.js
 */

'use strict';

const db       = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');
const path     = require('path');
const fs       = require('fs');

/* ============================================================
   BROWSE MATERIALS (Student + Public)
============================================================ */

async function getMaterials(filters) {
  const {
    search, type, level, category,
    is_free, sort, page, limit,
  } = filters;

  const pageNum  = parseInt(page)  || 1;
  const limitNum = parseInt(limit) || 12;
  const offset   = (pageNum - 1) * limitNum;

  let where  = ['sm.status = "published"'];
  let params = [];

  if (search) {
    where.push('MATCH(sm.title, sm.description, sm.subject, sm.tags) AGAINST(? IN BOOLEAN MODE)');
    params.push(search + '*');
  }
  if (type)     { where.push('sm.type = ?');     params.push(type); }
  if (level)    { where.push('sm.level = ?');    params.push(level); }
  if (category) { where.push('sm.category = ?'); params.push(category); }
  if (is_free === 'true' || is_free === true) {
    where.push('sm.is_free = 1');
  } else if (is_free === 'false' || is_free === false) {
    where.push('sm.is_free = 0');
  }

  const orderMap = {
    newest:     'sm.created_at DESC',
    popular:    'sm.purchase_count DESC',
    rating:     'sm.avg_rating DESC',
    price_asc:  'sm.price ASC',
    price_desc: 'sm.price DESC',
    downloads:  'sm.download_count DESC',
  };
  const orderBy = orderMap[sort] || 'sm.created_at DESC';

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(
    `SELECT
       sm.id, sm.title, sm.description, sm.subject,
       sm.category, sm.level, sm.type, sm.price, sm.is_free,
       sm.preview_url, sm.thumbnail_url, sm.pages,
       sm.language, sm.tags, sm.file_size,
       sm.download_count, sm.purchase_count,
       sm.avg_rating, sm.total_ratings,
       sm.created_at,
       up.full_name AS instructor_name,
       u.id         AS instructor_id,
       up2.photo_url AS instructor_avatar
     FROM study_materials sm
     JOIN users u          ON u.id  = sm.instructor_id
     JOIN user_profiles up ON up.user_id = sm.instructor_id
     LEFT JOIN user_profiles up2 ON up2.user_id = sm.instructor_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM study_materials sm
     ${whereClause}`,
    params
  );

  return {
    materials:   rows,
    pagination: {
      total:       countRow.total,
      page:        pageNum,
      limit:       limitNum,
      total_pages: Math.ceil(countRow.total / limitNum),
    },
  };
}

/* ============================================================
   GET SINGLE MATERIAL
============================================================ */

async function getMaterial(materialId, studentId) {
  const [rows] = await db.query(
    `SELECT
       sm.*,
       up.full_name  AS instructor_name,
       up.photo_url  AS instructor_avatar,
       up.bio        AS instructor_bio,
       u.id          AS instructor_id
     FROM study_materials sm
     JOIN users u          ON u.id = sm.instructor_id
     JOIN user_profiles up ON up.user_id = sm.instructor_id
     WHERE sm.id = ? AND sm.status = 'published'`,
    [materialId]
  );

  if (!rows.length) {
    throw new AppError('Material not found.', 404, 'NOT_FOUND');
  }

  const material = rows[0];

  // Check if student has purchased
  let purchased = false;
  if (studentId) {
    const [purchaseRows] = await db.query(
      `SELECT id FROM material_purchases
       WHERE material_id = ? AND student_id = ?
       AND payment_status = 'success'`,
      [materialId, studentId]
    );
    purchased = purchaseRows.length > 0;
  }

  // Get reviews
  const [reviews] = await db.query(
    `SELECT
       mr.rating, mr.review_text, mr.created_at,
       up.full_name AS student_name,
       up.photo_url AS student_avatar
     FROM material_reviews mr
     JOIN user_profiles up ON up.user_id = mr.student_id
     WHERE mr.material_id = ?
     ORDER BY mr.created_at DESC
     LIMIT 10`,
    [materialId]
  );

  return { ...material, purchased, reviews };
}

/* ============================================================
   PURCHASE MATERIAL (Free or Paid)
============================================================ */

async function purchaseMaterial(materialId, studentId) {
  // Check material exists
  const [matRows] = await db.query(
    'SELECT id, title, price, is_free, status FROM study_materials WHERE id = ?',
    [materialId]
  );

  if (!matRows.length || matRows[0].status !== 'published') {
    throw new AppError('Material not found.', 404, 'NOT_FOUND');
  }

  const material = matRows[0];

  // Check already purchased
  const [existing] = await db.query(
    `SELECT id FROM material_purchases
     WHERE material_id = ? AND student_id = ? AND payment_status = 'success'`,
    [materialId, studentId]
  );

  if (existing.length > 0) {
    throw new AppError('You have already purchased this material.', 409, 'ALREADY_PURCHASED');
  }

  // For free materials — add purchase record directly
  if (material.is_free || material.price === 0) {
    await db.query(
      `INSERT INTO material_purchases
       (material_id, student_id, amount_paid, payment_status)
       VALUES (?, ?, 0, 'success')`,
      [materialId, studentId]
    );

    // Update purchase count
    await db.query(
      'UPDATE study_materials SET purchase_count = purchase_count + 1 WHERE id = ?',
      [materialId]
    );

    return {
      success:  true,
      free:     true,
      message:  'Material added to your library successfully.',
      material: material,
    };
  }

  // For paid materials — return payment details
  return {
    success:        false,
    requires_payment: true,
    material_id:    materialId,
    amount:         material.price,
    title:          material.title,
    message:        'Payment required to access this material.',
  };
}

/* ============================================================
   CONFIRM PAID PURCHASE
============================================================ */

async function confirmPurchase(materialId, studentId, paymentId, amountPaid) {
  const [matRows] = await db.query(
    'SELECT id, price FROM study_materials WHERE id = ?',
    [materialId]
  );

  if (!matRows.length) {
    throw new AppError('Material not found.', 404, 'NOT_FOUND');
  }

  await db.query(
    `INSERT INTO material_purchases
     (material_id, student_id, amount_paid, payment_id, payment_status)
     VALUES (?, ?, ?, ?, 'success')
     ON DUPLICATE KEY UPDATE
     payment_status = 'success', payment_id = ?, amount_paid = ?`,
    [materialId, studentId, amountPaid, paymentId, paymentId, amountPaid]
  );

  await db.query(
    'UPDATE study_materials SET purchase_count = purchase_count + 1 WHERE id = ?',
    [materialId]
  );

  return { success: true, message: 'Purchase confirmed.' };
}

/* ============================================================
   GET DOWNLOAD URL (Student)
============================================================ */

async function getDownloadUrl(materialId, studentId) {
  // Verify purchase
  const [purchaseRows] = await db.query(
    `SELECT mp.id
     FROM material_purchases mp
     WHERE mp.material_id = ? AND mp.student_id = ?
     AND mp.payment_status = 'success'`,
    [materialId, studentId]
  );

  if (!purchaseRows.length) {
    throw new AppError(
      'You have not purchased this material.', 403, 'NOT_PURCHASED'
    );
  }

  // Get file URL
  const [matRows] = await db.query(
    'SELECT file_url, file_name FROM study_materials WHERE id = ?',
    [materialId]
  );

  if (!matRows.length) {
    throw new AppError('Material not found.', 404, 'NOT_FOUND');
  }

  // Update download count
  await db.query(
    'UPDATE study_materials SET download_count = download_count + 1 WHERE id = ?',
    [materialId]
  );

  return {
    download_url: matRows[0].file_url,
    file_name:    matRows[0].file_name,
  };
}

/* ============================================================
   GET MY PURCHASED MATERIALS (Student)
============================================================ */

async function getMyPurchases(studentId) {
  const [rows] = await db.query(
    `SELECT
       sm.id, sm.title, sm.description, sm.subject,
       sm.category, sm.level, sm.type,
       sm.thumbnail_url, sm.pages, sm.language,
       sm.file_size, sm.download_count,
       up.full_name AS instructor_name,
       mp.purchased_at, mp.amount_paid
     FROM material_purchases mp
     JOIN study_materials sm ON sm.id = mp.material_id
     JOIN user_profiles up   ON up.user_id = sm.instructor_id
     WHERE mp.student_id = ? AND mp.payment_status = 'success'
     ORDER BY mp.purchased_at DESC`,
    [studentId]
  );
  return rows;
}

/* ============================================================
   ADD REVIEW
============================================================ */

async function addReview(materialId, studentId, rating, reviewText) {
  // Check purchased
  const [purchaseRows] = await db.query(
    `SELECT id FROM material_purchases
     WHERE material_id = ? AND student_id = ? AND payment_status = 'success'`,
    [materialId, studentId]
  );

  if (!purchaseRows.length) {
    throw new AppError(
      'You must purchase this material before reviewing it.',
      403, 'NOT_PURCHASED'
    );
  }

  // Insert or update review
  await db.query(
    `INSERT INTO material_reviews (material_id, student_id, rating, review_text)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = ?, review_text = ?`,
    [materialId, studentId, rating, reviewText, rating, reviewText]
  );

  // Update avg rating on material
  await db.query(
    `UPDATE study_materials sm SET
       avg_rating   = (SELECT AVG(rating) FROM material_reviews WHERE material_id = ?),
       total_ratings= (SELECT COUNT(*) FROM material_reviews WHERE material_id = ?)
     WHERE sm.id = ?`,
    [materialId, materialId, materialId]
  );

  return { message: 'Review submitted successfully.' };
}

/* ============================================================
   INSTRUCTOR — UPLOAD MATERIAL
============================================================ */

async function uploadMaterial(instructorId, data, file) {
  if (!file) {
    throw new AppError('Please upload a file.', 400, 'NO_FILE');
  }

  const {
    title, description, subject, category,
    level, type, price, is_free, language, tags, pages,
  } = data;

  if (!title) throw new AppError('Title is required.', 400, 'MISSING_TITLE');

  const isFree  = is_free === 'true' || is_free === true;
  const priceVal = isFree ? 0 : parseFloat(price) || 0;

  const fileUrl  = '/uploads/materials/' + file.filename;
  const fileSize = file.size;
  const fileName = file.originalname;

  const [result] = await db.query(
    `INSERT INTO study_materials
     (instructor_id, title, description, subject, category,
      level, type, price, is_free, file_url, file_name,
      file_size, language, tags, pages, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
    [
      instructorId, title, description || null,
      subject || null, category || null,
      level || null, type || 'notes',
      priceVal, isFree ? 1 : 0,
      fileUrl, fileName, fileSize,
      language || 'English',
      tags || null,
      pages ? parseInt(pages) : null,
    ]
  );

  return {
    id:      result.insertId,
    message: 'Material uploaded and published successfully.',
  };
}

/* ============================================================
   INSTRUCTOR — GET MY MATERIALS
============================================================ */

async function getMyMaterials(instructorId) {
  const [rows] = await db.query(
    `SELECT
       sm.id, sm.title, sm.subject, sm.category,
       sm.level, sm.type, sm.price, sm.is_free,
       sm.status, sm.download_count, sm.purchase_count,
       sm.avg_rating, sm.total_ratings,
       sm.file_size, sm.pages, sm.created_at,
       COALESCE(
         SUM(mp.amount_paid), 0
       ) AS total_earnings
     FROM study_materials sm
     LEFT JOIN material_purchases mp
       ON mp.material_id = sm.id AND mp.payment_status = 'success'
     WHERE sm.instructor_id = ?
     GROUP BY sm.id
     ORDER BY sm.created_at DESC`,
    [instructorId]
  );
  return rows;
}

/* ============================================================
   INSTRUCTOR — DELETE MATERIAL
============================================================ */

async function deleteMaterial(materialId, instructorId) {
  const [rows] = await db.query(
    'SELECT id, file_url FROM study_materials WHERE id = ? AND instructor_id = ?',
    [materialId, instructorId]
  );

  if (!rows.length) {
    throw new AppError(
      'Material not found or you do not have permission.', 404, 'NOT_FOUND'
    );
  }

  // Delete physical file if local
  try {
    const filePath = path.join(__dirname, '../../..', rows[0].file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch(e) {}

  await db.query('DELETE FROM study_materials WHERE id = ?', [materialId]);
  return { message: 'Material deleted successfully.' };
}

/* ============================================================
   GET CATEGORIES (for filters)
============================================================ */

async function getCategories() {
  const [rows] = await db.query(
    `SELECT DISTINCT category
     FROM study_materials
     WHERE status = 'published' AND category IS NOT NULL
     ORDER BY category`
  );
  return rows.map(r => r.category);
}

module.exports = {
  getMaterials,
  getMaterial,
  purchaseMaterial,
  confirmPurchase,
  getDownloadUrl,
  getMyPurchases,
  addReview,
  uploadMaterial,
  getMyMaterials,
  deleteMaterial,
  getCategories,
};