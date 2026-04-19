/**
 * EduVerse — Environment Variable Validator
 * config/env.js
 *
 * Validates all required environment variables on startup.
 * If any critical variable is missing, the server exits immediately
 * with a clear error — not a cryptic runtime crash later.
 *
 * Usage: require('./config/env') at the very top of server.js
 */

'use strict';

/* ============================================================
   REQUIRED VARIABLES
   Server will NOT start if any of these are missing/empty
============================================================ */

const REQUIRED = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

/* ============================================================
   OPTIONAL BUT WARNED
   Server starts but logs a warning
============================================================ */

const OPTIONAL_WARN = [
  'MAIL_USER',
  'MAIL_PASS',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'FRONTEND_URL',
];

/* ============================================================
   VALIDATE
============================================================ */

function validate() {
  const missing = [];

  for (const key of REQUIRED) {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌  EduVerse startup failed — missing required environment variables:\n');
    missing.forEach(k => console.error(`    • ${k}`));
    console.error('\n    Copy .env.example to .env and fill in all required values.\n');
    process.exit(1);
  }

  // Warn about optional but important vars
  for (const key of OPTIONAL_WARN) {
    if (!process.env[key] || process.env[key].trim() === '') {
      console.warn(`⚠️  [env] Optional variable not set: ${key}`);
    }
  }

  // Warn if JWT secrets are too short
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  [env] JWT_SECRET is too short — use at least 32 characters for security.');
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    console.warn('⚠️  [env] JWT_REFRESH_SECRET is too short — use at least 32 characters for security.');
  }

  // Set safe defaults for optional vars
  if (!process.env.PORT)              process.env.PORT              = '5000';
  if (!process.env.NODE_ENV)          process.env.NODE_ENV          = 'development';
  if (!process.env.JWT_EXPIRES_IN)    process.env.JWT_EXPIRES_IN    = '15m';
  if (!process.env.JWT_REFRESH_EXPIRES_IN) process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  if (!process.env.BCRYPT_ROUNDS)     process.env.BCRYPT_ROUNDS     = '12';
  if (!process.env.DB_PORT)           process.env.DB_PORT           = '3306';
  if (!process.env.MAIL_HOST)         process.env.MAIL_HOST         = 'smtp.gmail.com';
  if (!process.env.MAIL_PORT)         process.env.MAIL_PORT         = '587';
  if (!process.env.FRONTEND_URL)      process.env.FRONTEND_URL      = 'http://localhost:5500';
  if (!process.env.STORAGE_DRIVER)    process.env.STORAGE_DRIVER    = 'local';

  console.log('✅ Environment variables validated.');
}

validate();

module.exports = { validate };