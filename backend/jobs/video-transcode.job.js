/**
 * EduVerse — Video Transcode Job Processor
 * jobs/video-transcode.job.js
 *
 * Processes video transcoding jobs using FFmpeg.
 * Converts uploaded videos to HLS (HTTP Live Streaming) format
 * with multiple quality levels for adaptive bitrate streaming.
 *
 * Input: raw uploaded video (MP4/MOV/AVI)
 * Output: HLS playlist (.m3u8) + video segments (.ts) at multiple qualities:
 *   - 360p  (480×360)
 *   - 480p  (854×480)
 *   - 720p  (1280×720)
 *   - 1080p (1920×1080)
 *
 * Status progression:
 * queued → processing → ready (or failed)
 *
 * Job data shape:
 * {
 *   videoId:    number   // DB record ID
 *   inputPath:  string   // absolute path to uploaded file
 *   outputDir:  string   // absolute path to output HLS folder
 * }
 *
 * NOTE: FFmpeg must be installed on the server.
 * Install: sudo apt install ffmpeg (Linux)
 *           brew install ffmpeg (macOS)
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const db   = require('../config/db');

/* ── Quality profiles ── */
const QUALITY_PROFILES = [
  { name: '360p',  width: 480,  height: 360,  bitrate: '400k',  audioBitrate: '64k'  },
  { name: '480p',  width: 854,  height: 480,  bitrate: '800k',  audioBitrate: '96k'  },
  { name: '720p',  width: 1280, height: 720,  bitrate: '1500k', audioBitrate: '128k' },
  { name: '1080p', width: 1920, height: 1080, bitrate: '3000k', audioBitrate: '192k' },
];

/**
 * Register video transcode processor with the Bull queue
 * @param {Queue} queue - Bull video queue instance
 */
module.exports = function registerVideoProcessor(queue) {

  // Process 1 video at a time (CPU-intensive)
  queue.process(1, async function (job) {
    const { videoId, inputPath, outputDir } = job.data;

    console.log(`[VideoJob] Starting transcode for video ${videoId}`);

    // Update status to processing
    await db.query(
      "UPDATE videos SET processing_status = 'processing' WHERE id = ?",
      [videoId]
    );

    job.progress(5);

    // Check FFmpeg is available
    const ffmpegAvailable = await checkFFmpeg();
    if (!ffmpegAvailable) {
      console.warn(`[VideoJob] FFmpeg not available. Marking video ${videoId} as ready without transcoding.`);
      await db.query(
        "UPDATE videos SET processing_status = 'ready' WHERE id = ?",
        [videoId]
      );
      return { videoId, skipped: true, reason: 'ffmpeg_not_found' };
    }

    // Ensure output directory exists
    const hlsDir = path.join(outputDir, String(videoId));
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }

    job.progress(10);

    try {
      // Transcode each quality level
      const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
      const totalProfiles = QUALITY_PROFILES.length;

      for (let i = 0; i < totalProfiles; i++) {
        const profile = QUALITY_PROFILES[i];
        await transcodeToHLS(inputPath, hlsDir, profile);

        const progressPct = 10 + Math.round(((i + 1) / totalProfiles) * 80);
        job.progress(progressPct);

        // Add to master playlist
        masterLines.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(profile.bitrate) * 1000},RESOLUTION=${profile.width}x${profile.height}`,
          `${profile.name}/index.m3u8`
        );
      }

      // Write master playlist
      const masterPath = path.join(hlsDir, 'master.m3u8');
      fs.writeFileSync(masterPath, masterLines.join('\n'));

      job.progress(95);

      // Build public URL for master playlist
      const hlsUrl = `/uploads/hls/${videoId}/master.m3u8`;

      // Update DB with HLS URL and mark ready
      await db.query(
        "UPDATE videos SET video_url = ?, processing_status = 'ready' WHERE id = ?",
        [hlsUrl, videoId]
      );

      // Generate thumbnail from first frame
      const thumbPath = path.join(outputDir, '..', 'thumbnails', `${videoId}.jpg`);
      await generateThumbnail(inputPath, thumbPath);
      await db.query(
        'UPDATE videos SET thumbnail_url = ? WHERE id = ? AND thumbnail_url IS NULL',
        [`/uploads/thumbnails/${videoId}.jpg`, videoId]
      );

      // Delete original file to save space (optional)
      if (process.env.DELETE_ORIGINAL_AFTER_TRANSCODE === 'true' && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      job.progress(100);

      console.log(`[VideoJob] Transcode complete for video ${videoId}`);
      return { videoId, hlsUrl, profiles: QUALITY_PROFILES.map(p => p.name) };

    } catch (err) {
      // Mark failed
      await db.query(
        "UPDATE videos SET processing_status = 'failed' WHERE id = ?",
        [videoId]
      );
      throw err;
    }
  });

};

/* ============================================================
   TRANSCODE ONE QUALITY LEVEL TO HLS
============================================================ */

function transcodeToHLS(inputPath, hlsDir, profile) {
  return new Promise((resolve, reject) => {
    const { execFile } = require('child_process');
    const profileDir   = path.join(hlsDir, profile.name);

    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const outputPlaylist = path.join(profileDir, 'index.m3u8');
    const segmentPattern = path.join(profileDir, 'seg%03d.ts');

    const args = [
      '-i', inputPath,
      '-vf',  `scale=${profile.width}:${profile.height}`,
      '-c:v', 'libx264',
      '-b:v', profile.bitrate,
      '-c:a', 'aac',
      '-b:a', profile.audioBitrate,
      '-f',   'hls',
      '-hls_time',         '6',
      '-hls_list_size',    '0',
      '-hls_segment_filename', segmentPattern,
      outputPlaylist,
    ];

    execFile('ffmpeg', args, (err, stdout, stderr) => {
      if (err) {
        console.error(`[VideoJob] FFmpeg error for ${profile.name}:`, stderr?.slice(-500));
        reject(new Error(`FFmpeg failed for ${profile.name}: ${err.message}`));
      } else {
        console.log(`[VideoJob] Transcoded ${profile.name}`);
        resolve();
      }
    });
  });
}

/* ============================================================
   GENERATE THUMBNAIL
============================================================ */

function generateThumbnail(inputPath, outputPath) {
  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const args = [
      '-i', inputPath,
      '-ss', '00:00:02',   // grab frame at 2 seconds
      '-vframes', '1',
      '-q:v', '2',
      outputPath,
    ];

    execFile('ffmpeg', args, (err) => {
      if (err) {
        console.warn('[VideoJob] Thumbnail generation failed:', err.message);
      }
      resolve(); // non-blocking — thumbnail failure should not fail the job
    });
  });
}

/* ============================================================
   CHECK FFMPEG AVAILABILITY
============================================================ */

function checkFFmpeg() {
  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    execFile('ffmpeg', ['-version'], (err) => {
      resolve(!err);
    });
  });
}