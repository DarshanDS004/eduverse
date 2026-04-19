# schema.sql — EduVerse Database Schema

## Overview

`schema.sql` is the complete MySQL database schema for **EduVerse**, an e-learning and institute management platform (v3.0). It creates and seeds a single database (`eduverse_db`) with all tables, indexes, foreign keys, and default configuration data needed to run the platform.

## Database

| Property       | Value               |
|----------------|---------------------|
| Database name  | `eduverse_db`       |
| Character set  | `utf8mb4`           |
| Collation      | `utf8mb4_unicode_ci`|
| Engine         | InnoDB              |

## Supported Roles

The schema is built around five user roles:

- **SuperAdmin** — platform-level management
- **Institute** — school / college / coaching centre administration
- **Instructor** — course creators and teachers
- **Student** — learners
- **Parent** — guardian monitoring portal

---

## Schema Sections

### 1. Core User Tables
| Table | Purpose |
|---|---|
| `users` | Master user accounts with role, active/verified flags |
| `user_profiles` | Extended profile info (photo, bio, grade, qualification, etc.) |
| `email_verifications` | One-time email verification tokens |
| `password_resets` | Password reset tokens with expiry |
| `refresh_tokens` | JWT refresh token store |

### 2. Institute Management
| Table | Purpose |
|---|---|
| `institutes` | Institute records with subscription plan, approval status |
| `institute_members` | Links users to institutes with roles (owner, sub_admin, teacher, student) |
| `academic_years` | Academic year periods per institute |
| `classes` | Class/grade records under an institute |
| `class_students` | Student enrollment in classes with roll numbers |
| `class_teachers` | Teacher-subject assignments per class |
| `timetable` | Weekly schedule entries per class |
| `academic_calendar` | Events, holidays, exams, PTM dates per institute |

### 3. Fee Management
| Table | Purpose |
|---|---|
| `fee_structures` | Fee types (tuition, exam, library, etc.) with amounts |
| `student_fees` | Per-student fee payment records with status and receipts |

### 4. Parent–Student Linking
| Table | Purpose |
|---|---|
| `parent_students` | Maps parents to their children with relation type |

### 5. Courses
| Table | Purpose |
|---|---|
| `courses` | Course metadata: title, category, level, price, status |
| `course_modules` | Ordered modules within a course |
| `videos` | Video lessons within modules |
| `video_resources` | Downloadable attachments per video |
| `video_captions` | Subtitle/caption files per video |
| `enrollments` | Student–course enrollment with payment info |
| `course_progress` | Per-student completion percentage per course |
| `video_progress` | Per-student watch progress per video |
| `video_notes` | Timestamped notes students create while watching |
| `video_bookmarks` | Timestamped bookmarks per video |
| `course_reviews` | 1–5 star ratings with review text |
| `wishlist` | Saved courses per student |
| `coupons` | Discount codes (percentage or flat) for courses |

### 6. Assignments
Assignments linked to courses, with student submissions and grading.

### 7. Quizzes
| Table | Purpose |
|---|---|
| `quizzes` | Quiz metadata with time limit and pass marks |
| `quiz_questions` | Individual questions with type (MCQ, true/false, text) |
| `quiz_options` | Answer options per question |
| `quiz_attempts` | Student attempt records with score and pass/fail |
| `quiz_answers` | Per-question answer selections per attempt |

### 8. Live Sessions
| Table | Purpose |
|---|---|
| `live_sessions` | Scheduled live classes with platform (Jitsi/Zoom/Meet), status, recording URL |

### 9. Attendance
| Table | Purpose |
|---|---|
| `attendance_sessions` | A single attendance-taking event (class + date) |
| `attendance_records` | Per-student present/absent/late status |

### 10. Payments
| Table | Purpose |
|---|---|
| `payments` | Payment transactions via Razorpay, Stripe, or manual |
| `refund_requests` | Student refund requests with admin resolution |

### 11. Notifications & Announcements
| Table | Purpose |
|---|---|
| `notifications` | Per-user in-app notifications |
| `announcements` | Broadcast messages to role-targeted groups |

### 12. Messaging
| Table | Purpose |
|---|---|
| `message_rooms` | One-to-one chat rooms between two users |
| `messages` | Individual messages within a room |

### 13. Discussion Forum
| Table | Purpose |
|---|---|
| `discussion_posts` | Course-linked forum posts, optionally timestamped to a video |
| `discussion_replies` | Replies to posts |
| `post_upvotes` | Upvotes on posts and replies |

### 14. Certificates
| Table | Purpose |
|---|---|
| `certificate_templates` | HTML templates for certificates |
| `certificates` | Issued certificates with unique code and file URL |

### 15. Study Materials
| Table | Purpose |
|---|---|
| `study_materials` | Uploadable notes, question papers, guides with pricing |
| `material_purchases` | Student purchase records for paid materials |
| `material_reviews` | Ratings and reviews on materials |

### 16. Support System
| Table | Purpose |
|---|---|
| `support_tickets` | Help desk tickets with priority and status |
| `ticket_replies` | Threaded replies on tickets (internal or public) |

### 17. Platform Settings & Feature Flags
| Table | Purpose |
|---|---|
| `platform_settings` | Key-value config (branding, payments, uploads, etc.) |
| `feature_flags` | Toggle features on/off (marketplace, live sessions, etc.) |

### 18. Audit Logs
| Table | Purpose |
|---|---|
| `audit_logs` | Tracks all user actions with old/new values (JSON), IP, user agent |

### 19. Parent–Teacher Meetings
| Table | Purpose |
|---|---|
| `ptm_meetings` | Scheduled PTM meetings with status and video link |

### 20. Seed Data
Default `platform_settings` (branding, payments, academic thresholds) and `feature_flags` (marketplace, live sessions, certificates, etc.) are inserted via `INSERT IGNORE`.

---

## Key Design Patterns

- All tables use `InnoDB` for foreign key support and transactions.
- Soft deletion is handled via `is_active` / `status` flags rather than hard deletes.
- JSON columns (`notif_prefs`, `old_value`, `new_value`, `options`) are used for flexible, schema-less data.
- `FULLTEXT` indexes on `courses` and `study_materials` enable full-text search by title, description, and tags.
- Unique composite keys prevent duplicate enrollments, reviews, and attendance entries.

## How to Run

```bash
mysql -u root -p < schema.sql
```

Or paste the file contents into any MySQL-compatible client (MySQL Workbench, TablePlus, phpMyAdmin).

## Requirements

- MySQL 5.7+ or MariaDB 10.3+ (for `JSON` column support and `FULLTEXT` on InnoDB)
- Sufficient privileges to `CREATE DATABASE` and `CREATE TABLE`
