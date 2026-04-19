# video-transcode.job.js — Video Transcoding Processor

> **EduVerse** | `jobs/video-transcode.job.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose & Problem Solved](#2-purpose--problem-solved)
3. [Dependencies](#3-dependencies)
4. [Job Data Shape](#4-job-data-shape)
5. [Quality Profiles](#5-quality-profiles)
6. [Processing Pipeline](#6-processing-pipeline)
7. [FFmpeg Commands](#7-ffmpeg-commands)
8. [HLS Output Structure](#8-hls-output-structure)
9. [Thumbnail Generation](#9-thumbnail-generation)
10. [Database Interactions](#10-database-interactions)
11. [Error Handling](#11-error-handling)
12. [Environment Variables](#12-environment-variables)
13. [Setup & Installation](#13-setup--installation)
14. [Workflow Diagram](#14-workflow-diagram)
15. [Possible Improvements](#15-possible-improvements)

---

## 1. Overview

`video-transcode.job.js` is a **Bull queue job processor** responsible for converting uploaded raw video files into HLS (HTTP Live Streaming) format with multiple quality levels. It is registered with a concurrency of **1** (one video at a time) due to the CPU-intensive nature of video transcoding.

**File location:** `jobs/video-transcode.job.js`

---

## 2. Purpose & Problem Solved

Raw video uploads (MP4/MOV/AVI) cannot be streamed efficiently to students across varying network conditions. HLS with adaptive bitrate streaming solves:

| Problem | HLS Solution |
|---|---|
| Slow internet → buffering | Multiple quality levels — player switches automatically |
| Large file downloads | Segmented streaming (6-second chunks) |
| Seek performance | Random access to any segment without full download |
| Broad device compatibility | HLS supported on iOS, Android, modern browsers |

Processing this synchronously would block the API for several minutes per video.

---

## 3. Dependencies

| Module | Source | Purpose |
|---|---|---|
| `path` | Node.js built-in | File path construction |
| `fs` | Node.js built-in | Directory creation, file deletion |
| `child_process.execFile` | Node.js built-in | Run FFmpeg subprocess |
| `../config/db` | Internal | DB status updates |
| `ffmpeg` | System binary (not npm) | Video encoding and transcoding |

> **Note:** FFmpeg must be installed as a system binary. The processor auto-detects its availability and degrades gracefully if not found.

---

## 4. Job Data Shape

```javascript
{
  videoId:   number,   // Primary key — videos.id in DB
  inputPath: string,   // Absolute path to the uploaded raw video file
  outputDir: string,   // Absolute base directory for HLS output
}
```

**How to enqueue:**
```javascript
const { queueVideoTranscode } = require('./jobs/queue');

await queueVideoTranscode({
  videoId:   42,
  inputPath: '/home/app/uploads/raw/video-42.mp4',
  outputDir: '/home/app/uploads/hls',
});
```

---

## 5. Quality Profiles

Four quality levels are generated for adaptive bitrate streaming:

| Profile | Resolution | Video Bitrate | Audio Bitrate | Use Case |
|---|---|---|---|---|
| `360p` | 480×360 | 400 kbps | 64 kbps | Low-bandwidth / mobile data |
| `480p` | 854×480 | 800 kbps | 96 kbps | Standard mobile |
| `720p` | 1280×720 | 1500 kbps | 128 kbps | HD — good WiFi |
| `1080p` | 1920×1080 | 3000 kbps | 192 kbps | Full HD — fast connection |

The video player (on the frontend) automatically selects the best quality based on the viewer's current bandwidth using the master playlist.

---

## 6. Processing Pipeline

```
Step 1  [DB]       UPDATE videos SET processing_status = 'processing'
Step 2  [Check]    execFile('ffmpeg', ['-version']) — verify FFmpeg installed
         └─ If missing → mark 'ready', return { skipped: true, reason: 'ffmpeg_not_found' }
Step 3  [FS]       mkdir /uploads/hls/{videoId}/ (recursive)
Step 4  [FFmpeg]   For each quality profile (360p → 480p → 720p → 1080p):
         a. mkdir /uploads/hls/{videoId}/{quality}/
         b. Run FFmpeg → HLS segments + index.m3u8
         c. Update job.progress()
         d. Append stream info to master playlist lines
Step 5  [FS]       Write /uploads/hls/{videoId}/master.m3u8
Step 6  [DB]       UPDATE videos SET video_url = '/uploads/hls/{id}/master.m3u8', processing_status = 'ready'
Step 7  [FFmpeg]   Generate thumbnail from frame at t=2s → /uploads/thumbnails/{videoId}.jpg
Step 8  [DB]       UPDATE videos SET thumbnail_url = '...' WHERE thumbnail_url IS NULL
Step 9  [FS]       (Optional) Delete original file if DELETE_ORIGINAL_AFTER_TRANSCODE=true
```

**Job progress milestones:**

| Progress | Stage |
|---|---|
| 5% | Status set to 'processing' |
| 10% | FFmpeg check passed, output dir created |
| 32% | 360p transcoded (10 + 1/4 × 80) |
| 55% | 480p transcoded |
| 77% | 720p transcoded |
| 90% | 1080p transcoded |
| 95% | Master playlist written, DB updated |
| 100% | Thumbnail generated |

---

## 7. FFmpeg Commands

### Per-Quality Transcoding Command

```bash
ffmpeg \
  -i {inputPath} \
  -vf scale={width}:{height} \
  -c:v libx264 \
  -b:v {bitrate} \
  -c:a aac \
  -b:a {audioBitrate} \
  -f hls \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_segment_filename /uploads/hls/{videoId}/{quality}/seg%03d.ts \
  /uploads/hls/{videoId}/{quality}/index.m3u8
```

**Parameter explanation:**

| Flag | Value | Meaning |
|---|---|---|
| `-vf scale=W:H` | e.g. `1280:720` | Scale video to target resolution |
| `-c:v libx264` | — | H.264 video codec (universally supported) |
| `-b:v` | e.g. `1500k` | Target video bitrate |
| `-c:a aac` | — | AAC audio codec |
| `-b:a` | e.g. `128k` | Target audio bitrate |
| `-f hls` | — | Output format: HLS |
| `-hls_time 6` | 6 seconds | Each .ts segment duration |
| `-hls_list_size 0` | unlimited | Keep all segments in playlist |
| `-hls_segment_filename` | `seg%03d.ts` | Segment naming pattern |

### Thumbnail Command

```bash
ffmpeg \
  -i {inputPath} \
  -ss 00:00:02 \
  -vframes 1 \
  -q:v 2 \
  /uploads/thumbnails/{videoId}.jpg
```

Captures a single frame at 2 seconds into the video as a JPEG thumbnail.

---

## 8. HLS Output Structure

After successful transcoding, the output directory looks like:

```
uploads/hls/{videoId}/
├── master.m3u8           ← Master playlist (what the video player loads)
├── 360p/
│   ├── index.m3u8        ← 360p quality playlist
│   ├── seg000.ts
│   ├── seg001.ts
│   └── ...
├── 480p/
│   ├── index.m3u8
│   ├── seg000.ts
│   └── ...
├── 720p/
│   ├── index.m3u8
│   ├── seg000.ts
│   └── ...
└── 1080p/
    ├── index.m3u8
    ├── seg000.ts
    └── ...

uploads/thumbnails/
└── {videoId}.jpg         ← Auto-generated thumbnail
```

**Master playlist format (`master.m3u8`):**
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=480x360
360p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480
480p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1920x1080
1080p/index.m3u8
```

---

## 9. Thumbnail Generation

- Captured at **2 seconds** into the video
- JPEG format, quality level 2 (high quality)
- Saved to `/uploads/thumbnails/{videoId}.jpg`
- Public URL: `/uploads/thumbnails/{videoId}.jpg`
- DB updated with `WHERE thumbnail_url IS NULL` — does **not** overwrite custom thumbnails set by the instructor

Thumbnail failure is **non-blocking** — if FFmpeg fails to generate the thumbnail (e.g., video too short), a warning is logged and the job continues successfully.

---

## 10. Database Interactions

| Operation | Table | Column | Value |
|---|---|---|---|
| Mark processing | `videos` | `processing_status` | `'processing'` |
| Mark ready (no FFmpeg) | `videos` | `processing_status` | `'ready'` |
| Update HLS URL | `videos` | `video_url` | `/uploads/hls/{id}/master.m3u8` |
| Mark ready | `videos` | `processing_status` | `'ready'` |
| Set thumbnail | `videos` | `thumbnail_url` | `/uploads/thumbnails/{id}.jpg` |
| Mark failed | `videos` | `processing_status` | `'failed'` |

**Status lifecycle:**
```
queued → processing → ready
                   └→ failed (on FFmpeg error)
```

---

## 11. Error Handling

| Scenario | Behavior |
|---|---|
| FFmpeg not installed | Updates status to `'ready'` (no transcoding), returns `{ skipped: true }` — does NOT fail job |
| FFmpeg transcoding fails (any quality) | Marks status `'failed'`, re-throws error → Bull retries |
| Output directory creation fails | Throws → Bull retries |
| Thumbnail generation fails | Warning logged, ignored — job continues |
| DB query fails | Throws → Bull retries |

**Retry policy (inherited from queue.js):**
- Max attempts: **3**
- Backoff: **exponential**, starting at 2s

**On final failure (3 attempts exhausted):** Job moves to Bull's failed state. `processing_status` in DB remains `'failed'`. Manual intervention or a re-queue is required.

---

## 12. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DELETE_ORIGINAL_AFTER_TRANSCODE` | No | `false` | Set `true` to delete raw uploaded file after HLS is generated |
| `REDIS_HOST` | No | — | Required for async queuing; without it, runs inline (marks `'ready'` only) |

---

## 13. Setup & Installation

### Install FFmpeg

```bash
# Ubuntu / Debian
sudo apt-get install -y ffmpeg

# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Ensure Directories Are Writable

```bash
mkdir -p uploads/hls uploads/thumbnails uploads/raw
chmod 755 uploads/hls uploads/thumbnails
```

### Docker Considerations

When running inside Docker:

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

The Puppeteer flags `--no-sandbox` and `--disable-dev-shm-usage` are used in certificate/report processors; for FFmpeg, ensure the container has sufficient CPU and memory limits:

```yaml
# docker-compose.yml
services:
  worker:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

---

## 14. Workflow Diagram

```
Instructor uploads video via UI
        │
        ▼
[Multer] Saves to /uploads/raw/video-{timestamp}.mp4
        │
        ▼
[Controller]
  INSERT INTO videos (processing_status='queued', ...)
  queueVideoTranscode({ videoId, inputPath, outputDir })
        │
        ▼
[queue.js] videoQueue.add(data, { priority: 5 }) → Redis
        │
        ▼  (async — "Video uploaded, processing..." shown to instructor)
[video-transcode.job.js]
  ├─ UPDATE videos SET status='processing'
  ├─ Check FFmpeg binary
  ├─ For each quality profile:
  │    └─ ffmpeg -i input.mp4 → /uploads/hls/{id}/{quality}/
  ├─ Write master.m3u8
  ├─ UPDATE videos SET video_url=..., status='ready'
  ├─ ffmpeg thumbnail → /uploads/thumbnails/{id}.jpg
  └─ UPDATE videos SET thumbnail_url=...
        │
        ▼
Video available for streaming at /uploads/hls/{id}/master.m3u8
Students can watch with adaptive quality
```

---

## 15. Possible Improvements

1. **Separate worker process** — Video transcoding is CPU-intensive and runs at concurrency 1 in the main process. Move to a dedicated worker process (or separate server) to prevent slowing HTTP responses.

2. **HLS encryption (DRM)** — Protect paid video content by encrypting HLS segments with AES-128:
   ```
   -hls_key_info_file encryption.keyinfo
   ```

3. **Progress events to frontend** — Emit WebSocket events as job progress updates so instructors see real-time transcoding percentage in the UI.

4. **Subtitle/caption support** — After transcoding, auto-generate subtitles using Whisper AI or accept uploaded `.srt` files and include them in the HLS manifest.

5. **Cloud transcoding** — For scale, replace FFmpeg with AWS Elastic Transcoder, AWS MediaConvert, or Mux — offload processing entirely from the application server.

6. **Quality profile customization** — Allow institutes to configure which quality profiles to generate (e.g., skip 1080p to save storage on low-budget plans).

7. **Storage cleanup** — Add a job to delete HLS segments for videos that have been unpublished or deleted, freeing disk/S3 storage.

8. **Transcode retry with backoff** — Currently all 3 Bull retries attempt full retranscoding. Add checkpoint tracking so a retry can skip already-completed quality levels.
