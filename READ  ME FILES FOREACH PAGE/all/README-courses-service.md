# courses.service.js — Courses Service

## Overview

`courses.service.js` contains all **database queries and business logic** for the public Courses module. It is called by `courses.controller.js` and handles course catalog browsing, enrollment, reviews, wishlist management, and admin-level course operations. It has no access to `req`/`res`.

**File path:** `backend/modules/courses/courses.service.js`

---

## Architecture

- All functions are `async` and throw `AppError` for business rule violations
- All SQL queries use parameterized placeholders — no string concatenation
- Full-text search is handled via MySQL `FULLTEXT` index with `BOOLEAN MODE`
- Access control (enrolled vs unauthenticated) is implemented at the query level using a `CASE` expression in the video SELECT

---

## Function Reference

### `listCourses(filters)`

Fetches a paginated list of **published** courses with filtering and sorting.

**Accepted filters:**

| Filter | SQL Applied |
|---|---|
| `q` | `MATCH(title, description, tags) AGAINST(? IN BOOLEAN MODE)` |
| `category` | `c.category = ?` |
| `level` | `c.level = ?` |
| `price = 'free'` | `c.is_free = 1` |
| `price = 'paid'` | `c.is_free = 0` |
| `instructor_id` | `c.instructor_id = ?` |
| `sort = 'newest'` | `ORDER BY c.created_at DESC` |
| `sort = 'popular'` | `ORDER BY c.enrolled_count DESC` |
| `sort = 'rating'` | `ORDER BY c.avg_rating DESC` |

**Pagination:** `page` (default 1), `per_page` (default 12, max 50)

**Fields returned per course:**
- `id`, `title`, `description`, `thumbnail_url`
- `category`, `level`, `language`
- `price`, `is_free`
- `avg_rating`, `total_ratings`, `enrolled_count`, `enrollment_count`
- `total_duration`, `tags`
- `instructor_name`, `instructor_id` (from `user_profiles` join)
- `total_videos` (sub-query count)

**Returns:**
```json
{
  "courses": [...],
  "pagination": {
    "total": 120,
    "page": 1,
    "per_page": 12,
    "total_pages": 10
  }
}
```

**Bug fixed:** The count query uses the same `params` array as the main query (no double-filter bug from previous version).

---

### `getCourse(courseId, userId)`

Returns full course detail. Access level is determined by whether the requester is the instructor, an enrolled student, or an unauthenticated visitor.

**Access logic:**

| User type | Condition | Video URL returned? |
|---|---|---|
| Course instructor | `userId === course.instructor_id` | ✅ All videos |
| Enrolled student | `enrollments` row exists | ✅ All videos |
| Free preview lesson | `videos.is_preview = 1` | ✅ Always |
| Unauthenticated guest | No match | ❌ `null` |

**SQL CASE expression for video URL:**
```sql
CASE
  WHEN ? = 1 THEN v.video_url   -- full access (enrolled or instructor)
  WHEN v.is_preview = 1 THEN v.video_url  -- free preview always visible
  ELSE NULL
END AS video_url
```

**Course visibility:** Published courses are visible to everyone. Drafts are only visible to the owning instructor (`c.status = 'published' OR c.instructor_id = ?`).

**Returns:**
```json
{
  "id": 5,
  "title": "Complete JavaScript",
  "enrolled": true,
  "is_instructor": false,
  "modules": [
    {
      "id": 1,
      "title": "Getting Started",
      "videos": [
        { "id": 10, "title": "Intro", "video_url": "https://...", "is_preview": 1 }
      ],
      "lessons": [ ... ]
    }
  ],
  "reviews": [...],
  "progress": { "progress": 45.5, "completed_at": null }
}
```

- `modules[].lessons` is an alias of `modules[].videos` for frontend compatibility
- `reviews` returns the last 10 reviews with student name and avatar
- `progress` is only populated if the student is enrolled

---

### `enroll(courseId, studentId)`

Handles course enrollment for a student.

**Logic flow:**

1. Fetches the course; throws `404` if not found or not published
2. Checks for existing enrollment; throws `409` with `ALREADY_ENROLLED` if found
3. If the course is free (`is_free = 1` or `price = 0`):
   - Inserts into `enrollments` with `source = 'free'`
   - Increments `courses.enrolled_count`
   - Creates a `course_progress` row initialised to `0%`
   - Returns `{ success: true, free: true, message: 'Enrolled successfully.' }`
4. If the course is paid:
   - Returns `{ success: false, requires_payment: true, course_id, amount, title, message }`

**Free detection:**
```js
const isFree = course.is_free == 1 || parseFloat(course.price) === 0;
```
This handles the case where `price` is stored as a string `'0'` in the database.

---

### `getCategories()`

Returns a list of categories from published courses with their course counts.

```sql
SELECT category, COUNT(*) AS count
FROM courses
WHERE status = 'published' AND category IS NOT NULL AND category != ''
GROUP BY category
ORDER BY count DESC
```

**Transforms each row into:**
```json
{ "name": "Programming", "slug": "programming", "count": 34 }
```

`slug` is computed as `category.toLowerCase().replace(/\s+/g, '-')`. Handles `null` gracefully via `String(r.category)`.

---

### `submitReview(courseId, studentId, rating, reviewText)`

Upserts a student review for a course.

1. Validates `rating` is an integer between 1 and 5 — throws `400` if invalid
2. Checks the student is enrolled — throws `403` with `NOT_ENROLLED` if not
3. Uses `INSERT ... ON DUPLICATE KEY UPDATE` to upsert the review (unique key: `course_id + student_id`)
4. Recalculates and updates `courses.avg_rating` and `courses.total_ratings` via sub-queries

---

### `getWishlist(studentId)` *(referenced in controller — implemented in service)*

Returns all wishlisted courses for a student, joined with course and instructor data.

---

### `toggleWishlist(courseId, studentId)` *(referenced in controller — implemented in service)*

Checks if the course is already in the wishlist:
- If not present: inserts into `wishlist` table, returns `{ added: true, message: 'Added to wishlist.' }`
- If present: deletes from `wishlist` table, returns `{ added: false, message: 'Removed from wishlist.' }`

---

### `getInstructorCourses(instructorId, filters)` *(referenced in controller)*

Same as `listCourses` but without the `status = 'published'` filter, and scoped to `instructor_id`. Returns all statuses (draft, pending_review, published, archived, rejected).

---

### `updateCourse(courseId, instructorId, updates)` *(referenced in controller)*

Updates allowed fields on a course owned by the instructor. Verifies ownership before updating.

---

### `isCourseOwnedBy(courseId, instructorId)`

Lightweight ownership check used by the controller:

```sql
SELECT id FROM courses WHERE id = ? AND instructor_id = ?
```

Returns `true` if a row is found, `false` otherwise. Used to guard PUT/PATCH/DELETE operations.

---

### `publishCourse(courseId, instructorId)` *(referenced in controller)*

Sets `status = 'published'` after validating:
- At least 1 module exists
- At least 1 lesson/video exists across all modules

---

### `deleteCourse(courseId, instructorId, options?)` *(referenced in controller)*

- If `options.force = true` (admin): skips ownership check
- Otherwise verifies ownership
- Prevents deletion if enrolled students exist (`HAS_ENROLLMENTS`)
- Hard deletes from `courses` table (cascades to modules, videos, enrollments)

---

### `adminListCourses(filters)` *(referenced in controller)*

Same as `listCourses` but without the `status = 'published'` filter and with no `instructor_id` scope restriction.

---

## Error Codes Thrown

| Code | Status | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Course does not exist or is not visible to the user |
| `ALREADY_ENROLLED` | 409 | Student is already enrolled |
| `NOT_ENROLLED` | 403 | Student must be enrolled to leave a review |
| `INVALID_RATING` | 400 | Rating is not an integer between 1 and 5 |

---

## Key Fixes Applied (vs. previous version)

1. **`getCourse`** — instructors can view their own draft courses (not just published)
2. **`getCourse`** — free-preview videos always return `video_url` regardless of enrollment status
3. **`listCourses`** — count query uses the same filter params (no double-filter bug)
4. **`enroll`** — correctly detects `price === '0'` (string from DB) as free
5. **`getCategories`** — `slug` computation is wrapped in `String()` to handle `null` gracefully
6. **`submitReview`** — validates `rating` as integer before database insert
7. All column aliases match what the frontend expects

---

## Dependencies

| Import | Purpose |
|---|---|
| `../../config/db` | MySQL2 connection pool |
| `../../shared/errorHandler` | `AppError` class |

---

## Exported Functions

```js
module.exports = {
  listCourses,
  getCourse,
  enroll,
  getCategories,
  submitReview,
};
```

> Note: `getWishlist`, `toggleWishlist`, `getInstructorCourses`, `updateCourse`, `isCourseOwnedBy`, `publishCourse`, `deleteCourse`, and `adminListCourses` are referenced by the controller and expected to be added to this file's exports.
