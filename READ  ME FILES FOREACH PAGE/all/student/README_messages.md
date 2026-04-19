# `messages.html` — Messages

## Overview

`messages.html` is the **messaging page** of the EduVerse Student Portal. It provides a two-panel chat interface: a left panel listing all conversation rooms (threads), and a right panel showing the active conversation with message bubbles and a compose bar. Students can send messages to instructors and peers, and unread counts are shown on each room.

---

## File Location

```
pages/student/messages.html
```

---

## Authentication & Access Control

Standard synchronous student guard before render.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Send icon, search icon |
| Google Fonts — Inter | latest | UI typography |

### Internal JS

```html
<script>window.EV_BASE="../../";</script>
<script src="../../js/utils.js"></script>
<script src="../../js/sidebar.js"></script>
<script src="../../js/store.js"></script>
<script src="../../js/api.js"></script>
<script src="../../js/auth.js"></script>
<script src="../../js/router.js"></script>
<script src="../../js/init.js"></script>
<!-- inline page script -->
```

---

## Layout Structure

```
.app-shell
├── .app-sidebar
└── .app-body
    ├── .app-navbar
    └── .app-main
        └── .page-content
            └── .messages-layout      ← CSS grid (300px 1fr)
                ├── .rooms-panel      ← conversation list
                │   ├── .rooms-search ← search input
                │   └── #rooms-list   ← room items
                └── .chat-panel
                    ├── #chat-empty   ← placeholder before selection
                    └── #chat-active  ← active conversation
                        ├── #chat-header   ← avatar + name
                        ├── #chat-messages ← message bubbles
                        └── .chat-compose  ← input + send button
```

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `allRooms` | `Array` | All conversation rooms from API |
| `activeRoomId` | `number \| null` | Currently open room ID |
| `user` | `Object` | Current student from localStorage |

---

## API Calls

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `loadRooms()` | `GET` | `/messages/rooms` | Fetch all conversation rooms |
| `openRoom(roomId)` | `GET` | `/messages/:roomId/messages?limit=50` | Fetch messages for a room |
| `openRoom(roomId)` | `POST` | `/messages/:roomId/read` | Mark room as read |
| `sendMessage()` | `POST` | `/messages/:roomId/send` | Send a new message |

---

## Response Shapes

### `GET /messages/rooms`

```json
{
  "data": [
    {
      "id": 3,
      "other_user_name": "Prof. Mehta",
      "last_message": {
        "content": "Please review chapter 4.",
        "created_at": "2025-09-10T14:30:00Z"
      },
      "unread_count": 2
    }
  ]
}
```

### `GET /messages/:roomId/messages`

```json
{
  "data": {
    "messages": [
      {
        "id": 101,
        "content": "Hello!",
        "sender_id": 7,
        "is_mine": false,
        "created_at": "2025-09-10T14:25:00Z"
      }
    ]
  }
}
```

> Note: The client also handles `res.data` as a flat array (fallback): `(res.data.messages) || (res.data) || []`

---

## Room List (`.room-item`)

Each conversation room renders as:

| Element | Content |
|---|---|
| `.room-avatar` | Initials of the other participant (first + last initial) |
| `.room-name` | Other user's name |
| `.room-last` | Last message content (escaped) |
| `.room-time` | `Utils.timeAgo(last_message.created_at)` |
| `.room-badge` | Unread count badge (hidden if 0) |

Active room is highlighted with `.active` class.

Initials are computed as first character of first word + first character of last word:

```js
var ini = name.trim().split(/\s+/).reduce(function(a, p, i, arr) {
  return (i === 0 || i === arr.length - 1) ? a + p[0].toUpperCase() : a;
}, '');
```

---

## Chat Panel

### Empty State (`#chat-empty`)

Shown when no room is selected:
```html
<div id="chat-empty">
  <div style="font-size:3rem;">💬</div>
  <div>Select a conversation to start messaging</div>
</div>
```

### Active Chat (`#chat-active`)

Visible after a room is opened. Contains:

**Chat Header (`#chat-header`)** — Avatar + name of conversation partner

**Message Bubbles (`#chat-messages`)**

```html
<!-- Sent (mine) -->
<div class="msg-bubble msg-sent">Hello there!</div>

<!-- Received (theirs) -->
<div class="msg-bubble msg-recv">Hi, how can I help?</div>
```

Aligned using `align-items: flex-end` (sent) vs `flex-start` (received).

Message ownership is determined by:
```js
var mine = (m.sender_id == user.id) || m.is_mine;
```

**Compose Bar (`.chat-compose`)**
```html
<input id="chat-input" type="text" placeholder="Type a message…" />
<button onclick="sendMessage()">
  <i data-feather="send"></i>
</button>
```

Enter key also triggers `sendMessage()`.

---

## Open Room Flow

```
User clicks a room item
    ↓
openRoom(roomId)
    ↓
1. Highlight active room in list (toggle .active)
2. Show chat panel, set header (avatar + name)
3. Show skeleton in #chat-messages
    ↓
Api.messages.messages(roomId, { limit: 50 })
    ↓
renderMessages(msgs)   ← message bubbles rendered
    ↓
container.scrollTop = container.scrollHeight  ← auto-scroll to bottom
    ↓
Api.messages.markRead(roomId)   ← clear unread count
    ↓
loadRooms()   ← refresh room list to update unread badges
```

---

## Send Message Flow

```
User types + clicks Send (or presses Enter)
    ↓
sendMessage()
    ↓
Read input value, validate non-empty + activeRoomId set
    ↓
Clear input immediately (optimistic UX)
    ↓
Api.messages.send(activeRoomId, { content: text })
    ↓
Re-fetch: Api.messages.messages(activeRoomId, { limit: 50 })
    ↓
renderMessages(msgs)   ← updated message list
    ↓
Auto-scroll to bottom
```

---

## XSS Prevention

All message content and user names are escaped:
```js
function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')...; }
```

Applied to: room names, last message preview, message content, chat header.

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.messages-layout` | Two-column grid (rooms + chat) |
| `.rooms-panel` | Left room list panel |
| `.room-item` | Individual conversation row |
| `.room-item.active` | Highlighted selected room |
| `.room-avatar` | Initials circle |
| `.room-badge` | Unread count pill |
| `.room-time` | Relative time |
| `.chat-panel` | Right chat area |
| `.chat-compose` | Input + send button bar |
| `.msg-bubble` | Message bubble base |
| `.msg-sent` | Right-aligned (student's message) |
| `.msg-recv` | Left-aligned (other person's message) |
| `.msg-time` | Timestamp below bubble |

---

## Error Handling

| Failure | Behaviour |
|---|---|
| `loadRooms()` fails | Shows "Failed to load conversations." in rooms panel |
| `openRoom()` messages fail | Shows "Failed to load messages." in chat area |
| `sendMessage()` fails | No explicit toast (input is already cleared — consider adding error feedback) |

---

## Notes for Developers

- Messages are **re-fetched** (not pushed) after sending. For real-time updates, integrate WebSockets or SSE.
- The room list is also re-fetched after marking as read, ensuring unread counts are immediately updated.
- `limit: 50` is hard-coded — pagination for long conversations is not implemented. Add `offset`/`page` support for chat history scrolling.
- Room search (if a search input exists in `.rooms-search`) filters the `allRooms` array client-side.
