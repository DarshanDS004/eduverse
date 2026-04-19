/**
 * EduVerse — Certificates Service
 * modules/certificates/certificates.service.js
 */

'use strict';

const db           = require('../../config/db');
const { AppError } = require('../../shared/errorHandler');

async function listCertificates(studentId) {
  const [rows] = await db.query(
    `SELECT
       cert.id, cert.title, cert.certificate_code,
       cert.issued_at, cert.file_url,
       c.title AS course_title,
       up_inst.full_name AS instructor_name
     FROM certificates cert
     LEFT JOIN courses c ON c.id = cert.course_id
     LEFT JOIN user_profiles up_inst ON up_inst.user_id = c.instructor_id
     WHERE cert.student_id = ?
     ORDER BY cert.issued_at DESC`,
    [studentId]
  );
  return rows;
}

async function getCertificate(certId, studentId) {
  const [[cert]] = await db.query(
    `SELECT cert.*, c.title AS course_title,
            up.full_name AS student_name
     FROM certificates cert
     LEFT JOIN courses c ON c.id = cert.course_id
     JOIN user_profiles up ON up.user_id = cert.student_id
     WHERE cert.id = ? AND cert.student_id = ?`,
    [certId, studentId]
  );
  if (!cert) throw new AppError('Certificate not found.', 404, 'NOT_FOUND');
  return cert;
}

async function getDownloadUrl(certId, studentId) {
  const [[cert]] = await db.query(
    'SELECT id, file_url, title, certificate_code FROM certificates WHERE id = ? AND student_id = ?',
    [certId, studentId]
  );
  if (!cert) throw new AppError('Certificate not found.', 404, 'NOT_FOUND');

  return {
    download_url:     cert.file_url || null,
    certificate_code: cert.certificate_code,
    title:            cert.title,
  };
}

async function verifyCertificate(code) {
  const [[cert]] = await db.query(
    `SELECT cert.certificate_code, cert.issued_at, cert.title,
            up.full_name AS student_name,
            c.title AS course_title
     FROM certificates cert
     JOIN user_profiles up ON up.user_id = cert.student_id
     LEFT JOIN courses c ON c.id = cert.course_id
     WHERE cert.certificate_code = ?`,
    [code]
  );
  if (!cert) throw new AppError('Certificate not found or invalid.', 404, 'NOT_FOUND');
  return { valid: true, certificate: cert };
}

module.exports = { listCertificates, getCertificate, getDownloadUrl, verifyCertificate };