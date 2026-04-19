# `messages.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `messages.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/messages.html` |
| **Page Title** | Messages — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page is the **real-time-style messaging interface** for instructors on EduVerse. It provides a two-panel chat layout where instructors can:
- See all conversation rooms (one per student)
- Click a room to load and view the full message thread
- Send new messages to students
- Search/filter rooms by student name
- See unread message badges per room
- Messages auto-mark as read when a room is opened

---

## 2. Responsibility

- Fetch all message rooms (conversations): `GET /instructor/messages/rooms`
- Fetch messages for a specific room: `GET /instructor/messages/{roomId}`
- Send a new message: `POST /instructor/messages/{roomId}`
- Mark messages as read: `POST /instructor/messages/{roomId}/read`
- Render rooms list with last message preview and unread count badge
- Render chat messages with sender-side alignment (sent = right, received = left)
- Filter rooms by student name via debounced search
- Show relative timestamps ("2m", "3h", "Apr 1")

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icons |
| `Chart.js 4.4.1` | Loaded but **not used** on this page |

### Local CSS / JS
Same standard set: `variables.css`, `reset.css`, `global.css`, `components.css`, `layout.css`, `utils.js`, `store.js`, `api.js`, `auth.js`, `init.js`.

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode restoration.

### Step 2 — Auth Guard (IIFE)
Standard instructor check.

### Step 3 — DOMContentLoaded Setup
Standard app shell wiring + helpers (`_esc`, `showToast`, `openModal`, `closeModal`).

### Step 4 — Module-Level State
```js
var allRooms = [];           // All loaded conversation rooms
var activeRoomId = null;     // Currently selected room ID
var userId = (function() {
  try { var u = JSON.parse(localStorage.getItem('ev_user')); return u ? u.id : null; }
  catch(e) { return null; }
})();
```
`userId` is resolved immediately from localStorage — used to determine message alignment (sent vs received).

### Step 5 — `loadRooms()` — Fetch All Conversations
```js
async function loadRooms() {
  var res = await Api.get('/instructor/messages/rooms');
  allRooms = (res && res.data) || [];
  renderRooms(allRooms);
}
```
Stores all rooms in `allRooms` for use in client-side search filtering.

### Step 6 — `renderRooms(rooms)` — Room List Rendering
For each room, builds HTML showing:
- Avatar initials (computed from `other_user_name`)
- Room name, last message preview (truncated)
- Relative time of last message
- Unread count badge (if > 0)
- Clicking a room → `openRoom(id)`
- Active room highlighted with `.active` class

### Step 7 — `openRoom(roomId)` — Open a Conversation
```js
window.openRoom = async function(roomId) {
  activeRoomId = roomId;
  // Show chat-active panel, hide chat-empty panel
  // Fetch messages: GET /instructor/messages/{roomId}
  // renderMessages(msgs)
  // Mark as read: POST /instructor/messages/{roomId}/read
  // Reload rooms (updates unread badge)
}
```

### Step 8 — `renderMessages(msgs)` — Message Thread
For each message:
- `mine` is `true` if `m.sender_id == userId` OR `m.is_mine`
- Sent messages: aligned `flex-end` with `.msg-sent` class
- Received messages: aligned `flex-start` with `.msg-recv` class
- After rendering, `scrollTop = scrollHeight` auto-scrolls to latest message

### Step 9 — `sendMessage()` — Send Handler
```js
async function sendMessage() {
  var text = input.value.trim();
  if (!text || !activeRoomId) return;
  input.value = '';
  try {
    await Api.post('/instructor/messages/' + activeRoomId, { content: text });
    var res = await Api.get('/instructor/messages/' + activeRoomId);
    renderMessages((res.data.messages) || (res.data) || []);
  } catch(e) {
    input.value = text; // Restore text on failure
  }
}
```
On failure, the original text is restored to the input (non-destructive failure).

### Step 10 — Search/Filter
```js
document.getElementById('room-search').addEventListener('input', function() {
  clearTimeout(sd);
  var q = this.value.toLowerCase();
  sd = setTimeout(function() {
    renderRooms(allRooms.filter(function(r) {
      return (r.other_user_name || r.name || '').toLowerCase().includes(q);
    }));
  }, 200);
});
```
Debounced (200ms) client-side filter on `allRooms` by student name.

---

## 5. Functions / Methods

### `loadRooms()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch all conversation rooms |
| **API Call** | `GET /instructor/messages/rooms` |
| **Side Effects** | Populates `allRooms`, calls `renderRooms()` |
| **On Error** | Sets `#rooms-list` to "Failed to load." message |

---

### `renderRooms(rooms)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render conversation room list in `#rooms-list` |
| **Parameters** | `rooms` — array of room objects |
| **Returns** | `void` |

**Room object expected fields:**
- `id` — room ID
- `other_user_name` or `name` — display name of student
- `last_message.content` — preview text
- `last_message.created_at` — timestamp for relative display
- `unread_count` — number of unread messages

---

### `openRoom(roomId)` — `window.openRoom` async

| Property | Detail |
|---|---|
| **Purpose** | Load and display messages for a specific conversation |
| **Parameters** | `roomId` (number) |
| **API Calls** | `GET /instructor/messages/{roomId}`, `POST /instructor/messages/{roomId}/read` |
| **Side Effects** | Sets `activeRoomId`, updates room list active state, updates chat header, calls `renderMessages()`, reloads rooms for badge update |

---

### `renderMessages(msgs)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render message bubbles in `#chat-messages` |
| **Parameters** | `msgs` — array of message objects |
| **Returns** | `void` |
| **Alignment** | Sent (`.msg-sent`) = right; Received (`.msg-recv`) = left |
| **Auto-scroll** | `c.scrollTop = c.scrollHeight` after rendering |

**Message object expected fields:**
- `sender_id` — compared to `userId` to determine sent/received
- `is_mine` — fallback boolean flag
- `content` — message text
- `created_at` — timestamp for `timeAgo()`

---

### `sendMessage()` — async function

| Property | Detail |
|---|---|
| **Purpose** | Send a message and refresh the conversation |
| **API Calls** | `POST /instructor/messages/{roomId}` then `GET /instructor/messages/{roomId}` |
| **Validation** | Skips if `text` is empty or `activeRoomId` is null |
| **On failure** | Restores input text (no toast shown) |

---

### `timeAgo(d)` — pure function

| Property | Detail |
|---|---|
| **Purpose** | Convert a Date to a human-readable relative string |
| **Parameters** | `d` — Date object |
| **Returns** | `'now'`, `'5m'`, `'3h'`, or formatted date string |
| **Logic** | < 60s → "now", < 1h → "Xm", < 24h → "Xh", else → `toLocaleDateString('en-IN', ...)` |

---

## 6. API Role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/instructor/messages/rooms` | Get all conversation rooms for instructor |
| `GET` | `/instructor/messages/{roomId}` | Get messages in a specific room |
| `POST` | `/instructor/messages/{roomId}` | Send a message to a room |
| `POST` | `/instructor/messages/{roomId}/read` | Mark messages in room as read |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        └── Messaging layout (2-col: rooms | chat)
            ├── Left panel — Rooms list
            │   ├── Header: "Messages" + search input
            │   └── #rooms-list
            │       └── .room-item (per conversation)
            │           ├── .room-avatar    ← Initials
            │           ├── .room-info      ← Name + last message preview
            │           └── .room-meta      ← Time + unread badge
            └── Right panel — Chat window
                ├── #chat-empty     ← "Select a conversation" placeholder
                └── #chat-active    ← Active conversation
                    ├── #chat-header        ← Student avatar + name
                    ├── #chat-messages      ← Scrollable message thread
                    └── Message input row
                        ├── #chat-input    ← Textarea
                        └── #send-btn      ← Send button
```

### Message Bubble Classes

| Class | Meaning |
|---|---|
| `.msg-sent` | Instructor's own messages (right-aligned) |
| `.msg-recv` | Student's messages (left-aligned) |
| `.msg-time` | Relative timestamp below bubble |

---

## 8. Data Flow

```
Page Load
    → loadRooms() → GET /instructor/messages/rooms
    → renderRooms(allRooms) → #rooms-list

User clicks a room
    → openRoom(roomId)
        → GET /instructor/messages/{roomId}
        → renderMessages(msgs)     → #chat-messages (scroll to bottom)
        → POST .../read            → mark as read
        → loadRooms()              → update unread badges

User types + Enter / clicks Send
    → sendMessage()
        → POST /instructor/messages/{roomId} { content }
        → GET /instructor/messages/{roomId}  (refresh)
        → renderMessages()

User types in search box
    → debounce 200ms
    → renderRooms(allRooms.filter by name)
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | All API calls |
| `utils.js` | (not directly called but loaded) |
| `store.js` | State utilities |
| `localStorage` | `ev_user` for `userId` resolution |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `loadRooms()` fails | `#rooms-list` set to "Failed to load." message |
| `openRoom()` messages fetch fails | `#chat-messages` set to red "Failed to load." message |
| `sendMessage()` fails | Input text restored; no toast shown |
| Mark-as-read fails | `try/catch` swallows error silently — non-critical |
| Empty message input | `sendMessage()` returns early if `!text` |
| No active room | `sendMessage()` returns early if `!activeRoomId` |
| No conversations | `#rooms-list` shows "No conversations yet." |
| No messages in room | `#chat-messages` shows "No messages yet." |

---

## 11. Edge Cases / Notes

- **Sender identification**: The `is_mine` field from the API is used as a fallback alongside `m.sender_id == userId`. This handles cases where `sender_id` is not returned by the backend.
- **No polling / WebSocket**: This implementation uses standard REST polling — messages are only refreshed when explicitly triggered (on `openRoom` or after `sendMessage`). There is no automatic refresh interval or WebSocket connection.
- **Search is client-side**: The room search filters from `allRooms` (already fetched) without re-calling the API.
- **Read receipt is non-blocking**: The mark-as-read POST is wrapped in its own `try/catch` and does not affect the message rendering flow if it fails.
- **After sending**: The page re-fetches messages via GET after a successful POST, rather than optimistically appending the sent message. This ensures sync with the backend but adds a round-trip.
- **Initials from name**: Computed as first+last word initials using `reduce()` — same pattern used in sidebar/navbar avatar across all portal pages.
- **`Chart.js` is loaded but unused**: This is a shared script tag present across multiple portal pages.

---

## 12. Summary

`messages.html` is the **Instructor Messaging page** of the EduVerse Portal. It implements a two-panel chat UI with a rooms list on the left and a message thread on the right. It supports viewing all student conversations, sending messages, auto-marking rooms as read on open, and searching rooms by student name. The implementation uses standard REST polling rather than real-time sockets. Sent messages are identified by comparing `sender_id` to the current user's `id` from localStorage. The chat input supports both Enter key and button-click submission.
