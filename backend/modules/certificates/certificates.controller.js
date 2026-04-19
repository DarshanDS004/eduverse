/**
 * EduVerse — Certificates Controller
 * modules/certificates/certificates.controller.js
 */
'use strict';
const service = require('./certificates.service');
const { sendSuccess } = require('../../shared/errorHandler');

async function list(req, res, next) {
  try { return sendSuccess(res, 200, 'Certificates fetched.', await service.listCertificates(req.user.id)); }
  catch (err) { next(err); }
}
async function detail(req, res, next) {
  try { return sendSuccess(res, 200, 'Certificate fetched.', await service.getCertificate(req.params.id, req.user.id)); }
  catch (err) { next(err); }
}
async function download(req, res, next) {
  try { return sendSuccess(res, 200, 'Download URL generated.', await service.getDownloadUrl(req.params.id, req.user.id)); }
  catch (err) { next(err); }
}
async function verify(req, res, next) {
  try { return sendSuccess(res, 200, 'Certificate verified.', await service.verifyCertificate(req.params.code)); }
  catch (err) { next(err); }
}
module.exports = { list, detail, download, verify };

/**
 * EduVerse — Certificates Routes
 * modules/certificates/certificates.routes.js
 * (exported below as a second module — split into separate files when copying)
 */