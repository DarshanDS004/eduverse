# `discussions_routes.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/discussions/`  
> **File path:** `modules/discussions/discussions.routes.js`  
> **File type:** Route Handler (Express Router)

---

## 1. FILE OVERVIEW

**File name:** `discussions_routes.js`  
**File type:** Route / Inline Controller (hybrid — no separate controller layer)  
**Purpose:** Defines all HTTP API endpoints for the Discussion Forum feature of EduVerse. It handles creating posts, reading posts, posting replies, upvoting, pinning, resolving, and deleting discussion content scoped to a specific course.

---

## 2. RESPONSIBILITY

This file owns the complete HTTP interface for the discussion forum module. Unlike most modules in EduVerse that follow a controller→service separation, this file is self-contained — it embeds all database queries directly inside route handlers (inline controller style). Its responsibilities include:

- Listing all discussion posts for a given course
- Creating new discussion posts
- Listing replies on a post
- Creating replies (with automatic notification to the post author)
- Upvoting posts
- Marking posts as resolved (by the original author)
- Pinning posts (restricted to instructors/institutes)
- Deleting posts (restricted to privileged roles)

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework; used to create the router |
| `router` | `express.Router()` | Creates an isolated Express router instance |
| `db` | `../../config/db` | MySQL connection pool; used for all database queries |
| `protect` | `../auth/auth.middleware` | Authentication middleware; attaches `req.user` from JWT |
| `restrictTo` | `../auth/auth.middleware` | Authorization middleware; restricts routes to specific roles |
| `sendSuccess` | `../../shared/errorHandler` | Utility to send standardized success HTTP responses |
| `sendError` | `../../shared/errorHandler` | Utility to send standardized error HTTP responses |

---

## 4. CORE LOGIC BREAKDOWN

### Global Middleware
```js
router.use(protect);
```
Every route in this file requires authentication. `protect` runs first on every request, verifies the JWT, and populates `req.user` with the authenticated user's data (including `id` and `role`).

### Pattern
All route handlers follow this pattern:
1. `try/catch` wraps all logic.
2. Database queries use parameterized `db.query(sql, [params])` to prevent SQL injection.
3. On success → `sendSuccess(res, statusCode, message, data)`
4. On failure → `next(e)` propagates to the global error handler.

---

## 5. FUNCTIONS / METHODS (Route Handlers)

### `GET /course/:courseId`
**Purpose:** Fetch all discussion posts for a specific course, ordered by pinned status then date.  
**Auth:** Any authenticated user.  
**Parameters:** `courseId` (route param)  
**Query:**
- Joins `discussion_posts` → `users` → `user_profiles` → `videos` (optional)
- Subquery counts replies per post
- Orders: pinned posts first (`is_pinned DESC`), then newest first  

**Response:**
```json
[{ "id": 1, "title": "...", "body": "...", "is_pinned": 1, "reply_count": 5, "author_name": "..." }]
```

---

### `POST /course/:courseId`
**Purpose:** Create a new discussion post under a course.  
**Auth:** Any authenticated user.  
**Body:**
```json
{ "title": "string (required)", "body": "string (required)", "video_id": "optional", "video_timestamp": "optional" }
```
**Validation:** Returns `400 MISSING_FIELDS` if `title` or `body` is absent.  
**Database:** Inserts into `discussion_posts` with `student_id = req.user.id`.  
**Response:** `{ "id": insertId }` with HTTP 201.

---

### `GET /posts/:postId/replies`
**Purpose:** Fetch all replies for a given discussion post in ascending creation order.  
**Auth:** Any authenticated user.  
**Parameters:** `postId` (route param)  
**Response:**
```json
[{ "id": 1, "body": "...", "author_name": "...", "role": "student", "created_at": "..." }]
```

---

### `POST /posts/:postId/replies`
**Purpose:** Add a reply to a post and notify the post author.  
**Auth:** Any authenticated user.  
**Body:** `{ "body": "string (required)" }`  
**Validation:** Returns `400 MISSING_FIELDS` if `body` is absent.  
**Logic:**
1. Insert reply into `discussion_replies`.
2. Fetch original post's author (`student_id`, `title`).
3. If the replier is **not** the post author, insert a notification into the `notifications` table for the post author, including the replier's full name.

**Edge Case:** No notification is created if a user replies to their own post (`post.student_id !== req.user.id` check).  
**Response:** `{ "id": insertId }` with HTTP 201.

---

### `POST /posts/:postId/upvote`
**Purpose:** Upvote a post (idempotent — no error on double-upvote).  
**Auth:** Any authenticated user.  
**Logic:**
1. `INSERT IGNORE INTO post_upvotes` — silently ignores duplicate upvotes due to unique constraint.
2. Recalculates upvote count via subquery and updates `discussion_posts.upvotes`.

**Edge Case:** `INSERT IGNORE` ensures the endpoint is idempotent — calling it multiple times will not throw an error or inflate the count.

---

### `PATCH /posts/:postId/resolve`
**Purpose:** Mark a post as resolved. Only the original author can resolve their own post.  
**Auth:** Any authenticated user.  
**Logic:** `UPDATE discussion_posts SET is_resolved = 1 WHERE id = ? AND student_id = ?` — the `student_id = req.user.id` condition silently prevents other users from resolving someone else's post.

---

### `PATCH /posts/:postId/pin`
**Purpose:** Pin a post so it appears at the top of the course discussion feed.  
**Auth:** `instructor` or `institute` roles only (enforced by `restrictTo`).  
**Logic:** Simple UPDATE setting `is_pinned = 1`.

---

### `DELETE /posts/:postId`
**Purpose:** Delete a discussion post.  
**Auth:** `instructor`, `institute`, or `superadmin` roles only.  
**Logic:** Hard delete from `discussion_posts`. Cascades to replies depend on DB foreign key setup.

---

## 6. API ROLE

**Base path (assumed):** `/api/v1/discussions`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/course/:courseId` | Any | List all posts for a course |
| POST | `/course/:courseId` | Any | Create a post |
| GET | `/posts/:postId/replies` | Any | List replies on a post |
| POST | `/posts/:postId/replies` | Any | Add a reply (notifies author) |
| POST | `/posts/:postId/upvote` | Any | Upvote a post |
| PATCH | `/posts/:postId/resolve` | Author only (logic) | Resolve a post |
| PATCH | `/posts/:postId/pin` | instructor, institute | Pin a post |
| DELETE | `/posts/:postId` | instructor, institute, superadmin | Delete a post |

---

## 7. DATA FLOW

```
Client Request
    ↓
protect (JWT verification → req.user populated)
    ↓
[optional] restrictTo (role check)
    ↓
Route handler
    ↓
db.query (parameterized SQL)
    ↓
sendSuccess / sendError / next(err)
    ↓
Client Response
```

---

## 8. CONNECTIONS

**Files that use this file:**
- Main app entry (e.g., `app.js` or `server.js`) mounts this router at a path like `/api/v1/discussions`.

**Files this file depends on:**
- `../../config/db` — Database connection
- `../auth/auth.middleware` — `protect`, `restrictTo`
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

---

## 9. MIDDLEWARE / AUTH

| Middleware | Scope | Behavior |
|---|---|---|
| `protect` | All routes | Verifies JWT, populates `req.user` |
| `restrictTo('instructor', 'institute')` | PATCH `/pin` | Rejects non-matching roles with 403 |
| `restrictTo('instructor', 'institute', 'superadmin')` | DELETE `/posts/:postId` | Rejects non-matching roles with 403 |

**Soft authorization** (no middleware, just SQL logic):  
- `PATCH /resolve` — only updates if `student_id = req.user.id` in the WHERE clause. A foreign author's request silently does nothing (no 403 thrown).

---

## 10. ERROR HANDLING

| Situation | Response |
|---|---|
| Missing `title` or `body` on post creation | `400 MISSING_FIELDS` |
| Missing `body` on reply creation | `400 MISSING_FIELDS` |
| Any database/unexpected error | Passed to `next(e)` → global error handler |
| Unauthorized role on pin/delete | `restrictTo` returns `403` before handler runs |

---

## 11. EXAMPLE USAGE

**Create a discussion post:**
```http
POST /api/v1/discussions/course/42
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "What is backpropagation?",
  "body": "I'm confused about how gradients flow backwards...",
  "video_id": 7,
  "video_timestamp": 134
}
```

**Reply to a post:**
```http
POST /api/v1/discussions/posts/15/replies
Authorization: Bearer <token>
Content-Type: application/json

{ "body": "Backpropagation uses the chain rule to..." }
```

---

## 12. EDGE CASES / NOTES

- **Inline DB pattern:** Unlike other modules in this project, this file has no separate controller or service. All DB logic lives directly in the route callbacks.
- **Upvote idempotency:** `INSERT IGNORE` prevents errors on repeat upvotes. The count is always recalculated from the table, not incremented, ensuring accuracy.
- **Silent self-resolve guard:** The resolve endpoint does not throw a 403 if a non-author tries to resolve — the SQL `WHERE student_id = ?` silently no-ops. This means the response will still say "Post marked as resolved" even if nothing was changed.
- **No reply deletion:** There is no endpoint to delete individual replies — only entire posts can be deleted.
- **Notification system:** Reply notifications are fire-and-forget inside the route. If the notification insert fails, the error would propagate and roll back the reply. This could be improved with background job handling.

---

## 13. SUMMARY

`discussions_routes.js` is the sole HTTP interface for EduVerse's discussion forum module. It provides 8 endpoints covering full CRUD for posts and replies, upvoting, pinning, and resolution. Authentication is enforced globally via `protect`, with role-based restrictions on moderation actions. It uses an inline pattern (no separate controller/service), directly querying MySQL via `db.query`. Notification side-effects are handled inline when a reply is posted.
