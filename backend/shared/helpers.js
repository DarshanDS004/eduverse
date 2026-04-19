/**
 * EduVerse — Shared Helpers
 * shared/helpers.js
 *
 * Pure utility functions used across all modules.
 * No dependencies on DB, Express, or other services.
 */

'use strict';

const crypto = require('crypto');

/* ============================================================
   STRING UTILITIES
============================================================ */

/**
 * Generate a random alphanumeric string
 * Used for: invite codes, temporary passwords, reference IDs
 */
function randomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Generate a unique certificate code
 * Format: EV-XXXXXXXXXXXXXXXX (16 uppercase hex chars)
 */
function generateCertificateCode() {
  return 'EV-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Generate a short OTP (6 digits by default)
 */
function generateOTP(digits = 6) {
  const max = Math.pow(10, digits);
  return String(crypto.randomInt(Math.pow(10, digits - 1), max)).padStart(digits, '0');
}

/**
 * Slugify a string for URL-safe use
 * Example: "Grade 10 - Section A" → "grade-10-section-a"
 */
function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Truncate a string to maxLength, adding ellipsis if needed
 */
function truncate(str, maxLength = 100) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter of each word
 */
function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Sanitize string for safe display (basic XSS prevention)
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ============================================================
   NUMBER UTILITIES
============================================================ */

/**
 * Round a number to N decimal places
 */
function round(num, decimals = 2) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Calculate percentage
 */
function percentage(value, total, decimals = 1) {
  if (!total || total === 0) return 0;
  return round((value / total) * 100, decimals);
}

/**
 * Format currency (INR by default)
 */
function formatCurrency(amount, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Clamp a number between min and max
 */
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/* ============================================================
   DATE UTILITIES
============================================================ */

/**
 * Format a date to readable string
 * Example: "15 Jan 2025"
 */
function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

/**
 * Format datetime
 * Example: "15 Jan 2025, 10:30 AM"
 */
function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get relative time string
 * Example: "2 hours ago", "in 3 days"
 */
function timeAgo(date) {
  const now   = Date.now();
  const then  = new Date(date).getTime();
  const diff  = now - then;
  const abs   = Math.abs(diff);
  const future = diff < 0;

  const units = [
    { label: 'year',   ms: 365 * 24 * 60 * 60 * 1000 },
    { label: 'month',  ms: 30  * 24 * 60 * 60 * 1000 },
    { label: 'week',   ms: 7   * 24 * 60 * 60 * 1000 },
    { label: 'day',    ms: 24  * 60 * 60 * 1000 },
    { label: 'hour',   ms: 60  * 60 * 1000 },
    { label: 'minute', ms: 60  * 1000 },
    { label: 'second', ms: 1000 },
  ];

  for (const unit of units) {
    const count = Math.floor(abs / unit.ms);
    if (count >= 1) {
      const label = count === 1 ? unit.label : unit.label + 's';
      return future ? `in ${count} ${label}` : `${count} ${label} ago`;
    }
  }

  return 'just now';
}

/**
 * Check if a date is in the past
 */
function isPast(date) {
  return new Date(date) < new Date();
}

/**
 * Check if a date is within N days from now
 */
function isWithinDays(date, days) {
  const now    = Date.now();
  const target = new Date(date).getTime();
  return target > now && target < now + days * 24 * 60 * 60 * 1000;
}

/**
 * Get start of day (midnight) for a date
 */
function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get date N days ago
 */
function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/* ============================================================
   FILE UTILITIES
============================================================ */

/**
 * Format file size for display
 * Example: 1048576 → "1.0 MB"
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get file extension from filename
 */
function getExtension(filename) {
  if (!filename) return '';
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file extension is in allowed list
 */
function isAllowedExtension(filename, allowed) {
  const ext = getExtension(filename);
  return allowed.map(e => e.toLowerCase().replace('.', '')).includes(ext);
}

/* ============================================================
   ARRAY UTILITIES
============================================================ */

/**
 * Remove duplicate objects from array by key
 */
function uniqueBy(arr, key) {
  const seen = new Set();
  return arr.filter(item => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * Group array of objects by a key
 * Example: groupBy(users, 'role') → { student: [...], instructor: [...] }
 */
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

/**
 * Chunk array into smaller arrays of given size
 * Used for bulk operations (e.g. bulk SMS, bulk DB inserts)
 */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Pick specific keys from an object
 * Example: pick(user, ['id', 'name', 'email'])
 */
function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

/**
 * Omit specific keys from an object
 * Example: omit(user, ['password_hash', 'refresh_token'])
 */
function omit(obj, keys) {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/* ============================================================
   VALIDATION HELPERS
============================================================ */

/**
 * Check if a string is a valid email
 */
function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/**
 * Check if a string is a valid Indian phone number
 */
function isIndianPhone(str) {
  return /^(\+91|0)?[6-9]\d{9}$/.test(str.replace(/\s/g, ''));
}

/**
 * Check if value is a positive integer
 */
function isPositiveInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

/* ============================================================
   CRYPTO HELPERS
============================================================ */

/**
 * Hash a string with SHA-256 (for webhook signature verification, etc.)
 */
function sha256(data, secret) {
  if (secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a secure random token (URL-safe)
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/* ============================================================
   SLEEP / DELAY
============================================================ */

/**
 * Promise-based sleep (for rate limiting, retries, etc.)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function N times with delay
 */
async function retry(fn, times = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= times; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === times) throw err;
      await sleep(delayMs * attempt);
    }
  }
}

/* ============================================================
   EXPORT
============================================================ */

module.exports = {
  // Strings
  randomString,
  generateCertificateCode,
  generateOTP,
  slugify,
  truncate,
  titleCase,
  escapeHtml,

  // Numbers
  round,
  percentage,
  formatCurrency,
  clamp,

  // Dates
  formatDate,
  formatDateTime,
  timeAgo,
  isPast,
  isWithinDays,
  startOfDay,
  daysAgo,

  // Files
  formatFileSize,
  getExtension,
  isAllowedExtension,

  // Arrays / Objects
  uniqueBy,
  groupBy,
  chunk,
  pick,
  omit,

  // Validation
  isEmail,
  isIndianPhone,
  isPositiveInt,

  // Crypto
  sha256,
  generateToken,

  // Async
  sleep,
  retry,
};