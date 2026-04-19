/**
 * EduVerse — Study Materials Routes
 * modules/materials/materials.routes.js
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const controller = require('./materials.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

/* ============================================================
   MULTER SETUP — File Upload
============================================================ */

// Create uploads folder if not exists
const uploadDir = path.join(__dirname, '../../../uploads/materials');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext    = path.extname(file.originalname);
    cb(null, 'material-' + unique + ext);
  },
});

const fileFilter = function (req, file, cb) {
  const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip'];
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, Word, PowerPoint and ZIP files are allowed.'), false);
  }
};

const upload = multer({
  storage:    storage,
  fileFilter: fileFilter,
  limits:     { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

/* ============================================================
   PUBLIC ROUTES
============================================================ */

router.get('/',            controller.getMaterials);
router.get('/categories',  controller.getCategories);
router.get('/:id',         protect, controller.getMaterial);

/* ============================================================
   STUDENT ROUTES
============================================================ */

router.post('/:id/purchase',
  protect, restrictTo('student'),
  controller.purchaseMaterial
);

router.post('/:id/confirm-purchase',
  protect, restrictTo('student'),
  controller.confirmPurchase
);

router.get('/:id/download',
  protect, restrictTo('student'),
  controller.getDownloadUrl
);

router.get('/my/purchases',
  protect, restrictTo('student'),
  controller.getMyPurchases
);

router.post('/:id/review',
  protect, restrictTo('student'),
  controller.addReview
);

/* ============================================================
   INSTRUCTOR ROUTES
============================================================ */

router.post('/upload',
  protect, restrictTo('instructor'),
  upload.single('file'),
  controller.uploadMaterial
);

router.get('/my/materials',
  protect, restrictTo('instructor'),
  controller.getMyMaterials
);

router.delete('/:id',
  protect, restrictTo('instructor'),
  controller.deleteMaterial
);

module.exports = router;