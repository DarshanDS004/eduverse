/**
 * EduVerse — File Storage
 * config/storage.js
 *
 * Abstracts file storage behind a single interface.
 * Supports two drivers:
 *
 * 1. LOCAL — stores files in /uploads folder on disk
 *    Use for: development, single-server deployments
 *
 * 2. S3 — stores files on AWS S3 or MinIO (S3-compatible)
 *    Use for: production, multi-server, CDN delivery
 *
 * All methods return a consistent object:
 * { url, key, size, mimetype }
 *
 * Switch drivers via STORAGE_DRIVER env variable:
 * STORAGE_DRIVER=local  (default)
 * STORAGE_DRIVER=s3
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const DRIVER = process.env.STORAGE_DRIVER || 'local';

/* ============================================================
   LOCAL STORAGE DRIVER
============================================================ */

const LOCAL_BASE = path.join(__dirname, '../../uploads');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get public URL for a local file
 */
function localUrl(filePath) {
  // filePath = uploads/videos/abc.mp4
  // Returns: /uploads/videos/abc.mp4
  const relative = filePath.replace(LOCAL_BASE, '').replace(/\\/g, '/');
  return relative.startsWith('/uploads') ? relative : '/uploads' + relative;
}

/* ============================================================
   S3 / MINIO DRIVER
============================================================ */

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  const { S3Client } = require('@aws-sdk/client-s3');

  const config = {
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  };

  // MinIO override
  if (process.env.MINIO_ENDPOINT) {
    config.endpoint = process.env.MINIO_ENDPOINT;
    config.forcePathStyle = true;
    config.credentials = {
      accessKeyId:     process.env.MINIO_ACCESS_KEY     || 'minioadmin',
      secretAccessKey: process.env.MINIO_SECRET_KEY     || 'minioadmin',
    };
  }

  s3Client = new S3Client(config);
  return s3Client;
}

function getS3Bucket() {
  return process.env.MINIO_ENDPOINT
    ? (process.env.MINIO_BUCKET    || 'eduverse')
    : (process.env.AWS_BUCKET_NAME || 'eduverse-uploads');
}

function s3PublicUrl(key) {
  if (process.env.CDN_URL) {
    return `${process.env.CDN_URL}/${key}`;
  }
  if (process.env.MINIO_ENDPOINT) {
    return `${process.env.MINIO_ENDPOINT}/${getS3Bucket()}/${key}`;
  }
  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${getS3Bucket()}.s3.${region}.amazonaws.com/${key}`;
}

/* ============================================================
   UPLOAD FILE
============================================================ */

/**
 * Upload a file to storage
 *
 * @param {object} options
 * @param {string} options.localPath   - Absolute path to file on disk
 * @param {string} options.folder      - Destination folder (e.g. 'videos', 'avatars')
 * @param {string} options.filename    - Destination filename
 * @param {string} options.mimetype    - File MIME type
 * @param {boolean} options.isPublic   - Whether file should be publicly accessible
 *
 * @returns {{ url, key, size }}
 */
async function upload({ localPath, folder, filename, mimetype, isPublic = true }) {
  if (DRIVER === 's3') {
    return _uploadS3({ localPath, folder, filename, mimetype, isPublic });
  }
  return _uploadLocal({ localPath, folder, filename });
}

async function _uploadLocal({ localPath, folder, filename }) {
  const destDir  = path.join(LOCAL_BASE, folder);
  const destPath = path.join(destDir, filename);

  ensureDir(destDir);

  // Copy file to uploads folder (multer already puts it there — this handles manual uploads)
  if (localPath !== destPath && fs.existsSync(localPath)) {
    fs.copyFileSync(localPath, destPath);
  }

  const stat = fs.existsSync(destPath) ? fs.statSync(destPath) : null;

  return {
    url:  `/uploads/${folder}/${filename}`,
    key:  `${folder}/${filename}`,
    size: stat ? stat.size : 0,
  };
}

async function _uploadS3({ localPath, folder, filename, mimetype, isPublic }) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');

  const key     = `${folder}/${filename}`;
  const content = fs.readFileSync(localPath);

  const command = new PutObjectCommand({
    Bucket:      getS3Bucket(),
    Key:         key,
    Body:        content,
    ContentType: mimetype || 'application/octet-stream',
    ACL:         isPublic ? 'public-read' : 'private',
  });

  await getS3Client().send(command);

  const stat = fs.statSync(localPath);

  return {
    url:  s3PublicUrl(key),
    key:  key,
    size: stat.size,
  };
}

/* ============================================================
   DELETE FILE
============================================================ */

/**
 * Delete a file from storage
 * @param {string} key - File key (e.g. 'videos/abc.mp4')
 */
async function remove(key) {
  if (!key) return;

  if (DRIVER === 's3') {
    return _removeS3(key);
  }
  return _removeLocal(key);
}

function _removeLocal(key) {
  try {
    const filePath = path.join(LOCAL_BASE, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('[Storage] local remove error:', err.message);
  }
}

async function _removeS3(key) {
  try {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key });
    await getS3Client().send(command);
  } catch (err) {
    console.error('[Storage] S3 remove error:', err.message);
  }
}

/* ============================================================
   SIGNED URL (for private file access)
   Returns a temporary URL valid for N seconds.
   Used for: paid video content, private documents
============================================================ */

/**
 * Generate a signed URL for private file access
 * @param {string} key        - File key in storage
 * @param {number} expiresIn  - Expiry in seconds (default: 3600 = 1 hour)
 * @returns {string} Signed URL
 */
async function getSignedUrl(key, expiresIn = 3600) {
  if (DRIVER === 'local') {
    // Local: return direct URL (no signing in dev)
    return `/uploads/${key}`;
  }

  const { getSignedUrl: awsGetSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const { GetObjectCommand } = require('@aws-sdk/client-s3');

  const command = new GetObjectCommand({ Bucket: getS3Bucket(), Key: key });
  return awsGetSignedUrl(getS3Client(), command, { expiresIn });
}

/* ============================================================
   MULTER STORAGE — returns multer storage engine based on driver
============================================================ */

/**
 * Get multer storage config for a given subfolder
 * @param {string} folder - e.g. 'videos', 'avatars', 'assignments'
 * @returns multer storage engine
 */
function getMulterStorage(folder) {
  const multer = require('multer');

  if (DRIVER === 's3') {
    // In S3 mode: save to /tmp first, then upload in post-processing
    // For simplicity, use disk storage to /tmp and upload in the route handler
    const tmpDir = path.join('/tmp', 'eduverse', folder);
    ensureDir(tmpDir);
    return multer.diskStorage({
      destination: (req, file, cb) => cb(null, tmpDir),
      filename:    (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${folder}-${Date.now()}${ext}`);
      },
    });
  }

  // Local storage
  const uploadDir = path.join(LOCAL_BASE, folder);
  ensureDir(uploadDir);

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${folder}-${Date.now()}${ext}`);
    },
  });
}

/* ============================================================
   HELPERS
============================================================ */

/**
 * Get public URL for a stored file
 * Handles both local paths and S3 keys
 */
function getPublicUrl(key) {
  if (!key) return null;
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  if (DRIVER === 's3') return s3PublicUrl(key);
  return key.startsWith('/uploads') ? key : `/uploads/${key}`;
}

/**
 * List all files in a folder (local only)
 */
function listLocal(folder) {
  const dir = path.join(LOCAL_BASE, folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(f => ({
    filename: f,
    path:     `/uploads/${folder}/${f}`,
    size:     fs.statSync(path.join(dir, f)).size,
  }));
}

module.exports = {
  upload,
  remove,
  getSignedUrl,
  getMulterStorage,
  getPublicUrl,
  listLocal,
  driver: DRIVER,
};