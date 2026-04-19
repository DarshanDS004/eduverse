/**
 * EduVerse — Certificates Routes
 * modules/certificates/certificates.routes.js
 */
'use strict';
const express    = require('express');
const router     = express.Router();
const controller = require('./certificates.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

router.get('/verify/:code', controller.verify);  // public
router.use(protect, restrictTo('student'));
router.get('/',             controller.list);
router.get('/:id',          controller.detail);
router.get('/:id/download', controller.download);

module.exports = router;