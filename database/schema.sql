-- ============================================================
-- EduVerse Database Schema
-- Run this file once to set up the database
-- ============================================================

CREATE DATABASE IF NOT EXISTS eduverse_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE eduverse_db;

-- ── Users table ──
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  phone         VARCHAR(20)  DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('superadmin','institute','instructor','student','parent') NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── User profiles table ──
CREATE TABLE IF NOT EXISTS user_profiles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL UNIQUE,
  full_name   VARCHAR(255) NOT NULL,
  photo_url   VARCHAR(500) DEFAULT NULL,
  bio         TEXT         DEFAULT NULL,
  date_of_birth DATE       DEFAULT NULL,
  gender      ENUM('male','female','other') DEFAULT NULL,
  address     TEXT         DEFAULT NULL,
  city        VARCHAR(100) DEFAULT NULL,
  state       VARCHAR(100) DEFAULT NULL,
  country     VARCHAR(100) DEFAULT 'India',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Email verification tokens ──
CREATE TABLE IF NOT EXISTS email_verifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token   (token),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Password reset tokens ──
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  used       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Refresh tokens ──
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      VARCHAR(500) NOT NULL UNIQUE,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token   (token),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Audit logs ──
CREATE TABLE IF NOT EXISTS audit_logs (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED DEFAULT NULL,
  action         VARCHAR(100) NOT NULL,
  reference_type VARCHAR(100) DEFAULT NULL,
  reference_id   INT UNSIGNED DEFAULT NULL,
  ip_address     VARCHAR(45)  DEFAULT NULL,
  user_agent     TEXT         DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action  (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;