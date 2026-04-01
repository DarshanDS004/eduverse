/**
 * EduVerse — MySQL Database Connection
 * config/db.js
 */

'use strict';

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'eduverse_db',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  timezone:           '+05:30',
  charset:            'utf8mb4',
});

// Test connection on startup
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected — database:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();

module.exports = pool;