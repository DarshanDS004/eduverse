# `notifications_routes.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/notifications/`  
> **File path:** `modules/notifications/notifications.routes.js`  
> **File type:** Route Handler (Express Router — inline controller style)

---

## 1. FILE OVERVIEW

**File name:** `notifications_routes.js`  
**File type:** Route / Inline Controller  
**Purpose:** Provides a standalone, user-agnostic HTTP interface for notification management in EduVerse. Any authenticated user can list, read, and delete their own notifications via this module. It is designed to be mounted at `/api/v1/notifications` so frontend API calls like `Api.notifications.list()` resolve correctly.

---

## 2. RESPONSIBILITY

This file's responsibilities are:
- Listing a user's notifications with optional count limit.
- Marking all notifications as read in one operation.
- Marking a single notification as read.
- Deleting a specific notification.

It does **not** handle creating notifications — notifications are created as side effects inside other modules (e.g., discussion replies, fee reminders, announcements).

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework |
| `router` | `express.Router()` | Scoped router instance |
| `protect` | `../auth/auth.middleware` | JWT authentication middleware |
| `db` | `../../config/db` | MySQL connection pool for direct queries |
| `sendSuccess` | `../../shared/errorHandler` | Standardized success response helper |

> **Note:** `sendError` is imported in the module header but is **not used** in any route handler in this file.

---

## 4. CORE LOGIC BREAKDOWN

### Global Middleware
```js
router.use(protect);
```
All 4 routes require authentication. No role restriction is applied — the system is available to all user types.

### Ownership Enforcement via SQL
Every query filters by `user_id = req.user.id`. This ensures users can only access and modify their own notifications. No explicit ownership check function is used — the WHERE clause itself is the security boundary.

### Inline Pattern
Like several other modules in this project, there is no separate controller or service — all SQL is written directly inside the route callbacks.

---

## 5. FUNCTIONS / METHODS (Route Handlers)

### `GET /`
**Purpose:** Fetch the authenticated user's notifications, most recent first.  
**Auth:** Any authenticated user.  
**Query params:** `limit` (optional integer, defaults to 20)  
**SQL:**
```sql
SELECT id, title, body, type, is_read, created_at
FROM notifications
WHERE user_id = ?
ORDER BY created_at DESC
LIMIT ?
```
**Validation:** `limit` is parsed with `parseInt(req.query.limit) || 20` — falls back gracefully to 20 if not provided or invalid.

**Response:**
```json
[
  {
    "id": 15,
    "title": "New Reply on Your Post",
    "body": "Ravi replied to your post: \"What is backpropagation?\"",
    "type": "discussion",
    "is_read": 0,
    "created_at": "2025-08-20T10:15:00Z"
  }
]
```

---

### `PATCH /mark-all-read`
**Purpose:** Mark all of the user's notifications as read in a single operation.  
**Auth:** Any authenticated user.  
**SQL:**
```sql
UPDATE notifications SET is_read = 1 WHERE user_id = ?
```
No `id` parameter needed — operates on all notifications belonging to the user.

**Response:** 200 with message `'All notifications marked as read.'`.

---

### `PATCH /:id/read`
**Purpose:** Mark a single notification as read.  
**Auth:** Any authenticated user.  
**Parameters:** `id` (route param — notification ID)  
**SQL:**
```sql
UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?
```
The `AND user_id = ?` condition ensures users cannot mark other users' notifications as read.

**Edge Case:** If the `id` does not belong to this user, the UPDATE silently affects 0 rows — no 404 is returned. The response is always 200.

**Response:** 200 with message `'Notification marked as read.'`.

---

### `DELETE /:id`
**Purpose:** Delete a specific notification.  
**Auth:** Any authenticated user.  
**Parameters:** `id` (route param)  
**SQL:**
```sql
DELETE FROM notifications WHERE id = ? AND user_id = ?
```
Same ownership pattern as `PATCH /:id/read` — deleting another user's notification silently no-ops.

**Response:** 200 with message `'Notification deleted.'`.

---

## 6. API ROLE

**Base path:** `/api/v1/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Any | Fetch user notifications (with limit) |
| PATCH | `/mark-all-read` | Any | Mark all notifications as read |
| PATCH | `/:id/read` | Any (owner) | Mark one notification as read |
| DELETE | `/:id` | Any (owner) | Delete one notification |

---

## 7. DATA FLOW

```
HTTP Request
    ↓
protect (JWT → req.user)
    ↓
Route handler
    ↓
db.query (scoped by user_id = req.user.id)
    ↓
sendSuccess(res, 200, message, data)
    OR
next(err) → global error handler
```

---

## 8. CONNECTIONS

**Files that use this file:**
- Main `app.js` mounts at `/api/v1/notifications`.
- **Also duplicated in:** `parent_routes.js` — the parent module has its own notification routes at `/api/v1/parent/notifications` (handled by `parent.controller.js`). This standalone file provides a universal path.

**Files this file depends on:**
- `../../config/db`
- `../auth/auth.middleware` — `protect`
- `../../shared/errorHandler` — `sendSuccess`

**Tables accessed:** `notifications`

**Notifications are created by:** `discussions_routes.js` (reply notifications), `institute_service.js` (fee reminders, announcements), and other modules in the system.

---

## 9. MIDDLEWARE / AUTH

| Middleware | Scope | Behavior |
|---|---|---|
| `protect` | All routes | Requires valid JWT; sets `req.user` |

No `restrictTo` is used — all roles (student, teacher, parent, institute) share the same notification table and this same interface.

---

## 10. ERROR HANDLING

| Situation | Behavior |
|---|---|
| Invalid or missing `limit` query param | Falls back to default 20 |
| Notification ID not found or belongs to another user | Silent no-op (0 rows affected); responds 200 |
| DB error | `next(err)` → global error handler → 500 |

---

## 11. EXAMPLE USAGE

**Fetch 5 most recent notifications:**
```http
GET /api/v1/notifications?limit=5
Authorization: Bearer <token>
```

**Mark all read:**
```http
PATCH /api/v1/notifications/mark-all-read
Authorization: Bearer <token>
```

**Mark single notification as read:**
```http
PATCH /api/v1/notifications/15/read
Authorization: Bearer <token>
```

**Delete a notification:**
```http
DELETE /api/v1/notifications/15
Authorization: Bearer <token>
```

---

## 12. EDGE CASES / NOTES

- **`sendError` is imported but never used** — likely a leftover import from a template or copy-paste. Not harmful but represents minor code clutter.
- **Silent ownership failure** — trying to mark or delete another user's notification does not return an error, just a 200 with 0 actual changes. This is a common trade-off (security through obscurity — don't reveal if the ID exists).
- **Limit is not capped** — unlike `getStudents` in the institute service which caps at 100, the `limit` here is passed directly to SQL. A very large `limit` (e.g., `?limit=999999`) would work and could be a minor performance concern.
- **No `mark-all-delete` endpoint** — users can only delete one notification at a time.
- **`type` field** in notifications allows the frontend to render different icons per notification type (e.g., `'discussion'`, `'fee'`, `'announcement'`).
- This file is described in its header as **mirroring** student notification routes — it was created specifically to support a shared frontend API path that works regardless of user role.

---

## 13. SUMMARY

`notifications_routes.js` is a compact, standalone notification management module providing 4 endpoints for reading and managing notifications. It enforces ownership via SQL `WHERE user_id = ?` conditions rather than middleware. It is accessible to all authenticated roles and serves as the universal notification API endpoint at `/api/v1/notifications`. Notifications themselves are created by other modules as side effects of system events.
