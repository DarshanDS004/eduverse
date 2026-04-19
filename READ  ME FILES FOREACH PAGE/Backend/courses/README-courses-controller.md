# courses.controller.js — Courses Controller

## Overview

`courses.controller.js` contains all **Express request handlers** for the Courses module. It handles requests from three types of users: public visitors, authenticated students, and instructors. Each handler validates the request, delegates business logic to `courses.service.js`, and returns a standardized JSON response.

**File path:** `backend/modules/courses/courses.controller.js`

---

## Handler Groups

### Public Handlers

#### `listCourses(req, res, next)`
- **Route:** `GET /api/v1/courses`
- **Query params forwarded to service:** `page`, `limit`, `category`, `search`, `level`, `minPrice`, `maxPrice`, `sortBy`, `instructor_id`, `price`
- **Returns:** Paginated list of published courses with instructor info and total video count.

#### `getCategories(req, res, next)`
- **Route:** `GET /api/v1/courses/categories`
- **Returns:** Array of category names, slugs, and course counts.

#### `getCourse(req, res, next)`
- **Routes:** `GET /api/v1/courses/:id`, `HEAD /api/v1/courses/:id`, `GET /api/v1/courses/:id/reviews`
- **Auth:** Optional — `req.user` is populated by `optionalAuth` if a token is present
- **Returns:**
  - If unauthenticated: course data with `video_url = null` for non-preview lessons
  - If enrolled student: full course data including `video_url` for all lessons
  - If course instructor: full course data (can view own draft courses)
  - If course not found: `404` with code `COURSE_NOT_FOUND`

---

### Student Handlers

#### `enroll(req, res, next)`
- **Route:** `POST /api/v1/courses/:id/enroll`
- **Auth:** `protect` + `restrictTo('student')`
- **Behavior:**
  - Free course → direct enrollment, returns `201` with `enrolled: true`
  - Paid course → returns `200` with `requires_payment: true` and `payment_url`
  - Already enrolled → service throws `409` with `ALREADY_ENROLLED`

#### `submitReview(req, res, next)`
- **Route:** `POST /api/v1/courses/:id/reviews`
- **Body:** `{ rating: 1-5, review_text?: string }`
- **Validation (controller level):**
  - `rating` must be a valid integer between 1 and 5
  - Returns `400` with code `INVALID_RATING` if invalid
- **Auth:** `protect` + `restrictTo('student')`
- **Behavior:** Inserts or updates (upserts) the student's review; recalculates course `avg_rating` and `total_ratings`.

#### `getWishlist(req, res, next)`
- **Route:** `GET /api/v1/courses/wishlist`
- **Auth:** `protect` + `restrictTo('student')`
- **Returns:** Array of wishlisted courses for the current student.

#### `toggleWishlist(req, res, next)`
- **Route:** `POST /api/v1/courses/:id/wishlist`
- **Auth:** `protect` + `restrictTo('student')`
- **Behavior:** Adds the course if not in wishlist; removes it if already present. Response message reflects the action taken.

---

### Instructor Handlers

#### `getInstructorCourses(req, res, next)`
- **Route:** `GET /api/v1/courses/instructor/my-courses`
- **Auth:** `protect` + `restrictTo('instructor')`
- **Returns:** All courses for the logged-in instructor including drafts, with filters from `req.query`.

#### `createCourse(req, res, next)`
- **Route:** `POST /api/v1/courses`
- **Auth:** `protect` + `restrictTo('instructor')`
- **Body:** `{ title, description, category_id, price, level, thumbnail?, sections? }`
- **Validation:**
  - `title` is required — returns `400` with `MISSING_TITLE` if empty
  - `category_id` is required — returns `400` with `MISSING_CATEGORY` if missing
- **Returns:** `201` + new course object. Course starts as `draft`.

#### `updateCourse(req, res, next)`
- **Routes:** `PUT /api/v1/courses/:id`, `PATCH /api/v1/courses/:id`
- **Auth:** `protect` + `restrictTo('instructor')`
- **Behavior:**
  1. Calls `service.isCourseOwnedBy(courseId, userId)` — returns `403` if not the owner
  2. Filters allowed fields: `title`, `description`, `category_id`, `price`, `level`, `thumbnail`, `sections`, `tags`, `requirements`, `objectives`, `language`
  3. Validates `title` is not empty if provided
  4. Validates `price` is a non-negative number if provided
- **Note:** This handler was missing and was the root cause of `"Unexpected end of JSON input"` errors from the course builder frontend.

#### `saveDraft(req, res, next)`
- **Route:** `POST /api/v1/courses/:id/save-draft`
- **Auth:** `protect` + `restrictTo('instructor')`
- **Behavior:** Same as `updateCourse` but forces `status = 'draft'` regardless of the request body. Use this for the "Save" button in the course builder.

#### `publishCourse(req, res, next)`
- **Route:** `POST /api/v1/courses/:id/publish`
- **Auth:** `protect` + `restrictTo('instructor')`
- **Behavior:**
  1. Verifies ownership — returns `403` if not the owner
  2. Delegates to `service.publishCourse()` which validates ≥1 module and ≥1 lesson exist
  3. Sets course status to `published` on success

#### `deleteCourse(req, res, next)`
- **Route:** `DELETE /api/v1/courses/:id`
- **Auth:** `protect` + `restrictTo('instructor')`
- **Behavior:**
  1. Verifies ownership — returns `403` if not the owner
  2. Delegates to `service.deleteCourse()`

---

### Super Admin Handlers

#### `adminListCourses(req, res, next)`
- **Route:** `GET /api/v1/courses/admin/all`
- **Auth:** `protect` + `restrictTo('superadmin', 'admin')`
- **Returns:** All courses from all instructors with admin-level filters from `req.query`.

#### `adminDeleteCourse(req, res, next)`
- **Route:** `DELETE /api/v1/courses/admin/:id`
- **Auth:** `protect` + `restrictTo('superadmin', 'admin')`
- **Behavior:** Calls `service.deleteCourse(id, null, { force: true })` — bypasses ownership check.

---

## Ownership Verification Pattern

Instructor and student handlers perform an ownership check before any mutation using `service.isCourseOwnedBy()`:

```js
const owned = await service.isCourseOwnedBy(courseId, req.user.id);
if (!owned) {
  return sendError(res, 403, 'You do not have permission to edit this course.', 'FORBIDDEN');
}
```

This is a lightweight single-column query that avoids fetching the full course just to verify access.

---

## Response Format

All responses use shared `sendSuccess` / `sendError` helpers:

**Success (200):**
```json
{ "success": true, "message": "Course updated successfully.", "data": { ... } }
```

**Created (201):**
```json
{ "success": true, "message": "Course created successfully.", "data": { "id": 12, ... } }
```

**Error (403):**
```json
{ "success": false, "message": "You do not have permission to edit this course.", "code": "FORBIDDEN" }
```

---

## Key Bug Fix

The `updateCourse` (PUT/PATCH) and `saveDraft` handlers were **missing** in the previous version. The course builder's "Save" button was sending `PUT /api/v1/courses/:id` to a route that didn't exist. The 404 handler returned an HTML page, which the frontend's `response.json()` call failed to parse, resulting in:

```
Unexpected end of JSON input
```

Adding these handlers resolved the issue.

---

## Dependencies

| Import | Purpose |
|---|---|
| `./courses.service` | All business logic and database queries |
| `../../shared/errorHandler` | `sendSuccess`, `sendError` |
