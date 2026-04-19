# `parent_service.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/parent/`  
> **File path:** `modules/parent/parent.service.js`  
> **File type:** Service (Business Logic Layer)

---

## 1. FILE OVERVIEW

**File name:** `parent_service.js`  
**File type:** Service / Business Logic Layer  
**Purpose:** Contains all database queries and business logic for the Parent portal in EduVerse. It allows parents to monitor their linked children's academic data, communicate with teachers, manage meetings, handle fees, and manage their own account — all with strict parent-child relationship verification.

---

## 2. RESPONSIBILITY

This service is responsible for:

- Enforcing parent-child link verification before any child data is accessed.
- Aggregating multi-data-source summaries for the parent dashboard.
- Providing read access to child academic data: courses, quizzes, assignments, attendance, certificates, activity.
- Implementing a full messaging system (duplicated from `messages.service.js` but for the parent context).
- Managing Parent-Teacher Meeting (PTM) requests with notifications.
- Handling parent profile management including secure password change with bcrypt.
- Managing notification preferences stored as JSON.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `db` | `../../config/db` | MySQL connection pool |
| `AppError` | `../../shared/errorHandler` | Custom error class for structured errors |
| `bcrypt` | `bcryptjs` | Password hashing and comparison for `updatePassword` |

---

## 4. CORE LOGIC BREAKDOWN

### Private Helper: `_verifyLink(parentId, studentId)`
```js
async function _verifyLink(parentId, studentId) {
  const [[link]] = await db.query(
    'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parentId, studentId]
  );
  if (!link) throw new AppError('Child not found or not linked to your account.', 403, 'FORBIDDEN');
  return link;
}
```
**The security foundation of the parent module.** Every function that reads child data calls `_verifyLink` first. This ensures:
1. A parent cannot access data for children they are not linked to.
2. The error is a `403 FORBIDDEN` (not 404), signaling that the resource may exist but access is denied.

This function is called in: `getChildOverview`, `getChildCourses`, `getChildPerformance`, `getChildAttendance`, `getChildAssignments`, `getChildQuizzes`, `getChildCertificates`, `getChildActivity`, `getChildFees`, and `requestMeeting`.

---

## 5. FUNCTIONS / METHODS

### Dashboard

#### `getDashboard(parentId)`
**Purpose:** Comprehensive dashboard aggregating all children's status.  
**Logic:**
1. Fetches all linked children with name, avatar, grade, relation.
2. For each child (using a `for...of` loop), runs 4 separate queries:
   - Attendance percentage (present/total).
   - Pending assignments count.
   - Upcoming quizzes count.
   - Pending/overdue fees count.
3. Fetches up to 5 unread notifications for the parent.

**Performance note:** N+4 queries where N is the number of children. For parents with many children, this could be slow. Not batched or parallelized with `Promise.all`.

**Returns:**
```json
{
  "children": [
    {
      "id": 88, "name": "Arjun", "grade": "10",
      "attendance_pct": 87,
      "pending_assignments": 2,
      "upcoming_quizzes": 1,
      "pending_fees": 0
    }
  ],
  "notifications": [...]
}
```

---

### Children Management

#### `getChildren(parentId)`
- Returns all children with name, avatar, grade, email, relation, and `linked_at` timestamp.
- Ordered by `linked_at ASC` (oldest link first).

#### `linkChild(parentId, studentId, relation)`
**Logic:**
1. Verifies the `studentId` corresponds to a real user with `role = 'student'` — throws `404 NOT_FOUND` if not.
2. Checks for an existing link — throws `409 ALREADY_LINKED` if already connected.
3. Inserts into `parent_students` with `is_verified = 1` (instantly verified — no OTP flow implemented despite the controller accepting an `otp` field).
4. Fetches and returns the child's name in the response message.

**Default relation:** `'guardian'` if `relation` is not provided.

#### `unlinkChild(parentId, studentId)`
- Hard deletes the `parent_students` row.
- Does not verify the link exists before deleting — a no-op if not linked.

---

### Child Academic Monitoring

#### `getChildOverview(parentId, studentId)`
Calls `_verifyLink` then runs 5 queries in sequence:
1. Student basic info (name, avatar, grade, DOB, email).
2. Total enrolled course count.
3. Attendance (total sessions / present count → percentage).
4. Average quiz score and total attempts.
5. Certificate count.
6. Videos watched today (`video_progress` table, `DATE(last_watched_at) = CURDATE()`).

**Returns:** Student info + `summary` object with all metrics.

---

#### `getChildCourses(parentId, studentId)`
- Verifies link, then queries `enrollments` → `courses` → `course_progress` (LEFT JOIN).
- Returns: course title, thumbnail, category, level, progress %, last activity date, instructor name.
- Uses `COALESCE(cp.completion_percentage, 0)` — defaults to 0 if no progress record exists.
- Ordered by `last_activity_at DESC`.

---

#### `getChildPerformance(parentId, studentId)`
Verifies link, then runs 4 queries:
1. **Quiz history:** Last 20 submitted quiz attempts with score, percentage, pass/fail, course title.
2. **Assignment grades:** Last 20 assignment submissions with score, max marks, status, feedback.
3. **Course progress:** Completion percentages across all enrolled courses.
4. **Study time:** Videos watched per day for the last 7 days (grouped by day name via `DATE_FORMAT`).

**Returns:**
```json
{
  "quiz_history": [...],
  "assignment_grades": [...],
  "course_progress": [...],
  "study_time": [{ "day": "Mon", "videos_watched": 3 }, ...]
}
```

---

#### `getChildAttendance(parentId, studentId, filters)`
- Accepts `from` and `to` date range filters in `filters` (passed from `req.query`).
- Verifies link, then queries `attendance_records` → `attendance_sessions` → `classes`.
- Builds dynamic WHERE clause with date filters.
- **Client-side summary calculation:** After fetching records, computes `total`, `present`, `absent`, `late`, and `percentage` using JavaScript `Array.filter()` (not SQL aggregation).

**Returns:** `{ records: [...], summary: { total, present, absent, late, percentage } }`

---

#### `getChildAssignments(parentId, studentId)`
- Returns assignments from all enrolled courses with submission status, score, and feedback.
- Uses `LEFT JOIN assignment_submissions` — assignments with no submission will have `null` status/score.

---

#### `getChildQuizzes(parentId, studentId)`
- Returns quiz attempts with score, percentage, pass/fail for submitted quizzes.
- Limited to completed attempts (`submitted_at IS NOT NULL`).

---

#### `getChildCertificates(parentId, studentId)`
- Returns certificates earned by the student.

---

#### `getChildActivity(parentId, studentId)`
- Returns a recent activity log for the student (exact table structure depends on DB schema not fully visible in the file).

---

### Fees

#### `getChildFees(parentId, studentId)`
- Verifies parent-child link.
- Returns fee records for the child: fee name, amount, due date, status (pending/paid/overdue).

#### `getPaymentHistory(parentId)`
- Returns all payment transactions across all of the parent's children.
- **No `_verifyLink` call** — scoped by `parent_id` directly from a payment/fees table.

---

### Messages

The parent module re-implements the full messaging stack (4 functions) rather than importing from `messages.service.js`. The logic is nearly identical but uses `parentId` as the actor.

#### `getMessageRooms(parentId)`
- Same canonical CASE-WHEN query as `messages.service.getRooms`.

#### `getOrCreateRoom(parentId, otherUserId)`
- Self-message check, canonical ordering (`Math.min`/`Math.max`), check-or-create pattern — identical to `messages.service.getOrCreateRoom`.

#### `getMessages(roomId, parentId, limit)`
- Verifies room membership: `WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)`.
- Returns messages with `is_mine` computed column.
- Defaults limit to 50.

#### `sendMessage(roomId, parentId, content)`
- Content trim + empty check.
- Room membership verification.
- Insert → touch room `updated_at` → re-fetch message.

#### `markRoomRead(roomId, parentId)`
- `UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?`

---

### Announcements

#### `getAnnouncements(parentId)`
- Queries `announcements` where `target_role IN ('all','parent')` and `is_active = 1`.
- Returns last 30 active announcements (no filtering by the parent's specific institute — it returns all matching role/active announcements).
- **No `_verifyLink`** — not child-specific.

---

### Meetings (Parent-Teacher Meetings)

#### `getMeetings(parentId)`
- Returns all PTM meeting records for the parent.
- Joins `ptm_meetings` → teacher profile → student profile → institute.
- Returns: scheduled time, duration, meeting link, status, notes, teacher name, student name, institute name.

#### `requestMeeting(parentId, data)`
**Required fields:** `teacher_id`, `student_id`, `institute_id`, `scheduled_at`.  
**Logic:**
1. Validates required fields — throws `400 MISSING_FIELDS` if any are absent.
2. Calls `_verifyLink(parentId, student_id)` — ensures the student belongs to this parent.
3. Inserts into `ptm_meetings`.
4. Sends a notification to the teacher: `"A parent has requested a meeting on <date>"`.

**Note:** The scheduled date is formatted using `new Date(scheduled_at).toLocaleDateString('en-IN')` — the locale `'en-IN'` produces Indian date format (DD/MM/YYYY).

**Returns:** `{ id: newMeetingId, message: 'Meeting requested.' }`

#### `cancelMeeting(meetingId, parentId)`
1. Verifies the meeting belongs to this parent (SELECT + throw 404 if not found).
2. Soft-cancels: `UPDATE ptm_meetings SET status = 'cancelled'`.
- Does **not** notify the teacher of cancellation.

---

### Notifications

#### `getNotifications(parentId, filters)`
- `limit` from `filters.limit`, defaults to 20. Not capped.

#### `markAllRead(parentId)`
- `UPDATE notifications SET is_read = 1 WHERE user_id = ?`

#### `markOneRead(notifId, parentId)`
- `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?` — ownership enforced by SQL.

---

### Profile

#### `getProfile(parentId)`
- Joins `users` and `user_profiles`.
- Returns: id, email, phone, created_at, name, avatar, relation, `notif_prefs` (JSON string from DB).
- Throws `404 NOT_FOUND` if user not found.

#### `updateProfile(parentId, data)`
- Accepts `name`, `phone`, `relation`.
- Uses `COALESCE` pattern for partial updates.
- Updates `users.phone` separately if provided.

#### `updatePassword(parentId, currentPassword, newPassword)`
**Security flow:**
1. Fetches current `password_hash` from DB.
2. `bcrypt.compare(currentPassword, hash)` — throws `400 WRONG_PASSWORD` if mismatch.
3. Reads `BCRYPT_ROUNDS` from environment (defaults to 12).
4. Hashes new password and updates `users.password_hash`.
5. **Deletes all refresh tokens** for the user: `DELETE FROM refresh_tokens WHERE user_id = ?` — forcing all other sessions to log out.

**Returns:** `{ message: 'Password updated. Please sign in again.' }`

#### `updateNotifPrefs(parentId, prefs)`
- Serializes `prefs` with `JSON.stringify` and stores in `user_profiles.notif_prefs`.
- The prefs object structure is flexible — not validated or typed.

---

## 6. DATA FLOW

```
parent.controller.js → svc.*(parentId, ...)
    ↓
[_verifyLink(parentId, studentId)]  ← security gate
    ↓
db.query(SQL, params) → MySQL
    ↓
[optional] bcrypt.compare / bcrypt.hash (password operations)
    ↓
[optional] db.query to insert notification (requestMeeting)
    ↓
Returns JS object / array to controller
```

---

## 7. CONNECTIONS

**Called by:** `parent.controller.js` exclusively.

**Depends on:**
- `../../config/db`
- `../../shared/errorHandler` — `AppError`
- `bcryptjs` — password verification and hashing

**DB Tables accessed:** `parent_students`, `users`, `user_profiles`, `enrollments`, `courses`, `course_progress`, `quiz_attempts`, `quizzes`, `assignment_submissions`, `assignments`, `attendance_records`, `attendance_sessions`, `classes`, `student_fees`, `message_rooms`, `messages`, `announcements`, `notifications`, `ptm_meetings`, `institutes`, `certificates`, `video_progress`, `refresh_tokens`

---

## 8. ERROR HANDLING

| Situation | Error |
|---|---|
| Child not linked to parent | `AppError('Child not found or not linked...', 403, 'FORBIDDEN')` |
| Student not found when linking | `AppError('Student not found.', 404, 'NOT_FOUND')` |
| Child already linked | `AppError('Child already linked.', 409, 'ALREADY_LINKED')` |
| Meeting not found or not owned | `AppError('Meeting not found.', 404, 'NOT_FOUND')` |
| Wrong current password | `AppError('Current password is incorrect.', 400, 'WRONG_PASSWORD')` |
| Profile not found | `AppError('Profile not found.', 404, 'NOT_FOUND')` |
| Missing meeting fields | `AppError('...required.', 400, 'MISSING_FIELDS')` |
| Empty message content | `AppError('Message cannot be empty.', 400, 'EMPTY_MESSAGE')` |

---

## 9. EDGE CASES / NOTES

- **Messaging is re-implemented**, not shared from `messages.service.js`. The logic is nearly identical but introduces a maintenance risk — changes to the messaging logic must be applied in two places.
- **`getDashboard` runs N×4+1 queries** sequentially in a loop. With `Promise.all`, these child summaries could be fetched in parallel, significantly improving performance.
- **`getAnnouncements` is not scoped to institute** — it returns all announcements targeting `'parent'` or `'all'` roles from all institutes. A parent could see announcements from institutes their children are not enrolled in.
- **`cancelMeeting` does not notify the teacher** — only `requestMeeting` sends a notification.
- **`updateNotifPrefs` stores raw JSON** — no validation of the `prefs` object structure. Invalid or unexpected keys are silently stored.
- **`updatePassword` invalidates all sessions** by deleting refresh tokens — a good security practice.
- **bcrypt rounds** are read from `process.env.BCRYPT_ROUNDS` at runtime — this allows tuning without code changes.
- **`getChildAttendance` computes summary in JavaScript** (not SQL) — for very large attendance datasets, this could be memory-intensive.
- **`unlinkChild` is destructive with no confirmation** — the child is unlinked without checking if a meeting or other dependency exists.

---

## 10. SUMMARY

`parent_service.js` is a comprehensive 743-line service providing the entire data layer for the Parent portal. Its central security mechanism is `_verifyLink()`, which gates all child data access behind a verified parent-child relationship. It covers dashboard aggregation, deep academic monitoring across 8 dimensions, a full messaging stack, PTM meeting lifecycle, notification management, and secure profile/password management. The file stands alone as the parent module's only data layer, though it duplicates messaging logic that exists in `messages.service.js`.
