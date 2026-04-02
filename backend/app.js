/**
 * EduVerse — Express App
 * app.js
 */

'use strict';

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const path         = require('path');
require('dotenv').config();

const { globalErrorHandler, sendError } = require('./shared/errorHandler');

const app = express();

/* ============================================================
   SECURITY MIDDLEWARE
============================================================ */

app.use(helmet());

// CORS — allow frontend to talk to backend
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ============================================================
   RATE LIMITING
============================================================ */

// Global rate limit
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      100,
  message:  { success: false, message: 'Too many requests. Please try again later.' },
}));

// Strict rate limit for auth endpoints
app.use('/api/v1/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many auth attempts. Please try again later.' },
}));

/* ============================================================
   BODY PARSING
============================================================ */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ============================================================
   HEALTH CHECK
============================================================ */

app.get('/health', function (req, res) {
  res.json({
    success: true,
    message: 'EduVerse API is running.',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
});

/* ============================================================
   API ROUTES
============================================================ */

app.use('/api/v1/auth', require('./modules/auth/auth.routes'));

app.use('/api/v1/student', require('./modules/student/student.routes'));

/* ============================================================
   404 HANDLER
============================================================ */

app.use(function (req, res) {
  sendError(res, 404, 'Route not found.', 'NOT_FOUND');
});

/* ============================================================
   GLOBAL ERROR HANDLER
============================================================ */

app.use(globalErrorHandler);

module.exports = app;