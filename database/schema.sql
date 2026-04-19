-- ============================================================
-- EduVerse — Complete Database Schema v3.1
-- Covers all 5 roles: SuperAdmin, Institute, Instructor, Student, Parent
-- 
-- FIXES from v3.0:
--   1. videos table — added type, content, timestamps columns
--   2. coupons table — added is_active column
--   3. courses table — added short_description column
--   4. assignment_submissions — added annotated_file_url column
--   5. Removed stray '+' character at end of file
--
-- Run once on a clean database
-- ============================================================

CREATE DATABASE IF NOT EXISTS eduverse_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE eduverse_db;

-- ============================================================
-- 1. CORE USER TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  phone         VARCHAR(20)  DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('superadmin','institute','instructor','student','parent') NOT NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
  last_login_at DATETIME     DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email      (email),
  INDEX idx_role       (role),
  INDEX idx_is_active  (is_active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_profiles (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL UNIQUE,
  full_name        VARCHAR(255) NOT NULL,
  photo_url        VARCHAR(500) DEFAULT NULL,
  bio              TEXT         DEFAULT NULL,
  date_of_birth    DATE         DEFAULT NULL,
  gender           ENUM('male','female','other') DEFAULT NULL,
  address          TEXT         DEFAULT NULL,
  city             VARCHAR(100) DEFAULT NULL,
  state            VARCHAR(100) DEFAULT NULL,
  country          VARCHAR(100) DEFAULT 'India',
  -- Student-specific
  grade            VARCHAR(50)  DEFAULT NULL,
  institute_code   VARCHAR(50)  DEFAULT NULL,
  -- Instructor-specific
  subject          VARCHAR(255) DEFAULT NULL,
  qualification    VARCHAR(255) DEFAULT NULL,
  experience_years INT          DEFAULT NULL,
  linkedin_url     VARCHAR(500) DEFAULT NULL,
  teaching_levels  VARCHAR(255) DEFAULT NULL,
  is_verified_instructor TINYINT(1) DEFAULT 0,
  -- Institute-specific
  institute_name   VARCHAR(255) DEFAULT NULL,
  institute_type   VARCHAR(100) DEFAULT NULL,
  website          VARCHAR(500) DEFAULT NULL,
  -- Parent-specific
  relation         ENUM('father','mother','guardian') DEFAULT NULL,
  -- Notification preferences (JSON)
  notif_prefs      JSON         DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- ============================================================
-- 2. INSTITUTE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS institutes (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id               INT UNSIGNED NOT NULL UNIQUE,
  name                  VARCHAR(255) NOT NULL,
  type                  ENUM('school','college','coaching','university','other') NOT NULL DEFAULT 'school',
  address               TEXT         DEFAULT NULL,
  city                  VARCHAR(100) DEFAULT NULL,
  state                 VARCHAR(100) DEFAULT NULL,
  country               VARCHAR(100) DEFAULT 'India',
  logo_url              VARCHAR(500) DEFAULT NULL,
  accreditation_doc_url VARCHAR(500) DEFAULT NULL,
  contact_email         VARCHAR(255) DEFAULT NULL,
  contact_phone         VARCHAR(20)  DEFAULT NULL,
  website               VARCHAR(500) DEFAULT NULL,
  -- Subscription
  subscription_plan     ENUM('basic','standard','premium') NOT NULL DEFAULT 'basic',
  subscription_start    DATE         DEFAULT NULL,
  subscription_end      DATE         DEFAULT NULL,
  max_students          INT UNSIGNED DEFAULT 500,
  max_teachers          INT UNSIGNED DEFAULT 50,
  -- Status
  status                ENUM('pending','active','suspended','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason      TEXT         DEFAULT NULL,
  approved_by           INT UNSIGNED DEFAULT NULL,
  approved_at           DATETIME     DEFAULT NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_type   (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS institute_members (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NOT NULL,
  role         ENUM('owner','sub_admin','teacher','student') NOT NULL DEFAULT 'student',
  status       ENUM('pending','active','inactive') NOT NULL DEFAULT 'active',
  joined_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_member (institute_id, user_id),
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_institute_id (institute_id),
  INDEX idx_user_id      (user_id),
  INDEX idx_role         (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS academic_years (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id INT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  is_current   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  INDEX idx_institute_id (institute_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS classes (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id     INT UNSIGNED NOT NULL,
  academic_year_id INT UNSIGNED DEFAULT NULL,
  name             VARCHAR(100) NOT NULL,
  section          VARCHAR(10)  DEFAULT NULL,
  description      TEXT         DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id)     REFERENCES institutes(id)    ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
  INDEX idx_institute_id (institute_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_students (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id    INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  roll_number VARCHAR(50)  DEFAULT NULL,
  joined_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_class_student (class_id, student_id),
  FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_class_id   (class_id),
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_teachers (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id   INT UNSIGNED NOT NULL,
  teacher_id INT UNSIGNED NOT NULL,
  subject    VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY uq_class_teacher_subject (class_id, teacher_id, subject),
  FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_class_id   (class_id),
  INDEX idx_teacher_id (teacher_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS timetable (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id    INT UNSIGNED NOT NULL,
  teacher_id  INT UNSIGNED DEFAULT NULL,
  subject     VARCHAR(255) NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  room        VARCHAR(100) DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id)   REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id)   ON DELETE SET NULL,
  INDEX idx_class_id (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS academic_calendar (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id INT UNSIGNED NOT NULL,
  event_name   VARCHAR(255) NOT NULL,
  event_type   ENUM('holiday','exam','assignment_deadline','event','ptm','live_class','other') NOT NULL DEFAULT 'event',
  event_date   DATE         NOT NULL,
  end_date     DATE         DEFAULT NULL,
  description  TEXT         DEFAULT NULL,
  color        VARCHAR(20)  DEFAULT '#1A56DB',
  is_recurring TINYINT(1)   NOT NULL DEFAULT 0,
  recur_rule   VARCHAR(100) DEFAULT NULL,
  created_by   INT UNSIGNED DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  INDEX idx_institute_id (institute_id),
  INDEX idx_event_date   (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. FEE MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS fee_structures (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id INT UNSIGNED NOT NULL,
  name         VARCHAR(255) NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  type         ENUM('tuition','exam','activity','library','transport','other') NOT NULL DEFAULT 'tuition',
  academic_year VARCHAR(20)  DEFAULT NULL,
  due_date     DATE         DEFAULT NULL,
  description  TEXT         DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  INDEX idx_institute_id (institute_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS student_fees (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fee_structure_id INT UNSIGNED NOT NULL,
  student_id       INT UNSIGNED NOT NULL,
  institute_id     INT UNSIGNED NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  due_date         DATE         DEFAULT NULL,
  paid_at          DATETIME     DEFAULT NULL,
  payment_id       VARCHAR(255) DEFAULT NULL,
  payment_method   ENUM('online','cash','cheque','bank_transfer') DEFAULT NULL,
  status           ENUM('pending','paid','overdue','waived') NOT NULL DEFAULT 'pending',
  receipt_url      VARCHAR(500) DEFAULT NULL,
  notes            TEXT         DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_fee (fee_structure_id, student_id),
  FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)       REFERENCES users(id)          ON DELETE CASCADE,
  FOREIGN KEY (institute_id)     REFERENCES institutes(id)     ON DELETE CASCADE,
  INDEX idx_student_id   (student_id),
  INDEX idx_institute_id (institute_id),
  INDEX idx_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. PARENT-STUDENT LINKING
-- ============================================================

CREATE TABLE IF NOT EXISTS parent_students (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id   INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  relation    ENUM('father','mother','guardian') NOT NULL DEFAULT 'guardian',
  is_verified TINYINT(1)   NOT NULL DEFAULT 0,
  linked_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parent_student (parent_id, student_id),
  FOREIGN KEY (parent_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_parent_id  (parent_id),
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. COURSES
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instructor_id     INT UNSIGNED NOT NULL,
  institute_id      INT UNSIGNED DEFAULT NULL,
  title             VARCHAR(255) NOT NULL,
  -- FIX v3.1: added short_description (used by courses.html form)
  short_description VARCHAR(500) DEFAULT NULL,
  description       TEXT         DEFAULT NULL,
  thumbnail_url     VARCHAR(500) DEFAULT NULL,
  trailer_url       VARCHAR(500) DEFAULT NULL,
  category          VARCHAR(100) DEFAULT NULL,
  sub_category      VARCHAR(100) DEFAULT NULL,
  level             ENUM('preschool','primary','middle','high','ug','pg','beginner','intermediate','advanced') DEFAULT 'beginner',
  language          VARCHAR(50)  DEFAULT 'English',
  price             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_free           TINYINT(1)   NOT NULL DEFAULT 1,
  is_featured       TINYINT(1)   NOT NULL DEFAULT 0,
  status            ENUM('draft','pending_review','published','archived','rejected') NOT NULL DEFAULT 'draft',
  rejection_reason  TEXT         DEFAULT NULL,
  total_duration    INT          DEFAULT 0,
  tags              TEXT         DEFAULT NULL,
  requirements      TEXT         DEFAULT NULL,
  what_you_learn    TEXT         DEFAULT NULL,
  target_audience   TEXT         DEFAULT NULL,
  avg_rating        DECIMAL(3,2) DEFAULT 0.00,
  total_ratings     INT UNSIGNED DEFAULT 0,
  enrolled_count    INT UNSIGNED DEFAULT 0,
  published_at      DATETIME     DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (institute_id)  REFERENCES institutes(id) ON DELETE SET NULL,
  INDEX idx_instructor  (instructor_id),
  INDEX idx_status      (status),
  INDEX idx_category    (category),
  INDEX idx_is_featured (is_featured),
  FULLTEXT INDEX ft_search (title, description, tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_modules (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id   INT UNSIGNED NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT         DEFAULT NULL,
  order_index INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_id (course_id),
  INDEX idx_order     (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FIX v3.1: added type, content, timestamps columns
-- type      — course-builder supports video / article / quiz lesson types
-- content   — stores article text for article-type lessons
-- timestamps — stores chapter markers as JSON text for video lessons
CREATE TABLE IF NOT EXISTS videos (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module_id         INT UNSIGNED NOT NULL,
  title             VARCHAR(255) NOT NULL,
  description       TEXT         DEFAULT NULL,
  type              ENUM('video','article','quiz') NOT NULL DEFAULT 'video',
  content           TEXT         DEFAULT NULL,
  video_url         VARCHAR(500) DEFAULT NULL,
  duration          INT          DEFAULT 0,
  timestamps        TEXT         DEFAULT NULL,
  order_index       INT UNSIGNED NOT NULL DEFAULT 0,
  is_preview        TINYINT(1)   NOT NULL DEFAULT 0,
  processing_status ENUM('queued','processing','ready','failed') NOT NULL DEFAULT 'ready',
  thumbnail_url     VARCHAR(500) DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES course_modules(id) ON DELETE CASCADE,
  INDEX idx_module_id (module_id),
  INDEX idx_type      (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS video_resources (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  video_id INT UNSIGNED NOT NULL,
  title    VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  type     ENUM('pdf','link','code','zip','other') NOT NULL DEFAULT 'pdf',
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  INDEX idx_video_id (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS video_captions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  video_id         INT UNSIGNED NOT NULL,
  language         VARCHAR(50)  NOT NULL DEFAULT 'English',
  caption_file_url VARCHAR(500) NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  INDEX idx_video_id (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enrollments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id  INT UNSIGNED NOT NULL,
  course_id   INT UNSIGNED NOT NULL,
  payment_id  VARCHAR(255) DEFAULT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  source      ENUM('purchased','free','institute_assigned') NOT NULL DEFAULT 'free',
  enrolled_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME     DEFAULT NULL,
  UNIQUE KEY uq_enrollment (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_student_id (student_id),
  INDEX idx_course_id  (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_progress (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id            INT UNSIGNED NOT NULL,
  course_id             INT UNSIGNED NOT NULL,
  completion_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  last_video_id         INT UNSIGNED DEFAULT NULL,
  last_activity_at      DATETIME     DEFAULT NULL,
  completed_at          DATETIME     DEFAULT NULL,
  UNIQUE KEY uq_progress (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS video_progress (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      INT UNSIGNED NOT NULL,
  video_id        INT UNSIGNED NOT NULL,
  watched_seconds INT          NOT NULL DEFAULT 0,
  completed       TINYINT(1)   NOT NULL DEFAULT 0,
  last_watched_at DATETIME     DEFAULT NULL,
  UNIQUE KEY uq_video_progress (student_id, video_id),
  FOREIGN KEY (student_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (video_id)   REFERENCES videos(id) ON DELETE CASCADE,
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS video_notes (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        INT UNSIGNED NOT NULL,
  video_id          INT UNSIGNED NOT NULL,
  timestamp_seconds INT          NOT NULL DEFAULT 0,
  note_text         TEXT         NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (video_id)   REFERENCES videos(id) ON DELETE CASCADE,
  INDEX idx_student_id (student_id),
  INDEX idx_video_id   (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS video_bookmarks (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id        INT UNSIGNED NOT NULL,
  video_id          INT UNSIGNED NOT NULL,
  timestamp_seconds INT          NOT NULL DEFAULT 0,
  label             VARCHAR(255) DEFAULT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (video_id)   REFERENCES videos(id) ON DELETE CASCADE,
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS course_reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id   INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT         DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (course_id, student_id),
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlist (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  course_id  INT UNSIGNED NOT NULL,
  added_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wishlist (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FIX v3.1: added is_active column
-- instructor.service.js saveCoupons() soft-deactivates old coupons:
-- UPDATE coupons SET is_active = 0 WHERE instructor_id = ?
CREATE TABLE IF NOT EXISTS coupons (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instructor_id  INT UNSIGNED NOT NULL,
  course_id      INT UNSIGNED DEFAULT NULL,
  code           VARCHAR(50)  NOT NULL UNIQUE,
  discount_type  ENUM('percentage','flat') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  max_uses       INT UNSIGNED DEFAULT NULL,
  used_count     INT UNSIGNED NOT NULL DEFAULT 0,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  expires_at     DATETIME     DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (course_id)     REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_code      (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS assignments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id     INT UNSIGNED NOT NULL,
  instructor_id INT UNSIGNED NOT NULL,
  class_id      INT UNSIGNED DEFAULT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT         DEFAULT NULL,
  instructions  TEXT         DEFAULT NULL,
  deadline      DATETIME     DEFAULT NULL,
  max_marks     INT UNSIGNED DEFAULT 100,
  allowed_types VARCHAR(255) DEFAULT 'pdf,doc,docx,zip,jpg,png',
  file_url      VARCHAR(500) DEFAULT NULL,
  rubric        JSON         DEFAULT NULL,
  status        ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)     REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (class_id)      REFERENCES classes(id) ON DELETE SET NULL,
  INDEX idx_course_id (course_id),
  INDEX idx_deadline  (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FIX v3.1: added annotated_file_url column
-- Stores the graded/annotated version of the student's submission
-- referenced in PRD: "download graded assignment with annotations"
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id      INT UNSIGNED NOT NULL,
  student_id         INT UNSIGNED NOT NULL,
  text               TEXT         DEFAULT NULL,
  file_url           VARCHAR(500) DEFAULT NULL,
  file_name          VARCHAR(255) DEFAULT NULL,
  annotated_file_url VARCHAR(500) DEFAULT NULL,
  status             ENUM('pending','submitted','graded','late') NOT NULL DEFAULT 'submitted',
  score              DECIMAL(6,2) DEFAULT NULL,
  feedback           TEXT         DEFAULT NULL,
  graded_by          INT UNSIGNED DEFAULT NULL,
  submitted_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  graded_at          DATETIME     DEFAULT NULL,
  UNIQUE KEY uq_submission (assignment_id, student_id),
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)    REFERENCES users(id)       ON DELETE CASCADE,
  INDEX idx_student_id    (student_id),
  INDEX idx_assignment_id (assignment_id),
  INDEX idx_status        (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. QUIZZES
-- ============================================================

CREATE TABLE IF NOT EXISTS quizzes (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id               INT UNSIGNED DEFAULT NULL,
  instructor_id           INT UNSIGNED NOT NULL,
  class_id                INT UNSIGNED DEFAULT NULL,
  title                   VARCHAR(255) NOT NULL,
  description             TEXT         DEFAULT NULL,
  duration_seconds        INT UNSIGNED DEFAULT 1800,
  total_marks             INT UNSIGNED DEFAULT 100,
  pass_percentage         TINYINT UNSIGNED DEFAULT 60,
  max_attempts            TINYINT UNSIGNED DEFAULT 1,
  shuffle_questions       TINYINT(1)   NOT NULL DEFAULT 0,
  shuffle_options         TINYINT(1)   NOT NULL DEFAULT 0,
  show_result_immediately TINYINT(1)   NOT NULL DEFAULT 1,
  scheduled_at            DATETIME     DEFAULT NULL,
  deadline_at             DATETIME     DEFAULT NULL,
  status                  ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)     REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (instructor_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (class_id)      REFERENCES classes(id) ON DELETE SET NULL,
  INDEX idx_course_id (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_questions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id     INT UNSIGNED NOT NULL,
  question    TEXT         NOT NULL,
  type        ENUM('single','multiple','true_false','short','essay','fillblank') NOT NULL DEFAULT 'single',
  marks       INT UNSIGNED NOT NULL DEFAULT 1,
  image_url   VARCHAR(500) DEFAULT NULL,
  explanation TEXT         DEFAULT NULL,
  order_index INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  INDEX idx_quiz_id (quiz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_options (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id INT UNSIGNED NOT NULL,
  text        TEXT         NOT NULL,
  image_url   VARCHAR(500) DEFAULT NULL,
  is_correct  TINYINT(1)   NOT NULL DEFAULT 0,
  order_index INT UNSIGNED NOT NULL DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  INDEX idx_question_id (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS question_bank (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT UNSIGNED NOT NULL,
  question      TEXT         NOT NULL,
  type          ENUM('single','multiple','true_false','short','essay','fillblank') NOT NULL DEFAULT 'single',
  marks         INT UNSIGNED NOT NULL DEFAULT 1,
  subject       VARCHAR(255) DEFAULT NULL,
  topic         VARCHAR(255) DEFAULT NULL,
  explanation   TEXT         DEFAULT NULL,
  options       JSON         DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_instructor_id (instructor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  quiz_id         INT UNSIGNED NOT NULL,
  student_id      INT UNSIGNED NOT NULL,
  score           DECIMAL(6,2) DEFAULT NULL,
  total_marks     INT UNSIGNED DEFAULT NULL,
  total_questions INT UNSIGNED DEFAULT NULL,
  percentage      DECIMAL(5,2) DEFAULT NULL,
  passed          TINYINT(1)   DEFAULT NULL,
  time_taken      INT          DEFAULT NULL,
  started_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at    DATETIME     DEFAULT NULL,
  FOREIGN KEY (quiz_id)    REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_student_id (student_id),
  INDEX idx_quiz_id    (quiz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS quiz_answers (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attempt_id         INT UNSIGNED NOT NULL,
  question_id        INT UNSIGNED NOT NULL,
  selected_option_id INT UNSIGNED DEFAULT NULL,
  text_answer        TEXT         DEFAULT NULL,
  is_correct         TINYINT(1)   DEFAULT NULL,
  marks_awarded      DECIMAL(4,2) DEFAULT NULL,
  FOREIGN KEY (attempt_id)         REFERENCES quiz_attempts(id)  ON DELETE CASCADE,
  FOREIGN KEY (question_id)        REFERENCES quiz_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. LIVE SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS live_sessions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id        INT UNSIGNED DEFAULT NULL,
  instructor_id    INT UNSIGNED NOT NULL,
  class_id         INT UNSIGNED DEFAULT NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT         DEFAULT NULL,
  scheduled_at     DATETIME     NOT NULL,
  duration_minutes INT UNSIGNED DEFAULT 60,
  meeting_link     VARCHAR(500) DEFAULT NULL,
  meeting_id       VARCHAR(255) DEFAULT NULL,
  meeting_password VARCHAR(100) DEFAULT NULL,
  platform         ENUM('jitsi','zoom','gmeet','other') DEFAULT 'jitsi',
  status           ENUM('scheduled','live','ended','cancelled') NOT NULL DEFAULT 'scheduled',
  recording_url    VARCHAR(500) DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)     REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (instructor_id) REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (class_id)      REFERENCES classes(id) ON DELETE SET NULL,
  INDEX idx_instructor_id (instructor_id),
  INDEX idx_scheduled_at  (scheduled_at),
  INDEX idx_status        (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. ATTENDANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id        INT UNSIGNED NOT NULL,
  live_session_id INT UNSIGNED DEFAULT NULL,
  instructor_id   INT UNSIGNED NOT NULL,
  subject         VARCHAR(255) DEFAULT NULL,
  date            DATE         NOT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id)        REFERENCES classes(id)       ON DELETE CASCADE,
  FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (instructor_id)   REFERENCES users(id)         ON DELETE CASCADE,
  INDEX idx_class_id (class_id),
  INDEX idx_date     (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attendance_records (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attendance_session_id INT UNSIGNED NOT NULL,
  student_id            INT UNSIGNED NOT NULL,
  status                ENUM('present','absent','late') NOT NULL DEFAULT 'present',
  marked_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance (attendance_session_id, student_id),
  FOREIGN KEY (attendance_session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)            REFERENCES users(id)               ON DELETE CASCADE,
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  course_id          INT UNSIGNED DEFAULT NULL,
  institute_id       INT UNSIGNED DEFAULT NULL,
  student_fee_id     INT UNSIGNED DEFAULT NULL,
  amount             DECIMAL(10,2) NOT NULL,
  currency           VARCHAR(10)  NOT NULL DEFAULT 'INR',
  gateway            ENUM('razorpay','stripe','manual') NOT NULL DEFAULT 'razorpay',
  gateway_order_id   VARCHAR(255) DEFAULT NULL,
  gateway_payment_id VARCHAR(255) DEFAULT NULL,
  gateway_signature  VARCHAR(500) DEFAULT NULL,
  type               ENUM('course_purchase','subscription','fee','material') NOT NULL,
  status             ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  failure_reason     TEXT         DEFAULT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (course_id)    REFERENCES courses(id)    ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE SET NULL,
  INDEX idx_user_id  (user_id),
  INDEX idx_status   (status),
  INDEX idx_type     (type),
  INDEX idx_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refund_requests (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id  INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  reason      TEXT         NOT NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  admin_note  TEXT         DEFAULT NULL,
  resolved_by INT UNSIGNED DEFAULT NULL,
  resolved_at DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  title          VARCHAR(255) NOT NULL,
  body           TEXT         DEFAULT NULL,
  type           VARCHAR(100) DEFAULT 'general',
  reference_type VARCHAR(100) DEFAULT NULL,
  reference_id   INT UNSIGNED DEFAULT NULL,
  link           VARCHAR(500) DEFAULT NULL,
  is_read        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS announcements (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id    INT UNSIGNED NOT NULL,
  institute_id INT UNSIGNED DEFAULT NULL,
  target_role  ENUM('all','student','instructor','parent','institute') DEFAULT 'all',
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NOT NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)    REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  INDEX idx_institute_id (institute_id),
  INDEX idx_target_role  (target_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS message_rooms (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_one_id INT UNSIGNED NOT NULL,
  user_two_id INT UNSIGNED NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_room (user_one_id, user_two_id),
  FOREIGN KEY (user_one_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_two_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_one (user_one_id),
  INDEX idx_user_two (user_two_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id    INT UNSIGNED NOT NULL,
  sender_id  INT UNSIGNED NOT NULL,
  content    TEXT         NOT NULL,
  file_url   VARCHAR(500) DEFAULT NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id)   REFERENCES message_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id)         ON DELETE CASCADE,
  INDEX idx_room_id   (room_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 13. DISCUSSION FORUM
-- ============================================================

CREATE TABLE IF NOT EXISTS discussion_posts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id       INT UNSIGNED NOT NULL,
  video_id        INT UNSIGNED DEFAULT NULL,
  student_id      INT UNSIGNED NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT         NOT NULL,
  video_timestamp INT          DEFAULT NULL,
  is_resolved     TINYINT(1)   NOT NULL DEFAULT 0,
  is_pinned       TINYINT(1)   NOT NULL DEFAULT 0,
  is_locked       TINYINT(1)   NOT NULL DEFAULT 0,
  upvotes         INT UNSIGNED NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)  REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id)   REFERENCES videos(id)  ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES users(id)   ON DELETE CASCADE,
  INDEX idx_course_id  (course_id),
  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS discussion_replies (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  body       TEXT         NOT NULL,
  file_url   VARCHAR(500) DEFAULT NULL,
  upvotes    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES discussion_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)            ON DELETE CASCADE,
  INDEX idx_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_upvotes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id    INT UNSIGNED DEFAULT NULL,
  reply_id   INT UNSIGNED DEFAULT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_post_upvote  (post_id, user_id),
  UNIQUE KEY uq_reply_upvote (reply_id, user_id),
  FOREIGN KEY (post_id)  REFERENCES discussion_posts(id)   ON DELETE CASCADE,
  FOREIGN KEY (reply_id) REFERENCES discussion_replies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)              ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 14. CERTIFICATES
-- ============================================================

CREATE TABLE IF NOT EXISTS certificate_templates (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id  INT UNSIGNED DEFAULT NULL,
  name          VARCHAR(255) NOT NULL,
  template_html LONGTEXT     NOT NULL,
  is_default    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS certificates (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id       INT UNSIGNED NOT NULL,
  course_id        INT UNSIGNED DEFAULT NULL,
  institute_id     INT UNSIGNED DEFAULT NULL,
  template_id      INT UNSIGNED DEFAULT NULL,
  title            VARCHAR(255) NOT NULL,
  certificate_code VARCHAR(100) NOT NULL UNIQUE,
  issued_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  file_url         VARCHAR(500) DEFAULT NULL,
  type             ENUM('course_completion','transfer','bonafide','participation') NOT NULL DEFAULT 'course_completion',
  FOREIGN KEY (student_id)   REFERENCES users(id)                 ON DELETE CASCADE,
  FOREIGN KEY (course_id)    REFERENCES courses(id)               ON DELETE SET NULL,
  FOREIGN KEY (institute_id) REFERENCES institutes(id)            ON DELETE SET NULL,
  FOREIGN KEY (template_id)  REFERENCES certificate_templates(id) ON DELETE SET NULL,
  INDEX idx_student_id       (student_id),
  INDEX idx_certificate_code (certificate_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 15. STUDY MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS study_materials (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  instructor_id  INT UNSIGNED NOT NULL,
  institute_id   INT UNSIGNED DEFAULT NULL,
  class_id       INT UNSIGNED DEFAULT NULL,
  title          VARCHAR(255) NOT NULL,
  description    TEXT         DEFAULT NULL,
  subject        VARCHAR(255) DEFAULT NULL,
  category       VARCHAR(100) DEFAULT NULL,
  level          VARCHAR(50)  DEFAULT NULL,
  type           ENUM('notes','question_paper','study_guide','assignment','other') NOT NULL DEFAULT 'notes',
  price          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_free        TINYINT(1)   NOT NULL DEFAULT 1,
  file_url       VARCHAR(500) DEFAULT NULL,
  file_name      VARCHAR(255) DEFAULT NULL,
  file_size      BIGINT       DEFAULT NULL,
  preview_url    VARCHAR(500) DEFAULT NULL,
  thumbnail_url  VARCHAR(500) DEFAULT NULL,
  pages          INT UNSIGNED DEFAULT NULL,
  language       VARCHAR(50)  DEFAULT 'English',
  tags           TEXT         DEFAULT NULL,
  status         ENUM('draft','published','archived') NOT NULL DEFAULT 'published',
  download_count INT UNSIGNED DEFAULT 0,
  purchase_count INT UNSIGNED DEFAULT 0,
  avg_rating     DECIMAL(3,2) DEFAULT 0.00,
  total_ratings  INT UNSIGNED DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (institute_id)  REFERENCES institutes(id) ON DELETE SET NULL,
  FOREIGN KEY (class_id)      REFERENCES classes(id)    ON DELETE SET NULL,
  INDEX idx_instructor (instructor_id),
  INDEX idx_status     (status),
  INDEX idx_type       (type),
  FULLTEXT INDEX ft_search (title, description, subject, tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS material_purchases (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id    INT UNSIGNED NOT NULL,
  student_id     INT UNSIGNED NOT NULL,
  amount_paid    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_id     VARCHAR(255) DEFAULT NULL,
  payment_status ENUM('pending','success','failed','refunded') NOT NULL DEFAULT 'pending',
  purchased_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_purchase (material_id, student_id),
  FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)  REFERENCES users(id)           ON DELETE CASCADE,
  INDEX idx_student_id  (student_id),
  INDEX idx_material_id (material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS material_reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  material_id INT UNSIGNED NOT NULL,
  student_id  INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT         DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review (material_id, student_id),
  FOREIGN KEY (material_id) REFERENCES study_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id)  REFERENCES users(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 16. SUPPORT SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  description TEXT         NOT NULL,
  category    VARCHAR(100) DEFAULT 'general',
  priority    ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status      ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  assigned_to INT UNSIGNED DEFAULT NULL,
  resolved_at DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id  (user_id),
  INDEX idx_status   (status),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_replies (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id   INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  message     TEXT         NOT NULL,
  is_internal TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)   REFERENCES users(id)           ON DELETE CASCADE,
  INDEX idx_ticket_id (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 17. PLATFORM SETTINGS & FLAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key`      VARCHAR(100) NOT NULL UNIQUE,
  value      TEXT         DEFAULT NULL,
  type       ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  category   VARCHAR(100) DEFAULT 'general',
  updated_by INT UNSIGNED DEFAULT NULL,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feature_flags (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL UNIQUE,
  is_enabled   TINYINT(1)   NOT NULL DEFAULT 1,
  description  TEXT         DEFAULT NULL,
  updated_by   INT UNSIGNED DEFAULT NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 18. AUDIT LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED DEFAULT NULL,
  action         VARCHAR(100) NOT NULL,
  reference_type VARCHAR(100) DEFAULT NULL,
  reference_id   INT UNSIGNED DEFAULT NULL,
  old_value      JSON         DEFAULT NULL,
  new_value      JSON         DEFAULT NULL,
  ip_address     VARCHAR(45)  DEFAULT NULL,
  user_agent     TEXT         DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action  (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 19. PARENT-TEACHER MEETINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS ptm_meetings (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id INT UNSIGNED NOT NULL,
  teacher_id   INT UNSIGNED NOT NULL,
  parent_id    INT UNSIGNED NOT NULL,
  student_id   INT UNSIGNED NOT NULL,
  scheduled_at DATETIME     NOT NULL,
  duration_min INT UNSIGNED DEFAULT 30,
  meeting_link VARCHAR(500) DEFAULT NULL,
  status       ENUM('requested','confirmed','completed','cancelled') NOT NULL DEFAULT 'requested',
  notes        TEXT         DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id)   REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (parent_id)    REFERENCES users(id)      ON DELETE CASCADE,
  FOREIGN KEY (student_id)   REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_teacher_id (teacher_id),
  INDEX idx_parent_id  (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 20. DEFAULT PLATFORM SETTINGS SEED
-- ============================================================

INSERT IGNORE INTO platform_settings (`key`, value, type, category) VALUES
('platform_name',         'EduVerse',                              'string',  'branding'),
('platform_tagline',      'Every Stage. Every Learner.',           'string',  'branding'),
('platform_logo_url',     '',                                      'string',  'branding'),
('primary_color',         '#1A56DB',                              'string',  'branding'),
('commission_rate',       '10',                                    'number',  'revenue'),
('attendance_threshold',  '75',                                    'number',  'academic'),
('maintenance_mode',      '0',                                     'boolean', 'system'),
('maintenance_message',   'We are under maintenance. Please check back soon.', 'string', 'system'),
('max_file_size_mb',      '50',                                    'number',  'uploads'),
('smtp_from_name',        'EduVerse',                              'string',  'email'),
('razorpay_mode',         'test',                                  'string',  'payments'),
('certificate_auto_issue','1',                                     'boolean', 'academic');

INSERT IGNORE INTO feature_flags (feature_name, is_enabled, description) VALUES
('marketplace',       1, 'Public course marketplace'),
('live_sessions',     1, 'Live class sessions via Jitsi/Zoom'),
('discussion_forum',  1, 'Course discussion forums'),
('parent_portal',     1, 'Parent monitoring portal'),
('institute_portal',  1, 'Institute management portal'),
('payments',          1, 'Online payment gateway'),
('certificates',      1, 'Auto-generate certificates on completion'),
('video_notes',       1, 'Student video notes and bookmarks'),
('study_materials',   1, 'Study materials marketplace'),
('announcements',     1, 'Platform-wide announcements');