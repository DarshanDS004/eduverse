# `messages_controller.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/messages/`  
> **File path:** `modules/messages/messages.controller.js`  
> **File type:** Controller

---

## 1. FILE OVERVIEW

**File name:** `messages_controller.js`  
**File type:** Controller  
**Purpose:** Acts as the HTTP adapter between Express routes and the messaging service. It extracts request data, invokes the appropriate service function, and returns a standardized HTTP response. It contains no business logic or SQL.

---

## 2. RESPONSIBILITY

- Extract parameters from `req.body`, `req.params`, `req.query`, and `req.user`.
- Perform basic input validation (required field checks).
- Call `messages.service.js` functions.
- Return HTTP responses using `sendSuccess` / `sendError`.
- Forward unexpected errors to Express's global error handler via `next(err)`.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `service` | `./messages.service` | All business logic for the messaging module |
| `sendSuccess` | `../../shared/errorHandler` | Sends `{ success: true, data }` JSON response |
| `sendError` | `../../shared/errorHandler` | Sends `{ success: false, error }` JSON response |

---

## 4. CORE LOGIC BREAKDOWN

All five functions follow this uniform pattern:

```js
async function handlerName(req, res, next) {
  try {
    // [optional validation]
    const data = await service.someFunction(...);
    return sendSuccess(res, statusCode, 'Message', data);
  } catch (err) {
    next(err);
  }
}
```

No middleware logic, no SQL, no direct database access.

---

## 5. FUNCTIONS / METHODS

### `getRooms(req, res, next)`
**Purpose:** Retrieve all chat rooms that the authenticated user is a participant in.  
**Parameters:** None extracted beyond `req.user.id`.  
**Calls:** `service.getRooms(req.user.id)`  
**Returns:** HTTP 200 with array of room objects (other user info, last message, unread count).

---

### `createRoom(req, res, next)`
**Purpose:** Create a new 1:1 message room, or return the existing one if it already exists (idempotent).  
**Validation:** Returns `400 MISSING_FIELDS` if `other_user_id` is not in `req.body`.  
**Extracts:** `const { other_user_id } = req.body`  
**Calls:** `service.getOrCreateRoom(req.user.id, other_user_id)`  
**Returns:** HTTP 200 with `{ id: roomId }`.

**Edge Case:** If the room already exists between the two users, it is returned rather than a duplicate being created.

---

### `getMessages(req, res, next)`
**Purpose:** Retrieve messages in a specific chat room with optional limit.  
**Extracts:**
- `req.params.id` — the room ID
- `req.query.limit` — optional, defaults to 50 in service

**Calls:** `service.getMessages(req.params.id, req.user.id, req.query.limit)`  
**Returns:** HTTP 200 with `{ messages: [...] }`.

**Security:** The service verifies that `req.user.id` is a participant in the room before returning messages.

---

### `sendMessage(req, res, next)`
**Purpose:** Send a new message into a chat room.  
**Validation:** Returns `400 MISSING_FIELDS` if `content` is not provided.  
**Extracts:**
- `req.params.id` — room ID
- `req.body.content` — message text

**Calls:** `service.sendMessage(req.params.id, req.user.id, content)`  
**Returns:** HTTP 201 with the newly created message object.

---

### `markRead(req, res, next)`
**Purpose:** Mark all messages in a room (sent by the other user) as read.  
**Extracts:** `req.params.id` — room ID  
**Calls:** `service.markRoomRead(req.params.id, req.user.id)`  
**Returns:** HTTP 200 with the service's confirmation message string (passed directly from the service response's `message` field).

**Note:** The response message is dynamically taken from `data.message` — slightly unusual compared to the other handlers which hardcode the message string.

---

## 6. DATA FLOW

```
HTTP Request (from messages_routes.js)
    ↓
Controller function
    ├─ Validates required fields → sendError (400) if invalid
    ├─ Extracts: req.params.id, req.user.id, req.body.*, req.query.*
    ↓
service.*(...)  →  messages.service.js
    ↓
sendSuccess(res, 200/201, message, data)
    OR
next(err) → global error handler
```

---

## 7. CONNECTIONS

**Called by:** `messages.routes.js`

**Calls:**
- `./messages.service` — `getRooms`, `getOrCreateRoom`, `getMessages`, `sendMessage`, `markRoomRead`
- `../../shared/errorHandler` — `sendSuccess`, `sendError`

---

## 8. ERROR HANDLING

| Situation | Handling |
|---|---|
| `other_user_id` missing in body | `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| `content` missing in body | `sendError(res, 400, ..., 'MISSING_FIELDS')` |
| User not in room (from service) | `AppError` caught by `next(err)` → 404 |
| Messaging self (from service) | `AppError` caught by `next(err)` → 400 |
| DB error | `next(err)` → global 500 handler |

---

## 9. EXAMPLE USAGE

**Controller is not called directly — called by routes. Example flow:**
```
GET /api/v1/messages/rooms
→ protect middleware sets req.user
→ getRooms(req, res, next) called
→ service.getRooms(req.user.id) runs SQL
→ sendSuccess(res, 200, 'Rooms loaded.', roomsArray)
```

---

## 10. EDGE CASES / NOTES

- **`markRead` response message** is pulled from `data.message` (the service's return object) rather than a hardcoded string — this is inconsistent with the other four handlers but functionally correct.
- **Minimal validation** — only `other_user_id` and `content` are validated. Room ID format, user ID types, and message length are not validated at the controller level (delegated to service or DB constraints).
- The controller never accesses `req.query` except in `getMessages` for `limit`.

---

## 11. SUMMARY

`messages_controller.js` is a thin, 5-function controller that bridges the messaging routes and service. Each function follows an identical async try/catch pattern. It handles two input validation cases (missing `other_user_id` and missing `content`), delegates all logic to `messages.service.js`, and returns consistent HTTP responses.
