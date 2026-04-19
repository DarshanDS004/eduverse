# `messages_routes.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/messages/`  
> **File path:** `modules/messages/messages.routes.js`  
> **File type:** Route Definition File (Express Router)

---

## 1. FILE OVERVIEW

**File name:** `messages_routes.js`  
**File type:** Route Definition File  
**Purpose:** Declares all HTTP routes for the real-time direct messaging system in EduVerse. It maps URL paths to controller functions and applies authentication middleware.

---

## 2. RESPONSIBILITY

This is a minimal, clean routing file. Its only jobs are:
- Apply the `protect` middleware globally to all message routes.
- Map 5 HTTP verb + path combinations to their corresponding controller functions.
- Export the router for mounting in the main application.

All logic is delegated to `messages.controller.js`.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `express` | `express` | Web framework |
| `router` | `express.Router()` | Creates isolated route namespace |
| `controller` | `./messages.controller` | All handler functions for message operations |
| `protect` | `../auth/auth.middleware` | JWT authentication middleware |

---

## 4. CORE LOGIC BREAKDOWN

### Global Middleware
```js
router.use(protect);
```
All 5 routes require a valid JWT. No role restriction is applied — any authenticated user (student, teacher, institute, parent) can use the messaging system.

### Route Definitions
```js
router.get('/rooms',               controller.getRooms);
router.post('/rooms',              controller.createRoom);
router.get('/rooms/:id/messages',  controller.getMessages);
router.post('/rooms/:id/messages', controller.sendMessage);
router.patch('/rooms/:id/read',    controller.markRead);
```

---

## 5. API ROLE

**Base path (assumed):** `/api/v1/messages`

| Method | Path | Controller | Description |
|---|---|---|---|
| GET | `/rooms` | `getRooms` | List all chat rooms for the current user |
| POST | `/rooms` | `createRoom` | Get or create a 1:1 chat room |
| GET | `/rooms/:id/messages` | `getMessages` | Fetch messages in a specific room |
| POST | `/rooms/:id/messages` | `sendMessage` | Send a message to a room |
| PATCH | `/rooms/:id/read` | `markRead` | Mark all messages in a room as read |

---

## 6. DATA FLOW

```
HTTP Request
    ↓
protect (JWT → req.user)
    ↓
Route match → controller.*(req, res, next)
    ↓
messages.service.js (business logic + DB)
    ↓
Response
```

---

## 7. CONNECTIONS

**Called by:** Main `app.js` (e.g., `app.use('/api/v1/messages', messagesRouter)`)

**Depends on:**
- `./messages.controller` — All route handler implementations
- `../auth/auth.middleware` — `protect`

---

## 8. MIDDLEWARE / AUTH

| Middleware | Scope | Behavior |
|---|---|---|
| `protect` | All 5 routes | Requires valid JWT; populates `req.user` |

No role-based restriction (`restrictTo`) is used — the system is open to all authenticated user roles.

---

## 9. ERROR HANDLING

No error handling in this file. Errors are handled in the controller via `next(e)`.

---

## 10. EXAMPLE USAGE

**Get all chat rooms for logged-in user:**
```http
GET /api/v1/messages/rooms
Authorization: Bearer <token>
```

**Create or retrieve a room with another user:**
```http
POST /api/v1/messages/rooms
Authorization: Bearer <token>
Content-Type: application/json

{ "other_user_id": 42 }
```

**Send a message:**
```http
POST /api/v1/messages/rooms/7/messages
Authorization: Bearer <token>
Content-Type: application/json

{ "content": "Hello, can you help me with assignment 3?" }
```

---

## 11. EDGE CASES / NOTES

- **No role restriction** — any authenticated user (student, parent, teacher, institute admin) can initiate and participate in messaging.
- **Room-based architecture** — messaging is organized around "rooms" (1:1 conversations), not individual users. The room must exist or be created before messages can be sent.
- **`:id` in routes refers to `room_id`**, not `user_id`.
- This file is intentionally thin — it is a pure route declaration file.

---

## 12. SUMMARY

`messages_routes.js` is a lean, 5-route file that wires the messaging module's HTTP interface. It enforces authentication on all routes and delegates all logic to `messages.controller.js`. The router supports listing chat rooms, creating 1:1 rooms, fetching messages, sending messages, and marking rooms as read.
