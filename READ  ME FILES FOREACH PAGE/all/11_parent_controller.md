# `parent_controller.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/parent/`  
> **File path:** `modules/parent/parent.controller.js`  
> **File type:** Controller

---

## 1. FILE OVERVIEW

**File name:** `parent_controller.js`  
**File type:** Controller  
**Purpose:** Acts as the HTTP layer between `parent_routes.js` and `parent_service.js`. It extracts data from Express request objects, performs minimal input validation, and delegates all business logic to the service. It returns standardized HTTP responses.

---

## 2. RESPONSIBILITY

- Extract `req.user.id`, `req.params`, `req.query`, and `req.body` fields.
- Validate required fields for a small subset of endpoints.
- Call the appropriate `parent.service.js` function.
- Return HTTP 200 or 201 responses using helper aliases.
- Forward errors to Express's global error handler via `next(e)`.

It does not contain SQL, business logic, or data transformations.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `svc` | `./parent.service` | All parent business logic and DB operations |
| `sendSuccess` | `../../shared/errorHandler` | Standardized success response |
| `sendError` | `../../shared/errorHandler` | Standardized error response |

### Helper Aliases
```js
const ok      = (res, msg, data) => sendSuccess(res, 200, msg, data);
const created = (res, msg, data) => sendSuccess(res, 201, msg, data);
```
`ok` is used for reads and updates. `created` is used when a resource is newly created (HTTP 201).

---

## 4. CORE LOGIC BREAKDOWN

All 30 exported functions follow this uniform pattern:

```js
exports.action = async (req, res, next) => {
  try {
    // [optional validation]
    return ok(res, 'Message.', await svc.action(...));
  } catch (e) { next(e); }
};
```

The controller is strictly a pass-through layer with consistent structure throughout.

---

## 5. FUNCTIONS / METHODS

### Dashboard

#### `getDashboard(req, res, next)`
- **Calls:** `svc.getDashboard(req.user.id)`
- **Returns:** 200 with all linked children summaries and unread notifications.

---

### Children Management

#### `getChildren(req, res, next)`
- **Calls:** `svc.getChildren(req.user.id)`
- **Returns:** 200 with list of linked children.

#### `linkChild(req, res, next)`
- **Extracts:** `{ student_id, otp, relation }` from `req.body`
- **Validation:** Returns `400 MISSING_FIELDS` if `student_id` is absent.
- **Note:** `otp` is destructured but not validated or passed to the service — its presence is acknowledged in the request shape but not used at this layer.
- **Calls:** `svc.linkChild(req.user.id, student_id, relation)`
- **Returns:** 200 with link confirmation.

#### `unlinkChild(req, res, next)`
- **Calls:** `svc.unlinkChild(req.user.id, req.params.studentId)`
- **Returns:** 200.

---

### Academic Monitoring (per child)

All monitoring functions follow the same pattern: pass `req.user.id` (parent) and `req.params.studentId` (child). The service uses these to verify the parent-child link before returning data.

#### `getChildOverview(req, res, next)`
- **Calls:** `svc.getChildOverview(req.user.id, req.params.studentId)`

#### `getChildCourses(req, res, next)`
- **Calls:** `svc.getChildCourses(req.user.id, req.params.studentId)`

#### `getChildPerformance(req, res, next)`
- **Calls:** `svc.getChildPerformance(req.user.id, req.params.studentId)`

#### `getChildAttendance(req, res, next)`
- **Calls:** `svc.getChildAttendance(req.user.id, req.params.studentId, req.query)`
- **Note:** `req.query` is passed to allow `from`/`to` date range filtering in the service.

#### `getChildAssignments(req, res, next)`
- **Calls:** `svc.getChildAssignments(req.user.id, req.params.studentId)`

#### `getChildQuizzes(req, res, next)`
- **Calls:** `svc.getChildQuizzes(req.user.id, req.params.studentId)`

#### `getChildCertificates(req, res, next)`
- **Calls:** `svc.getChildCertificates(req.user.id, req.params.studentId)`

#### `getChildActivity(req, res, next)`
- **Calls:** `svc.getChildActivity(req.user.id, req.params.studentId)`

---

### Fees

#### `getChildFees(req, res, next)`
- **Calls:** `svc.getChildFees(req.user.id, req.params.studentId)`
- **Returns:** 200 with fee records and their status.

#### `getPaymentHistory(req, res, next)`
- **Calls:** `svc.getPaymentHistory(req.user.id)`
- **Returns:** 200 with all payment history across all children (not scoped to one child).

---

### Messages

#### `getMessageRooms(req, res, next)`
- **Calls:** `svc.getMessageRooms(req.user.id)`

#### `createRoom(req, res, next)`
- **Validation:** Returns `400 MISSING_FIELDS` if `other_user_id` is absent.
- **Calls:** `svc.getOrCreateRoom(req.user.id, other_user_id)`

#### `getMessages(req, res, next)`
- **Calls:** `svc.getMessages(req.params.roomId, req.user.id, req.query.limit)`

#### `sendMessage(req, res, next)`
- **Validation:** Returns `400 MISSING_FIELDS` if `content` is absent.
- **Calls:** `svc.sendMessage(req.params.roomId, req.user.id, content)`
- **Returns:** 201.

#### `markRead(req, res, next)`
- **Calls:** `svc.markRoomRead(req.params.roomId, req.user.id)`

---

### Announcements

#### `getAnnouncements(req, res, next)`
- **Calls:** `svc.getAnnouncements(req.user.id)`
- **Returns:** 200 with announcements relevant to the parent's linked children's institute.

---

### Meetings

#### `getMeetings(req, res, next)`
- **Calls:** `svc.getMeetings(req.user.id)`
- **Returns:** 200 with all meeting requests (pending, approved, past).

#### `requestMeeting(req, res, next)`
- **Calls:** `svc.requestMeeting(req.user.id, req.body)` — passes full body to service.
- **Returns:** 201 with new meeting request data.

#### `cancelMeeting(req, res, next)`
- **Calls:** `svc.cancelMeeting(req.params.id, req.user.id)`
- **Returns:** 200.

---

### Notifications

#### `getNotifications(req, res, next)`
- **Calls:** `svc.getNotifications(req.user.id, req.query)` — query supports limit/unread filters.

#### `markAllRead(req, res, next)`
- **Calls:** `svc.markAllRead(req.user.id)`

#### `markOneRead(req, res, next)`
- **Calls:** `svc.markOneRead(req.params.id, req.user.id)`

---

### Profile

#### `getProfile(req, res, next)`
- **Calls:** `svc.getProfile(req.user.id)`

#### `updateProfile(req, res, next)`
- **Calls:** `svc.updateProfile(req.user.id, req.body)`

#### `updatePassword(req, res, next)`
- **Extracts:** `{ current_password, new_password }` from `req.body`
- **Validation:** Returns `400 MISSING_FIELDS` if either password field is absent.
- **Calls:** `svc.updatePassword(req.user.id, current_password, new_password)`

#### `updateNotifPrefs(req, res, next)`
- **Calls:** `svc.updateNotifPrefs(req.user.id, req.body)`

---

## 6. DATA FLOW

```
HTTP Request (from parent_routes.js)
    ↓
Controller function
    ├─ [Optional] validate req.body fields → sendError(400)
    ├─ Extract: req.user.id, req.params.*, req.body.*, req.query.*
    ↓
svc.*(...)  →  parent.service.js
    ↓
ok() / created() → sendSuccess(res, ...)
    OR
next(e) → global error handler
```

---

## 7. CONNECTIONS

**Called by:** `parent_routes.js`

**Calls:**
- `./parent.service` — all business logic functions
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

---

## 8. ERROR HANDLING

| Situation | Handling |
|---|---|
| `student_id` missing in `linkChild` | `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| `other_user_id` missing in `createRoom` | `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| `content` missing in `sendMessage` | `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| Either password missing in `updatePassword` | `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| Service throws `AppError` | `next(e)` → global handler |
| Unexpected DB error | `next(e)` → global 500 handler |

---

## 9. EXAMPLE USAGE

**Link a child:**
```http
POST /api/v1/parent/children/link
Authorization: Bearer <parent_jwt>
Content-Type: application/json

{ "student_id": 88, "relation": "mother" }
```

**Update password:**
```http
PATCH /api/v1/parent/profile/password
Authorization: Bearer <parent_jwt>
Content-Type: application/json

{ "current_password": "oldPass123", "new_password": "newSecure456" }
```

---

## 10. EDGE CASES / NOTES

- **`otp` field is destructured in `linkChild` but never used** — `const { student_id, otp, relation } = req.body`. The `otp` variable is assigned but not passed to the service. This suggests an OTP-based child-linking flow was planned but not yet implemented at the controller/service level.
- **`requestMeeting` passes the entire `req.body`** to the service without extracting individual fields — the service is responsible for knowing which fields to use.
- **Messaging in parent context uses `req.params.roomId`** (not `req.params.id` as in `messages_routes.js`) — matching the route parameter name defined in `parent_routes.js`.
- **All monitoring routes always send both `req.user.id` and `req.params.studentId`** — the service uses both to verify the parent-child relationship before returning data.
- **No file upload handling** — unlike `institute_controller.js`, no Multer or `req.file` processing exists here.

---

## 11. SUMMARY

`parent_controller.js` is a clean, 30-function controller with a consistent try/catch async pattern throughout. It validates four specific required-field scenarios and delegates all other logic to the service layer. Its primary role is request parsing and response formatting. The OTP field noted in `linkChild` indicates a partially implemented security feature for child account linking.
