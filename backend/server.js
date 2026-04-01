/**
 * EduVerse — Server Entry Point
 * server.js
 */

'use strict';

require('dotenv').config();
require('./config/db');

const app  = require('./app');
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, function () {
  console.log('');
  console.log('🚀 EduVerse API Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port     : ${PORT}`);
  console.log(`🌍 Env      : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL      : http://localhost:${PORT}`);
  console.log(`❤️  Health   : http://localhost:${PORT}/health`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', function (err) {
  console.error('❌ Unhandled Rejection:', err.message);
  server.close(function () {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', function (err) {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

module.exports = server;