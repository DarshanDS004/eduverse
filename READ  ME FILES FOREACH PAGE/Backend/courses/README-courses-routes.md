# courses.routes.js — Courses Routes

## Overview

`courses.routes.js` defines all HTTP routes for the **Courses module** of EduVerse. It serves three audiences: unauthenticated public users browsing the course catalog, authenticated students enrolling and reviewing courses, and instructors managing their own courses. It also includes admin-only endpoints for platform-level course management.

**File path:** `backend/modules/courses/courses.routes.js`  
**Base URL:** `/api/v1/courses`

---

## Middleware

### `protect`
Verifies the JWT and attaches `req.user` to the request. Returns `401` if the token is missing or invalid.

### `restrictTo(...roles)`
Ensures `req.user.role` is in the allowed list. Returns `403` if the user's role doesn't match.

### `optionalAuth` *(defined inline)*
Decodes the JWT if present but **does not reject** requests without a token. Used for course detail pages where enrolled students should see video URLs while unauthenticated visitors see only previews.

```js
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
  } catch (_) { /* invalid token — treat as guest */ }
  next();
}
```

---

## Route Ordering Rule *(Critical)*

Named static path segments (`/wishlist`, `/categories`, `/instructor/my-courses`, `/admin/*`) are declared **before** dynamic `/:id` routes. If this order is violated, Express matches `wishlist` and `categories` as course IDs.

---

## Route Reference

### Public Routes

| Method | Path | Middleware | Handler | Description |
|---|---|---|---|---|
| GET | `/` | — | `listCourses` | Browse published courses with filters and pagination |
| GET | `/categories` | — | `getCategories` | List course categories with course counts |
| GET | `/:id` | `optionalAuth` | `getCourse` | Full course detail; enrolled users receive `video_url` |
| HEAD | `/:id` | `optionalAuth` | `getCourse` | Check if a course exists (no body returned) |
| GET | `/:id/reviews` | `optionalAuth` | `getCourse` | Reviews are embedded in the course detail response |

**listCourses query parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 12, max: 50) |
| `category` | string | Filter by category |
| `search` / `q` | string | Full-text search on title, description, tags |
| `level` | string | Filter by level |
| `minPrice` / `maxPrice` | number | Price range filter |
| `sortBy` / `sort` | string | `newest`, `popular`, `rating` |
| `instructor_id` | number | Filter to a specific instructor's courses |
| `price` | string | `free` or `paid` |

---

### Student Routes

| Method | Path | Middleware | Handler | Description |
|---|---|---|---|---|
| GET | `/wishlist` | `protect`, `restrictTo('student')` | `getWishlist` | List all wishlisted courses |
| POST | `/:id/wishlist` | `protect`, `restrictTo('student')` | `toggleWishlist` | Add to wishlist if absent, remove if present |
| POST | `/:id/enroll` | `protect`, `restrictTo('student')` | `enroll` | Enroll in a free course; returns payment URL for paid |
| POST | `/:id/reviews` | `protect`, `restrictTo('student')` | `submitReview` | Submit or update a 1–5 star review |

**`/wishlist` is declared BEFORE `/:id` routes** to prevent `wishlist` being treated as a course ID.

---

### Instructor Routes

| Method | Path | Middleware | Handler | Description |
|---|---|---|---|---|
| GET | `/instructor/my-courses` | `protect`, `restrictTo('instructor')` | `getInstructorCourses` | All courses by the logged-in instructor (including drafts) |
| POST | `/` | `protect`, `restrictTo('instructor')` | `createCourse` | Create a new course (starts as `draft`) |
| PUT | `/:id` | `protect`, `restrictTo('instructor')` | `updateCourse` | Update course metadata |
| PATCH | `/:id` | `protect`, `restrictTo('instructor')` | `updateCourse` | Same — partial update |
| POST | `/:id/save-draft` | `protect`, `restrictTo('instructor')` | `saveDraft` | Save changes keeping `status = 'draft'` |
| POST | `/:id/publish` | `protect`, `restrictTo('instructor')` | `publishCourse` | Publish after validation |
| DELETE | `/:id` | `protect`, `restrictTo('instructor')` | `deleteCourse` | Delete (ownership verified in controller) |

> **Fix note:** `PUT /:id`, `PATCH /:id`, and `POST /:id/save-draft` were previously missing. Their absence caused the "Save Course" button in `course-builder.html` to hit a 404, which returned HTML that `res.json()` could not parse — producing `"Unexpected end of JSON input"`.

---

### Admin Routes

| Method | Path | Middleware | Handler | Description |
|---|---|---|---|---|
| GET | `/admin/all` | `protect`, `restrictTo('superadmin', 'admin')` | `adminListCourses` | All courses from all instructors |
| DELETE | `/admin/:id` | `protect`, `restrictTo('superadmin', 'admin')` | `adminDeleteCourse` | Force-delete any course regardless of ownership |

**`/admin/*` routes are declared BEFORE `/:id` routes** to prevent `admin` being matched as a course ID.

---

## Response Examples

### `GET /api/v1/courses` — Success
```json
{
  "success": true,
  "message": "Courses fetched.",
  "data": {
    "courses": [ ... ],
    "pagination": {
      "total": 120,
      "page": 1,
      "per_page": 12,
      "total_pages": 10
    }
  }
}
```

### `POST /api/v1/courses/:id/enroll` — Free Course
```json
{ "success": true, "message": "Enrolled successfully.", "data": { "enrolled": true, "free": true } }
```

### `POST /api/v1/courses/:id/enroll` — Paid Course
```json
{
  "success": true,
  "message": "Payment required to enroll.",
  "data": { "requires_payment": true, "amount": 999, "course_id": 5 }
}
```

### `POST /api/v1/courses/:id/reviews` — Validation Error
```json
{ "success": false, "message": "Rating must be between 1 and 5.", "code": "INVALID_RATING" }
```

---

## Dependencies

| Import | Purpose |
|---|---|
| `express` | Router |
| `jsonwebtoken` | Used inline in `optionalAuth` to decode token without blocking |
| `./courses.controller` | All handler functions |
| `../auth/auth.middleware` | `protect`, `restrictTo` |
