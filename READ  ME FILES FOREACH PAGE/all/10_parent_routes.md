# `parent_routes.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/parent/`  
> **File path:** `modules/parent/parent.routes.js`  
> **File type:** Route Definition File (Express Router)

---

## 1. FILE OVERVIEW

**File name:** `parent_routes.js`  
**File type:** Route Definition File  
**Purpose:** Declares all HTTP routes for the Parent portal in EduVerse. It maps URL patterns to controller handlers and enforces that only users with the `'parent'` role can access these endpoints.

---

## 2. RESPONSIBILITY

This file is the **routing layer** for the Parent module. It:

- Enforces authentication (`protect`) and role restriction (`restrictTo('parent')`) globally on every route.
- Maps 30+ routes across 8 feature areas: dashboard, children management, academic monitoring, fees, messaging, announcements, meetings, notifications, and profile.
- Delegates all logic to `parent.controller.js`.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework |
| `router` | `express.Router()` | Creates scoped router |
| `ctrl` | `./parent.controller` | All parent controller functions |
| `protect` | `../auth/auth.middleware` | JWT authentication middleware |
| `restrictTo` | `../auth/auth.middleware` | Role-based access control middleware |

---

## 4. CORE LOGIC BREAKDOWN

### Global Middleware
```js
router.use(protect);
router.use(restrictTo('parent'));
```
Every route in this file is restricted to users with role `'parent'`. Any other role (student, teacher, institute, superadmin) receives a `403 Forbidden`. Unauthenticated users receive `401`.

---

## 5. ROUTE GROUPS & ENDPOINTS

### Dashboard
| Method | Path | Handler |
|---|---|---|
| GET | `/dashboard` | `ctrl.getDashboard` |

Returns a summary view of all linked children with their attendance, pending assignments, upcoming quizzes, and fee status.

---

### Children Management
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/children` | `ctrl.getChildren` | List all linked children |
| POST | `/children/link` | `ctrl.linkChild` | Link a child to this parent account |
| DELETE | `/children/:studentId` | `ctrl.unlinkChild` | Remove a child link |

---

### Academic Monitoring (per child)
All routes are scoped to a specific child via `:studentId`.

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/children/:studentId/overview` | `ctrl.getChildOverview` | Summary of child's academic status |
| GET | `/children/:studentId/courses` | `ctrl.getChildCourses` | Enrolled courses with progress |
| GET | `/children/:studentId/performance` | `ctrl.getChildPerformance` | Quiz and assignment performance |
| GET | `/children/:studentId/attendance` | `ctrl.getChildAttendance` | Attendance records with filters |
| GET | `/children/:studentId/assignments` | `ctrl.getChildAssignments` | Assignment list and submissions |
| GET | `/children/:studentId/quizzes` | `ctrl.getChildQuizzes` | Quiz results |
| GET | `/children/:studentId/certificates` | `ctrl.getChildCertificates` | Earned certificates |
| GET | `/children/:studentId/activity` | `ctrl.getChildActivity` | Recent activity log |

---

### Fees & Payments
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/children/:studentId/fees` | `ctrl.getChildFees` | Fee records for a specific child |
| GET | `/payments/history` | `ctrl.getPaymentHistory` | All payment history across children |

---

### Communication (Messages)
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/messages/rooms` | `ctrl.getMessageRooms` | List all message rooms |
| POST | `/messages/rooms` | `ctrl.createRoom` | Create/find a 1:1 room |
| GET | `/messages/:roomId` | `ctrl.getMessages` | Get messages in a room |
| POST | `/messages/:roomId` | `ctrl.sendMessage` | Send a message |
| PATCH | `/messages/:roomId/read` | `ctrl.markRead` | Mark room messages as read |

---

### Announcements
| Method | Path | Handler |
|---|---|---|
| GET | `/announcements` | `ctrl.getAnnouncements` |

---

### Parent-Teacher Meetings
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/meetings` | `ctrl.getMeetings` | List meetings (past + upcoming) |
| POST | `/meetings` | `ctrl.requestMeeting` | Request a new meeting |
| PATCH | `/meetings/:id/cancel` | `ctrl.cancelMeeting` | Cancel a meeting request |

---

### Notifications
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/notifications` | `ctrl.getNotifications` | List notifications |
| PATCH | `/notifications/mark-all-read` | `ctrl.markAllRead` | Mark all as read |
| PATCH | `/notifications/:id/read` | `ctrl.markOneRead` | Mark one as read |

---

### Profile
| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/profile` | `ctrl.getProfile` | Get parent's profile |
| PATCH | `/profile` | `ctrl.updateProfile` | Update profile info |
| PATCH | `/profile/password` | `ctrl.updatePassword` | Change password |
| PATCH | `/profile/notif-prefs` | `ctrl.updateNotifPrefs` | Update notification preferences |

---

## 6. API ROLE

**Base path (assumed):** `/api/v1/parent`

Total routes: **30 routes** across 8 feature areas. All scoped exclusively to the `'parent'` role.

---

## 7. DATA FLOW

```
HTTP Request
    ↓
protect (JWT auth → req.user)
    ↓
restrictTo('parent') (role check)
    ↓
ctrl.*(req, res, next) — parent.controller.js
    ↓
svc.*(...)  — parent.service.js
    ↓
Response
```

---

## 8. CONNECTIONS

**Called by:** Main `app.js` (e.g., `app.use('/api/v1/parent', parentRouter)`)

**Depends on:**
- `./parent.controller` — All handler functions
- `../auth/auth.middleware` — `protect`, `restrictTo`

---

## 9. MIDDLEWARE / AUTH

| Middleware | Scope | Behavior |
|---|---|---|
| `protect` | All routes | JWT required; sets `req.user` |
| `restrictTo('parent')` | All routes | Only `'parent'` role users allowed; others get 403 |

---

## 10. ERROR HANDLING

This file does not handle errors. All error handling is in the controller (`next(e)`) and the global error handler.

---

## 11. EXAMPLE USAGE

**Get child's attendance:**
```http
GET /api/v1/parent/children/88/attendance?from=2025-08-01&to=2025-08-31
Authorization: Bearer <parent_jwt>
```

**Request a parent-teacher meeting:**
```http
POST /api/v1/parent/meetings
Authorization: Bearer <parent_jwt>
Content-Type: application/json

{
  "teacher_id": 12,
  "proposed_date": "2025-09-05",
  "note": "Want to discuss Q2 performance"
}
```

---

## 12. EDGE CASES / NOTES

- **`:studentId` vs `:roomId`** — two different parameter name conventions are used in this file. `:studentId` for child-related routes, `:roomId` for messaging routes. This is clear but inconsistent with `messages_routes.js` which uses `:id` for rooms.
- **Messaging is duplicated** — the parent module has its own messaging routes (`/messages/rooms`, etc.) that mirror the global `messages_routes.js`. The parent messaging routes use the same underlying service functions via `parent.service.js`, which may re-implement or delegate to `messages.service.js`.
- **No file upload routes** — the parent portal does not support any file uploads (no Multer configured).
- **Notification routes** here are parent-role-specific (under `/api/v1/parent/notifications`), separate from the universal `/api/v1/notifications` module.
- **No pagination parameters** are hardcoded in the routes — they are passed through via `req.query` to the service layer.

---

## 13. SUMMARY

`parent_routes.js` is the complete routing configuration for EduVerse's Parent portal. It defines 30 routes across dashboard, children monitoring, fee tracking, messaging, meetings, notifications, and profile management — all locked exclusively to `'parent'` role users via global middleware. Every route maps cleanly to a controller function with no inline logic.
