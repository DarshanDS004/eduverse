# storage.js — File Storage Abstraction

> **EduVerse** | `config/storage.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Driver Selection](#4-driver-selection)
5. [Upload Function](#5-upload-function)
6. [Remove Function](#6-remove-function)
7. [Signed URL (Private Files)](#7-signed-url-private-files)
8. [Multer Storage Integration](#8-multer-storage-integration)
9. [Helper Utilities](#9-helper-utilities)
10. [Local Driver Details](#10-local-driver-details)
11. [S3 / MinIO Driver Details](#11-s3--minio-driver-details)
12. [Error Handling](#12-error-handling)
13. [Environment Variables](#13-environment-variables)
14. [Usage Examples](#14-usage-examples)
15. [Workflow Diagram](#15-workflow-diagram)
16. [Possible Improvements](#16-possible-improvements)

---

## 1. Overview

`storage.js` provides a unified file storage interface that abstracts over two backends: local disk storage and AWS S3 / MinIO (S3-compatible object storage). Switching between backends requires only a change to the `STORAGE_DRIVER` environment variable — no code changes needed.

**File location:** `config/storage.js`

---

## 2. Purpose & Problem Solved

During development, local disk storage is convenient — files are immediately accessible without cloud credentials. In production, S3/MinIO provides scalability, CDN integration, and resilience across multiple server instances.

Without this abstraction, every route that uploads a file would need conditional logic for `if (local) { ... } else { ... }`. `storage.js` encapsulates that entirely.

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `path` | Node.js built-in | Path construction |
| `fs` | Node.js built-in | Local file operations |
| `multer` | npm | Multipart form-data handling (used in `getMulterStorage`) |
| `@aws-sdk/client-s3` | npm (optional) | S3 upload/delete/presign |
| `@aws-sdk/s3-request-presigner` | npm (optional) | Generating presigned URLs |

```bash
# For S3 storage driver:
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# For file upload handling (always needed):
npm install multer
```

---

## 4. Driver Selection

```javascript
const DRIVER = process.env.STORAGE_DRIVER || 'local';
```

| `STORAGE_DRIVER` | Backend | Use For |
|---|---|---|
| `local` (default) | `/uploads` folder on server disk | Development, single-server production |
| `s3` | AWS S3 or MinIO | Production, multi-server, CDN delivery |

**Important:** When `STORAGE_DRIVER=s3`, Multer temporarily saves files to `/tmp/eduverse/{folder}/` — the route handler is responsible for calling `storage.upload()` to move the file to S3 after Multer saves it locally.

---

## 5. Upload Function

```javascript
/**
 * Upload a file to the configured storage backend
 *
 * @param {object}  options
 * @param {string}  options.localPath  - Absolute path to source file on disk
 * @param {string}  options.folder     - Destination folder name (e.g. 'videos', 'avatars')
 * @param {string}  options.filename   - Destination filename
 * @param {string}  options.mimetype   - MIME type (used by S3 for Content-Type header)
 * @param {boolean} options.isPublic   - true = publicly accessible URL (default: true)
 *
 * @returns {{ url: string, key: string, size: number }}
 */
const result = await storage.upload({
  localPath: '/tmp/uploaded-video.mp4',
  folder:    'videos',
  filename:  'video-42.mp4',
  mimetype:  'video/mp4',
  isPublic:  true,
});
```

**Return value:**
```javascript
// Local driver:
{
  url:  '/uploads/videos/video-42.mp4',   // Public URL path
  key:  'videos/video-42.mp4',            // Storage key (use for delete/signed URL)
  size: 15728640,                          // File size in bytes
}

// S3 driver:
{
  url:  'https://bucket.s3.ap-south-1.amazonaws.com/videos/video-42.mp4',
  key:  'videos/video-42.mp4',
  size: 15728640,
}
```

---

## 6. Remove Function

```javascript
/**
 * Delete a file from storage
 * @param {string} key - File key (e.g. 'videos/video-42.mp4')
 */
await storage.remove('videos/video-42.mp4');
```

**Local:** Deletes file at `{LOCAL_BASE}/{key}`. Silent no-op if file doesn't exist.

**S3:** Sends `DeleteObjectCommand`. Errors are caught and logged (never throws).

---

## 7. Signed URL (Private Files)

Used for paid video content, private documents, or any file that should not be publicly accessible.

```javascript
/**
 * Generate a temporary access URL for a private file
 * @param {string} key        - File key in storage
 * @param {number} expiresIn  - URL validity in seconds (default: 3600 = 1 hour)
 * @returns {string} URL string
 */
const url = await storage.getSignedUrl('videos/premium-lecture.mp4', 3600);
```

**Local driver:** Returns `/uploads/videos/premium-lecture.mp4` — no signing (direct path). Only appropriate for development.

**S3 driver:** Returns a presigned URL with embedded auth signature, valid for `expiresIn` seconds:
```
https://bucket.s3.ap-south-1.amazonaws.com/videos/premium-lecture.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&...
```

After expiry, the URL returns `403 Forbidden`.

---

## 8. Multer Storage Integration

Returns a configured Multer `diskStorage` engine for file upload middleware:

```javascript
/**
 * Get multer storage engine for a given folder
 * @param {string} folder - Subfolder name (e.g. 'videos', 'avatars', 'assignments')
 * @returns multer.diskStorage engine
 */
function getMulterStorage(folder)
```

**Usage in an Express route:**
```javascript
const multer  = require('multer');
const storage = require('../config/storage');

const upload = multer({
  storage: storage.getMulterStorage('avatars'),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  const file = req.file;
  // file.path = absolute path to saved file
  // file.filename = generated filename

  if (storage.driver === 's3') {
    // Move from /tmp to S3
    const result = await storage.upload({
      localPath: file.path,
      folder:    'avatars',
      filename:  file.filename,
      mimetype:  file.mimetype,
    });
    res.json({ url: result.url });
  } else {
    res.json({ url: `/uploads/avatars/${file.filename}` });
  }
});
```

**Generated filename pattern:** `{folder}-{Date.now()}{ext}`

Examples:
- `avatars-1700000000000.jpg`
- `videos-1700000000001.mp4`
- `assignments-1700000000002.pdf`

**Driver differences:**

| Driver | Multer saves to | Then... |
|---|---|---|
| `local` | `/uploads/{folder}/` directly | File is ready immediately |
| `s3` | `/tmp/eduverse/{folder}/` | Route handler must call `upload()` to push to S3 |

---

## 9. Helper Utilities

### `getPublicUrl(key)`

Normalizes any stored key or partial path to a valid public URL:

```javascript
storage.getPublicUrl('videos/lecture.mp4')
// local  → '/uploads/videos/lecture.mp4'
// s3     → 'https://bucket.s3.ap-south-1.amazonaws.com/videos/lecture.mp4'

storage.getPublicUrl('/uploads/videos/lecture.mp4')
// → '/uploads/videos/lecture.mp4' (already normalized)

storage.getPublicUrl('https://cdn.example.com/videos/lecture.mp4')
// → 'https://cdn.example.com/videos/lecture.mp4' (passthrough — already absolute)

storage.getPublicUrl(null)
// → null
```

### `listLocal(folder)`

Lists all files in a local storage folder (local driver only):

```javascript
const files = storage.listLocal('certificates');
// Returns:
[
  { filename: 'cert-10-ABC123.pdf', path: '/uploads/certificates/cert-10-ABC123.pdf', size: 45231 },
  ...
]
```

Returns `[]` if the folder doesn't exist.

---

## 10. Local Driver Details

**Base directory:** `path.join(__dirname, '../../uploads')`

File paths resolve to: `{project_root}/uploads/{folder}/{filename}`

The `ensureDir()` helper creates directories recursively when needed:
```javascript
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
```

Local file copy (when `localPath !== destPath`):
```javascript
fs.copyFileSync(localPath, destPath);
```

If `localPath === destPath` (Multer already saved to correct location), no copy is performed — the file is already in place.

---

## 11. S3 / MinIO Driver Details

### AWS S3 Configuration
```javascript
new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

### MinIO Override
When `MINIO_ENDPOINT` is set, the S3 client is configured for MinIO:
```javascript
{
  endpoint:       process.env.MINIO_ENDPOINT,   // e.g. 'http://localhost:9000'
  forcePathStyle: true,                          // Required for MinIO
  credentials: {
    accessKeyId:     process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
}
```

### CDN URL Support
When `CDN_URL` is set, all public URLs use the CDN prefix instead of direct S3 URLs:
```javascript
// Without CDN:  https://bucket.s3.ap-south-1.amazonaws.com/videos/lecture.mp4
// With CDN:     https://cdn.yourdomain.com/videos/lecture.mp4
```

### S3 Upload (reads entire file into memory)
```javascript
const content = fs.readFileSync(localPath);  // ← Full file in memory
await s3Client.send(new PutObjectCommand({
  Bucket:      bucket,
  Key:         key,
  Body:        content,
  ContentType: mimetype,
  ACL:         isPublic ? 'public-read' : 'private',
}));
```

> **Note:** For large files (videos), this reads the entire file into Node.js memory. See [Possible Improvements](#16-possible-improvements).

---

## 12. Error Handling

| Operation | Error Behavior |
|---|---|
| `upload()` local | File copy errors propagate to caller |
| `upload()` S3 | S3 errors propagate to caller |
| `remove()` local | Caught and logged — never throws |
| `remove()` S3 | Caught and logged — never throws |
| `getSignedUrl()` S3 | Propagates to caller |
| `getMulterStorage()` | Directory creation errors propagate |

---

## 13. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `STORAGE_DRIVER` | No | `local` | `local` or `s3` |
| `AWS_REGION` | If S3 | `ap-south-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | If S3 (not MinIO) | — | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | If S3 (not MinIO) | — | AWS secret key |
| `AWS_BUCKET_NAME` | If S3 (not MinIO) | `eduverse-uploads` | S3 bucket name |
| `MINIO_ENDPOINT` | If MinIO | — | MinIO server URL (e.g. `http://localhost:9000`) |
| `MINIO_ACCESS_KEY` | If MinIO | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | If MinIO | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | If MinIO | `eduverse` | MinIO bucket name |
| `CDN_URL` | No | — | CDN prefix for public file URLs |

---

## 14. Usage Examples

### Upload an avatar after Multer saves it
```javascript
const storage = require('../config/storage');

// After multer saves file to disk:
const result = await storage.upload({
  localPath: req.file.path,
  folder:    'avatars',
  filename:  req.file.filename,
  mimetype:  req.file.mimetype,
  isPublic:  true,
});

await db.query('UPDATE user_profiles SET avatar_url = ? WHERE user_id = ?',
  [result.url, userId]);
```

### Get presigned URL for paid video
```javascript
// Student enrolled in course — generate time-limited stream URL
const signedUrl = await storage.getSignedUrl(
  video.video_url.replace('/uploads/', ''),  // normalize to key
  7200  // 2-hour URL
);
res.json({ streamUrl: signedUrl });
```

### Delete file when content is removed
```javascript
await storage.remove(`assignments/${submission.filename}`);
await db.query('DELETE FROM assignment_submissions WHERE id = ?', [id]);
```

---

## 15. Workflow Diagram

```
Student/Instructor uploads file via form
        │
        ▼
Express route with multer middleware
  ├─ STORAGE_DRIVER=local → Multer saves to /uploads/{folder}/
  └─ STORAGE_DRIVER=s3   → Multer saves to /tmp/eduverse/{folder}/
        │
        ▼
Route handler calls storage.upload({ localPath, folder, filename, ... })
  ├─ local → copy to /uploads/{folder}/{filename} → return { url, key, size }
  └─ s3    → read file → S3 PutObject → return { url, key, size }
        │
        ▼
Store result.url in DB
        │
        ▼
Serve to client:
  ├─ local, public  → Express static middleware → /uploads/...
  ├─ s3, public     → Direct S3 / CDN URL
  └─ s3, private    → storage.getSignedUrl(key) → presigned URL
```

---

## 16. Possible Improvements

1. **Streaming S3 upload** — Replace `fs.readFileSync` (loads entire file into memory) with a stream:
   ```javascript
   Body: fs.createReadStream(localPath)
   ```
   Critical for large video files.

2. **Multipart upload for large files** — For files over 100MB, use S3 multipart upload (`CreateMultipartUpload`) for better reliability and upload resume support.

3. **File type validation** — Add MIME type checking using `file-type` npm package to verify actual file content (not just the extension) before accepting uploads.

4. **Virus scanning** — Integrate ClamAV or a cloud scanning service (AWS GuardDuty, Cloudmersive) on uploaded files before storing.

5. **Image optimization** — For image uploads (avatars, thumbnails), automatically resize/compress with `sharp` before storing:
   ```javascript
   await sharp(localPath).resize(200, 200).webp().toFile(destPath);
   ```

6. **Storage quota enforcement** — Track per-institute storage usage in the DB and reject uploads when quota is exceeded.

7. **Cleanup for /tmp files** — Add a cron job to delete stale files in `/tmp/eduverse/` that weren't successfully uploaded to S3.

8. **MinIO bucket creation** — Auto-create the MinIO bucket on startup if it doesn't exist (useful for first-time setup):
   ```javascript
   await s3Client.send(new CreateBucketCommand({ Bucket: getS3Bucket() }));
   ```
