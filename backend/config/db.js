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

// Test connection on startup — non-blocking, never crashes the require() chain.
// process.exit(1) is intentionally removed: calling it inside a require()'d file
// kills the process mid-load, causing every module that required db.js to export {}
// instead of its router — making Express throw:
//   "Router.use() requires a middleware function but got a Object"
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('\u2705 MySQL connected \u2014 database:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('\u274c MySQL connection failed:', err.message);
    console.error('   Fix DB_HOST / DB_USER / DB_PASSWORD / DB_NAME in your .env file.');
    // Server stays up — DB errors surface per-request via the query() calls in services.
  }
}

testConnection();

module.exports = pool;