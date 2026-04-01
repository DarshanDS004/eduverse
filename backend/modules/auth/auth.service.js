/**
 * EduVerse — Auth Service
 * modules/auth/auth.service.js
 */

'use strict';

const bcrypt             = require('bcryptjs');
const jwt                = require('jsonwebtoken');
const { v4: uuidv4 }     = require('uuid');
const db                 = require('../../config/db');
const { sendMail, templates } = require('../../config/mailer');
const { AppError }       = require('../../shared/errorHandler');

/* ============================================================
   HELPERS
============================================================ */

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

/* ============================================================
   REGISTER
============================================================ */

async function register(data) {
  const {
    name, email, password, role,
    phone, dob, grade,
    institute_code, parent_email,
    subject, qualification, experience,
    linkedin, bio, levels,
    relation, child_name, child_grade,
    institute_name, institute_type,
    city, state, affiliation, website, capacity,
  } = data;

  // Check if email already exists
  const [existing] = await db.query(
    'SELECT id FROM users WHERE email = ?',
    [email.toLowerCase().trim()]
  );

  if (existing.length > 0) {
    throw new AppError('This email is already registered. Please sign in.', 409, 'EMAIL_EXISTS');
  }

  // Hash password
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const password_hash = await bcrypt.hash(password, rounds);

  // Insert user
  const [userResult] = await db.query(
    `INSERT INTO users (email, phone, password_hash, role)
     VALUES (?, ?, ?, ?)`,
    [
      email.toLowerCase().trim(),
      phone || null,
      password_hash,
      role,
    ]
  );

  const userId = userResult.insertId;

  // Insert user profile
  await db.query(
    `INSERT INTO user_profiles (user_id, full_name, date_of_birth, city, state)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      name.trim(),
      dob || null,
      city || null,
      state || null,
    ]
  );

  // Generate email verification token
  const verifyToken = uuidv4();
  const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.query(
    `INSERT INTO email_verifications (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    [userId, verifyToken, expiresAt]
  );

  // Send verification email
  const verifyUrl = `${process.env.FRONTEND_URL}/pages/auth/verify-email.html?token=${verifyToken}`;
  const emailTemplate = templates.verifyEmail(name.trim(), verifyUrl);

  await sendMail({
    to:      email,
    subject: emailTemplate.subject,
    html:    emailTemplate.html,
  });

  return {
    message: 'Registration successful. Please check your email to verify your account.',
    email:   email,
    role:    role,
  };
}

/* ============================================================
   VERIFY EMAIL
============================================================ */

async function verifyEmail(token) {
  // Find token
  const [rows] = await db.query(
    `SELECT ev.*, u.email, up.full_name
     FROM email_verifications ev
     JOIN users u ON u.id = ev.user_id
     JOIN user_profiles up ON up.user_id = ev.user_id
     WHERE ev.token = ?`,
    [token]
  );

  if (rows.length === 0) {
    throw new AppError('Invalid or expired verification link.', 400, 'INVALID_TOKEN');
  }

  const record = rows[0];

  // Check expiry
  if (new Date() > new Date(record.expires_at)) {
    throw new AppError('Verification link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
  }

  // Mark user as verified
  await db.query(
    'UPDATE users SET is_verified = 1 WHERE id = ?',
    [record.user_id]
  );

  // Delete used token
  await db.query(
    'DELETE FROM email_verifications WHERE token = ?',
    [token]
  );

  return {
    message: 'Email verified successfully. You can now sign in.',
    email:   record.email,
  };
}

/* ============================================================
   RESEND VERIFICATION
============================================================ */

async function resendVerification(email) {
  const [rows] = await db.query(
    `SELECT u.id, u.is_verified, up.full_name
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.email = ?`,
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    throw new AppError('No account found with this email.', 404, 'USER_NOT_FOUND');
  }

  const user = rows[0];

  if (user.is_verified) {
    throw new AppError('This email is already verified.', 400, 'ALREADY_VERIFIED');
  }

  // Delete old tokens
  await db.query('DELETE FROM email_verifications WHERE user_id = ?', [user.id]);

  // Generate new token
  const verifyToken = uuidv4();
  const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(
    'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, verifyToken, expiresAt]
  );

  const verifyUrl = `${process.env.FRONTEND_URL}/pages/auth/verify-email.html?token=${verifyToken}`;
  const emailTemplate = templates.verifyEmail(user.full_name, verifyUrl);

  await sendMail({
    to:      email,
    subject: emailTemplate.subject,
    html:    emailTemplate.html,
  });

  return { message: 'Verification email sent. Please check your inbox.' };
}

/* ============================================================
   LOGIN
============================================================ */

async function login(email, password) {
  // Find user with profile
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.password_hash, u.role,
            u.is_active, u.is_verified,
            up.full_name, up.photo_url
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.email = ?`,
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const user = rows[0];

  // Check password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  // Check if account is active
  if (!user.is_active) {
    throw new AppError('Your account has been suspended. Please contact support.', 403, 'ACCOUNT_SUSPENDED');
  }

  // Check if email is verified
  if (!user.is_verified) {
    throw new AppError('Please verify your email address before signing in.', 403, 'EMAIL_NOT_VERIFIED');
  }

  // Generate tokens
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token in DB
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, refreshToken, refreshExpiresAt]
  );

  return {
    token:         accessToken,
    refresh_token: refreshToken,
    expires_at:    new Date(Date.now() + 15 * 60 * 1000),
    user: {
      id:     user.id,
      name:   user.full_name,
      email:  user.email,
      role:   user.role,
      avatar: user.photo_url || null,
    },
  };
}

/* ============================================================
   REFRESH TOKEN
============================================================ */

async function refreshToken(token) {
  // Verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Check token exists in DB
  const [rows] = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ?',
    [token, decoded.id]
  );

  if (rows.length === 0) {
    throw new AppError('Refresh token not found.', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Check expiry
  if (new Date() > new Date(rows[0].expires_at)) {
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
    throw new AppError('Refresh token expired. Please log in again.', 401, 'REFRESH_TOKEN_EXPIRED');
  }

  // Get user
  const [userRows] = await db.query(
    `SELECT u.id, u.email, u.role, up.full_name, up.photo_url
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = ?`,
    [decoded.id]
  );

  if (userRows.length === 0) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const user = userRows[0];

  // Generate new access token
  const newAccessToken = generateAccessToken(user);

  return {
    token:      newAccessToken,
    expires_at: new Date(Date.now() + 15 * 60 * 1000),
  };
}

/* ============================================================
   LOGOUT
============================================================ */

async function logout(userId, token) {
  if (token) {
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  } else if (userId) {
    await db.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }
  return { message: 'Logged out successfully.' };
}

/* ============================================================
   GET ME
============================================================ */

async function getMe(userId) {
  const [rows] = await db.query(
    `SELECT u.id, u.email, u.phone, u.role,
            u.is_verified, u.created_at,
            up.full_name, up.photo_url, up.bio,
            up.date_of_birth, up.gender,
            up.city, up.state, up.country
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  if (rows.length === 0) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const user = rows[0];

  return {
    id:           user.id,
    name:         user.full_name,
    email:        user.email,
    phone:        user.phone,
    role:         user.role,
    avatar:       user.photo_url || null,
    bio:          user.bio,
    date_of_birth:user.date_of_birth,
    gender:       user.gender,
    city:         user.city,
    state:        user.state,
    country:      user.country,
    is_verified:  user.is_verified,
    created_at:   user.created_at,
  };
}

/* ============================================================
   FORGOT PASSWORD
============================================================ */

async function forgotPassword(email) {
  const [rows] = await db.query(
    `SELECT u.id, up.full_name
     FROM users u
     JOIN user_profiles up ON up.user_id = u.id
     WHERE u.email = ?`,
    [email.toLowerCase().trim()]
  );

  // Don't reveal if email exists or not
  if (rows.length === 0) {
    return { message: 'If this email is registered, you will receive a reset link shortly.' };
  }

  const user = rows[0];

  // Delete old reset tokens
  await db.query('DELETE FROM password_resets WHERE user_id = ?', [user.id]);

  // Generate reset token
  const resetToken  = uuidv4();
  const expiresAt   = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.query(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)',
    [user.id, resetToken, expiresAt]
  );

  const resetUrl = `${process.env.FRONTEND_URL}/pages/auth/reset-password.html?token=${resetToken}`;
  const emailTemplate = templates.resetPassword(user.full_name, resetUrl);

  await sendMail({
    to:      email,
    subject: emailTemplate.subject,
    html:    emailTemplate.html,
  });

  return { message: 'If this email is registered, you will receive a reset link shortly.' };
}

/* ============================================================
   RESET PASSWORD
============================================================ */

async function resetPassword(token, password) {
  const [rows] = await db.query(
    'SELECT * FROM password_resets WHERE token = ? AND used = 0',
    [token]
  );

  if (rows.length === 0) {
    throw new AppError('Invalid or expired reset link.', 400, 'INVALID_TOKEN');
  }

  const record = rows[0];

  if (new Date() > new Date(record.expires_at)) {
    throw new AppError('Reset link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
  }

  // Hash new password
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const password_hash = await bcrypt.hash(password, rounds);

  // Update password
  await db.query(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [password_hash, record.user_id]
  );

  // Mark token as used
  await db.query(
    'UPDATE password_resets SET used = 1 WHERE token = ?',
    [token]
  );

  // Invalidate all refresh tokens
  await db.query(
    'DELETE FROM refresh_tokens WHERE user_id = ?',
    [record.user_id]
  );

  return { message: 'Password reset successfully. You can now sign in.' };
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};