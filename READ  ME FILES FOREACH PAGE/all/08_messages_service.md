# `messages_service.js` — File Documentation

> **Project:** EduVerse  
> **Module:** `modules/messages/`  
> **File path:** `modules/messages/messages.service.js`  
> **File type:** Service (Business Logic Layer)

---

## 1. FILE OVERVIEW

**File name:** `messages_service.js`  
**File type:** Service / Business Logic Layer  
**Purpose:** Contains all database logic for the 1:1 direct messaging system in EduVerse. It manages message rooms, message storage, read state, and user membership verification.

---

## 2. RESPONSIBILITY

This service is responsible for:
- Querying and returning a user's chat rooms with metadata (last message, unread count, participant info).
- Creating or fetching a 1:1 chat room between two users using a canonical ordering strategy.
- Fetching messages from a room with security checks.
- Inserting new messages and updating the room's last-activity timestamp.
- Marking all unread messages in a room as read.

---

## 3. IMPORTS / DEPENDENCIES

| Import | Source | Purpose |
|---|---|---|
| `db` | `../../config/db` | MySQL connection pool |
| `AppError` | `../../shared/errorHandler` | Custom error class for structured error throwing |

---

## 4. CORE LOGIC BREAKDOWN

The messaging system is built around two tables:
- **`message_rooms`** — represents a 1:1 conversation between `user_one_id` and `user_two_id`.
- **`messages`** — individual messages belonging to a room, with `sender_id`, `content`, and `is_read`.

A key design decision is the **canonical ordering**: `user_one_id = MIN(id)` and `user_two_id = MAX(id)`. This means the pair (user 3, user 7) always maps to the same room regardless of who initiates the conversation — preventing duplicate rooms.

---

## 5. FUNCTIONS / METHODS

### `getRooms(userId)`
**Purpose:** Fetch all chat rooms for a user with enriched metadata.  
**Parameters:** `userId` (number)  
**Returns:** Array of room objects.

**SQL Logic:**
- Joins `message_rooms` with `user_profiles` for BOTH `user_one_id` and `user_two_id`.
- Uses `CASE WHEN mr.user_one_id = ?` to dynamically determine which side of the room is "the other user" — returns their name and avatar.
- Two correlated subqueries fetch `last_message_content` and `last_message_at` from `messages` ordered by `created_at DESC LIMIT 1`.
- Another subquery counts unread messages: `sender_id != userId AND is_read = 0`.
- Ordered by most recent activity: `COALESCE(last_message_at, mr.created_at) DESC`.

**Returns (mapped JS objects):**
```json
[
  {
    "id": 5,
    "other_user_id": 42,
    "other_user_name": "Priya Sharma",
    "other_user_avatar": "/uploads/...",
    "unread_count": 3,
    "last_message": {
      "content": "See you tomorrow!",
      "created_at": "2025-08-20T14:30:00Z"
    }
  }
]
```

**Note:** `userId` appears **6 times** in the parameterized query because it's used for four CASE expressions and two WHERE conditions.

---

### `getOrCreateRoom(userId, otherUserId)`
**Purpose:** Idempotently get or create a 1:1 chat room between two users.  
**Parameters:** `userId` (number), `otherUserId` (number)  
**Returns:** `{ id: roomId }`

**Logic:**
1. **Self-message check:** Throws `AppError('Cannot message yourself.', 400, 'INVALID_REQUEST')` if both IDs are equal.
2. **Canonical ordering:** `u1 = Math.min(userId, otherUserId)`, `u2 = Math.max(userId, otherUserId)`. This guarantees room uniqueness regardless of who initiates.
3. **Existence check:** Queries `message_rooms` for `user_one_id = u1 AND user_two_id = u2`.
4. If found → returns `{ id: existing.id }`.
5. If not found → inserts a new room and returns `{ id: insertId }`.

**Edge Case:** A database-level unique constraint on `(user_one_id, user_two_id)` (implied by the canonical ordering strategy) would prevent duplicates even under race conditions.

---

### `getMessages(roomId, userId, limit)`
**Purpose:** Retrieve messages in a room, verifying the requesting user is a participant.  
**Parameters:** `roomId` (number), `userId` (number), `limit` (string/number, defaults to 50)  
**Returns:** `{ messages: [...] }`

**Security check:**
```sql
SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)
```
Throws `AppError('Room not found.', 404, 'NOT_FOUND')` if the user is not a participant. This prevents unauthorized users from reading other people's messages.

**Message query:**
- Returns: `id`, `content`, `is_read`, `created_at`, `sender_id`, `sender_name`, `sender_avatar`.
- `(m.sender_id = ?) AS is_mine` — a computed boolean column that tells the client whether each message was sent by the current user (useful for rendering chat bubbles).
- Ordered `ASC` by `created_at` — chronological order.
- `limit` is parsed with `parseInt(limit) || 50` — invalid input falls back to 50.

---

### `sendMessage(roomId, senderId, content)`
**Purpose:** Insert a new message into a room.  
**Parameters:** `roomId` (number), `senderId` (number), `content` (string)  
**Returns:** The newly created message object.

**Logic:**
1. **Content validation:** Throws `AppError('Message content is required.', 400, 'EMPTY_MESSAGE')` if `content` is empty or whitespace-only (`content.trim()` check).
2. **Room membership check:** Same as `getMessages` — throws 404 if sender is not in the room.
3. **Insert:** `INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)` with trimmed content.
4. **Touch room:** `UPDATE message_rooms SET updated_at = NOW()` — keeps room activity timestamp fresh for ordering in `getRooms`.
5. **Return full message:** Fetches the inserted message by its `insertId` with a JOIN to `user_profiles`, including `is_mine = 1` (always 1 since the sender just sent it).

**Why re-fetch after insert?** To return the server-assigned `created_at` and enriched sender data in one consistent response shape.

---

### `markRoomRead(roomId, userId)`
**Purpose:** Mark all messages in a room that were sent by the other user as read.  
**Parameters:** `roomId` (number), `userId` (number)  
**Returns:** `{ message: 'Messages marked as read.' }`

**SQL:**
```sql
UPDATE messages SET is_read = 1
WHERE room_id = ? AND sender_id != ?
```
This marks only messages sent by *others* (not the current user's own messages) as read — correctly modeling the "I've read your messages" semantic.

---

## 6. DATA FLOW

```
messages.controller.js → service.*(...)
    ↓
[validation] → throws AppError if invalid
    ↓
db.query(SQL, params) → MySQL
    ↓
[data mapping] (getRooms uses .map())
    ↓
Returns plain JS object / array to controller
```

---

## 7. CONNECTIONS

**Called by:** `messages.controller.js` exclusively.

**Depends on:**
- `../../config/db` — MySQL pool
- `../../shared/errorHandler` — `AppError`

**DB Tables accessed:** `message_rooms`, `messages`, `user_profiles`

---

## 8. ERROR HANDLING

| Situation | Error |
|---|---|
| `userId === otherUserId` | `AppError('Cannot message yourself.', 400, 'INVALID_REQUEST')` |
| Room not found / user not in room | `AppError('Room not found.', 404, 'NOT_FOUND')` |
| Empty or whitespace-only content | `AppError('Message content is required.', 400, 'EMPTY_MESSAGE')` |

All `AppError` instances bubble up to Express's global error handler via `next(err)` in the controller.

---

## 9. EXAMPLE USAGE

**Sequence: First message between two users**
```
1. createRoom(userA=3, userB=7) called
   → u1 = min(3,7) = 3, u2 = max(3,7) = 7
   → No existing room found
   → INSERT INTO message_rooms (user_one_id=3, user_two_id=7)
   → Returns { id: 11 }

2. sendMessage(roomId=11, senderId=3, content='Hello!')
   → Room membership verified
   → INSERT INTO messages (room_id=11, sender_id=3, content='Hello!')
   → UPDATE message_rooms SET updated_at=NOW() WHERE id=11
   → Returns full message object

3. getMessages(roomId=11, userId=7, limit=50)
   → Room membership verified (user 7 is user_two_id → passes)
   → Returns [{ content: 'Hello!', is_mine: 0, ... }]
```

---

## 10. EDGE CASES / NOTES

- **Canonical room ordering** (`Math.min`/`Math.max`) is only enforced in `getOrCreateRoom`. If someone inserts a room directly into the DB bypassing this function, duplicates could exist. The DB unique constraint (if present) is the safety net.
- **`getRooms` uses 6 parameterized positions** for the same `userId` — because `mysql2` does not support named parameters by default, the value must be repeated in the array.
- **No pagination for messages** — `getMessages` accepts a `limit` but no `offset` or cursor, so older messages beyond the limit are not accessible. This limits chat history retrieval.
- **No real-time support** — this service is REST-only. WebSocket/Socket.io integration for live message delivery would need to be added separately.
- **`markRoomRead` does not verify room membership** — any authenticated user with a valid `roomId` can call this. The controller does not pass a room membership check before `markRoomRead`. The service trusts the controller.
- **Content is trimmed** on send — leading/trailing whitespace is stripped before storage.

---

## 11. SUMMARY

`messages_service.js` implements a clean, secure 1:1 messaging backend. Its core design choices — canonical room ordering, membership verification before every read/write, and `is_mine` computed columns — make it well-suited for a direct messaging UI. It handles room lifecycle (create/find), message history retrieval with a limit, sending with room-touch, and read-state management. It does not support group chats, message deletion, or pagination beyond a single limit parameter.
