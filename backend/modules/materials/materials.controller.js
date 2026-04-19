/**
 * EduVerse — Study Materials Controller
 * modules/materials/materials.controller.js
 */

'use strict';

const service                    = require('./materials.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

/* ── Browse materials (student/public) ── */
async function getMaterials(req, res, next) {
  try {
    const result = await service.getMaterials(req.query);
    return sendSuccess(res, 200, 'Materials fetched.', result);
  } catch (err) { next(err); }
}

/* ── Get single material ── */
async function getMaterial(req, res, next) {
  try {
    const studentId = req.user ? req.user.id : null;
    const result    = await service.getMaterial(req.params.id, studentId);
    return sendSuccess(res, 200, 'Material fetched.', result);
  } catch (err) { next(err); }
}

/* ── Purchase material ── */
async function purchaseMaterial(req, res, next) {
  try {
    const result = await service.purchaseMaterial(
      req.params.id, req.user.id
    );
    return sendSuccess(res, 200, result.message, result);
  } catch (err) { next(err); }
}

/* ── Confirm paid purchase ── */
async function confirmPurchase(req, res, next) {
  try {
    const { payment_id, amount_paid } = req.body;
    const result = await service.confirmPurchase(
      req.params.id, req.user.id, payment_id, amount_paid
    );
    return sendSuccess(res, 200, result.message, result);
  } catch (err) { next(err); }
}

/* ── Get download URL ── */
async function getDownloadUrl(req, res, next) {
  try {
    const result = await service.getDownloadUrl(
      req.params.id, req.user.id
    );
    return sendSuccess(res, 200, 'Download URL generated.', result);
  } catch (err) { next(err); }
}

/* ── Get my purchased materials ── */
async function getMyPurchases(req, res, next) {
  try {
    const result = await service.getMyPurchases(req.user.id);
    return sendSuccess(res, 200, 'Purchases fetched.', result);
  } catch (err) { next(err); }
}

/* ── Add review ── */
async function addReview(req, res, next) {
  try {
    const { rating, review_text } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return sendError(res, 400, 'Rating must be between 1 and 5.', 'INVALID_RATING');
    }
    const result = await service.addReview(
      req.params.id, req.user.id, rating, review_text
    );
    return sendSuccess(res, 200, result.message);
  } catch (err) { next(err); }
}

/* ── Instructor: Upload material ── */
async function uploadMaterial(req, res, next) {
  try {
    const result = await service.uploadMaterial(
      req.user.id, req.body, req.file
    );
    return sendSuccess(res, 201, result.message, result);
  } catch (err) { next(err); }
}

/* ── Instructor: Get my materials ── */
async function getMyMaterials(req, res, next) {
  try {
    const result = await service.getMyMaterials(req.user.id);
    return sendSuccess(res, 200, 'Materials fetched.', result);
  } catch (err) { next(err); }
}

/* ── Instructor: Delete material ── */
async function deleteMaterial(req, res, next) {
  try {
    const result = await service.deleteMaterial(
      req.params.id, req.user.id
    );
    return sendSuccess(res, 200, result.message);
  } catch (err) { next(err); }
}

/* ── Get categories ── */
async function getCategories(req, res, next) {
  try {
    const result = await service.getCategories();
    return sendSuccess(res, 200, 'Categories fetched.', result);
  } catch (err) { next(err); }
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