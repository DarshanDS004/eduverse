# Socket.io Handlers — Complete Documentation

---

# SOCKET INDEX.JS

## 1. FILE OVERVIEW

**File Name:** `index.js`  
**File Type:** Socket.io Server Configuration  
**Location:** `socket/index.js`  
**Purpose:** Initialize Socket.io with authentication, manage online users, and register all handlers.

---

## 2. RESPONSIBILITY

- **JWT Authentication** — Verify token before accepting connections
- **Online User Tracking** — Map userId → socket IDs
- **User Rooms** — Auto-join personal room for notifications
- **Handler Registration** — Wire up chat, notifications, exams, live sessions
- **Keep-Alive** — Ping/pong for connection health

---

## 3. ARCHITECTURE

### Online Users Map
```javascript
const onlineUsers = new Map();
// Structure:
// userId → Set<socketId>
// Example:
// 100 → { 'socket_1', 'socket_2' }  (user 100 logged in from 2 devices)
// 101 → { 'socket_3' }
```

**Why Set?** User can have multiple socket connections (multiple tabs, devices).

---

## 4. AUTHENTICATION MIDDLEWARE

```javascript
io.use(async (socket, next) => {
  try {
    // Get token from auth header or query
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) return next(new Error('Authentication required.'));

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: decoded.id, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    next(new Error('Invalid or expired token.'));
  }
});
```

**Token Sources:**
1. `socket.handshake.auth.token` — Passed in client options
2. `Authorization: Bearer <token>` header

**Rejection Causes:**
- No token provided → "Authentication required."
- Invalid token → "Invalid or expired token."
- Expired token → "Invalid or expired token."

---

## 5. CONNECTION FLOW

### On Connect

```javascript
io.on('connection', (socket) => {
  const { id: userId, role } = socket.user;

  console.log(`[Socket] Connected: user=${userId} role=${role} socket=${socket.id}`);

  // 1. Track online user
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // 2. Join personal room (for targeted notifications)
  socket.join(`user:${userId}`);

  // 3. Join role room (for role-based broadcasts)
  socket.join(`role:${role}`);

  // 4. Update last login
  db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]);

  // 5. Register handlers
  chatHandler(io, socket, onlineUsers);
  notifHandler(io, socket);
  liveSessionHandler(io, socket);
  examHandler(io, socket);

  // 6. Broadcast user online
  socket.broadcast.emit('user:online', { user_id: userId });

  // 7. Send unread notification count
  db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  ).then(([[row]]) => {
    socket.emit('notification:count', { unread: row.count });
  });
});
```

**Steps:**
1. Add socket to online map
2. Join `user:{userId}` room → for private messages
3. Join `role:{role}` room → for role broadcasts
4. Update last_login_at in DB
5. Initialize all event handlers
6. Notify others that user came online
7. Send unread notification count to user

---

### On Disconnect

```javascript
socket.on('disconnect', (reason) => {
  console.log(`[Socket] Disconnected: user=${userId} reason=${reason}`);

  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      onlineUsers.delete(userId);
      socket.broadcast.emit('user:offline', { user_id: userId });
    }
  }
});
```

**Logic:**
- Remove socket from user's set
- If user has no more sockets → broadcast offline event
- Clean up map entry

**Disconnect Reasons:**
- `'client namespace disconnect'` — User closed browser
- `'server namespace disconnect'` — Server shutting down
- `'ping timeout'` — Client didn't respond to ping
- `'transport close'` — Network dropped

---

### Keep-Alive Mechanism

```javascript
socket.on('ping', () => {
  socket.emit('pong', { time: Date.now() });
});
```

**Client initiates ping periodically** → server responds with pong.

If no pong received → client knows connection lost.

---

## 6. HELPER METHODS

### `io.sendToUser(userId, event, data)`

**Purpose:** Send event to specific user (all devices).

**Example:**
```javascript
io.sendToUser(100, 'notification:new', {
  title: 'Assignment Graded',
  body: 'Your assignment has been graded'
});
```

**Implementation:**
```javascript
io.sendToUser = function (userId, event, data) {
  io.to(`user:${userId}`).emit(event, data);
};
```

**Reaches:** All sockets in `user:{userId}` room (all devices).

---

### `io.sendToRole(role, event, data)`

**Purpose:** Broadcast to all users with specific role.

**Example:**
```javascript
io.sendToRole('instructor', 'announcement', {
  message: 'Exam date announced'
});
```

**Implementation:**
```javascript
io.sendToRole = function (role, event, data) {
  io.to(`role:${role}`).emit(event, data);
};
```

**Reaches:** All sockets in `role:{role}` room.

---

### `io.isOnline(userId)`

**Purpose:** Check if user is currently online.

**Example:**
```javascript
if (io.isOnline(userId)) {
  // Send real-time notification
} else {
  // Save as in-app notification
}
```

**Implementation:**
```javascript
io.isOnline = function (userId) {
  return onlineUsers.has(userId);
};
```

---

## 7. EXPORTS

```javascript
module.exports = { initSocket, onlineUsers };
```

- `initSocket(io)` — Initialization function
- `onlineUsers` — Map of online users

---

## 8. SUMMARY

**socket/index.js** provides:

1. **JWT Authentication** — Verify tokens before accepting connections
2. **Online User Tracking** — Know who's connected
3. **Room Management** — Personal rooms for DMs, role rooms for broadcasts
4. **Handler Registration** — Wire up all handlers in one place
5. **Helper Methods** — Send to user, role, check online status
6. **Keep-Alive** — Ping/pong to detect disconnects

**Key Design:** Handlers are modular; index.js registers them all.

---

# CHAT.SOCKET.JS

## 1. FILE OVERVIEW

**File Name:** `chat.socket.js`  
**File Type:** Socket.io Event Handler  
**Purpose:** Handle real-time direct messaging between users.

---

## 2. EVENTS

### `chat:join`

**Purpose:** Student/parent joins chat room (one-to-one conversation).

**Emitted By:** Client when opening DM

**Payload:**
```javascript
socket.emit('chat:join', { room_id: 123 });
```

**Server Logic:**
```javascript
socket.on('chat:join', async ({ room_id }) => {
  // 1. Verify user is in this room
  const [[room]] = await db.query(
    'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [room_id, userId, userId]
  );
  if (!room) return;  // Deny if not authorized

  // 2. Join room
  socket.join(`room:${room_id}`);

  // 3. Mark messages as read
  await db.query(
    'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?',
    [room_id, userId]
  );
});
```

**Security:** Verifies user is one of the two participants.

---

### `chat:send`

**Purpose:** Send message in room.

**Emitted By:** Client

**Payload:**
```javascript
socket.emit('chat:send', {
  room_id: 123,
  content: "Hey, how are you?"
});
```

**Server Logic:**

```javascript
socket.on('chat:send', async ({ room_id, content }) => {
  // 1. Validate
  if (!content?.trim()) return;

  // 2. Verify room membership
  const [[room]] = await db.query(
    'SELECT id, user_one_id, user_two_id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
    [room_id, userId, userId]
  );
  if (!room) return;

  // 3. Save to DB
  const [result] = await db.query(
    'INSERT INTO messages (room_id, sender_id, content) VALUES (?, ?, ?)',
    [room_id, userId, content.trim()]
  );

  // 4. Update room timestamp
  await db.query(
    'UPDATE message_rooms SET updated_at = NOW() WHERE id = ?',
    [room_id]
  );

  // 5. Get sender info
  const [[sender]] = await db.query(
    'SELECT full_name, photo_url FROM user_profiles WHERE user_id = ?',
    [userId]
  );

  // 6. Create message object
  const message = {
    id: result.insertId,
    room_id,
    sender_id: userId,
    sender_name: sender?.full_name,
    sender_avatar: sender?.photo_url,
    content: content.trim(),
    is_read: false,
    created_at: new Date().toISOString(),
  };

  // 7. Broadcast to room (all participants see immediately)
  io.to(`room:${room_id}`).emit('chat:receive', message);

  // 8. If receiver offline, create notification
  const receiverId = room.user_one_id === userId ? room.user_two_id : room.user_one_id;
  const isOnline = onlineUsers.has(receiverId);

  if (!isOnline) {
    await db.query(
      "INSERT INTO notifications (user_id, title, body, type) VALUES (?, ?, ?, 'message')",
      [receiverId, `New message from ${sender?.full_name}`, content.trim().slice(0, 100)]
    );
  }

  // 9. Send notification count update
  const [[countRow]] = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [receiverId]
  );
  io.to(`user:${receiverId}`).emit('notification:count', { unread: countRow.count });
});
```

**Database Schema:**
| Table | Fields |
|-------|--------|
| message_rooms | id, user_one_id, user_two_id, updated_at |
| messages | id, room_id, sender_id, content, is_read, created_at |
| notifications | user_id, title, body, type, is_read |

---

### `chat:typing` & `chat:stop-typing`

**Purpose:** Show typing indicator.

**Emitted By:** Client when user starts/stops typing

**Payload:**
```javascript
socket.emit('chat:typing', { room_id: 123 });
socket.emit('chat:stop-typing', { room_id: 123 });
```

**Server Logic:**
```javascript
socket.on('chat:typing', ({ room_id }) => {
  socket.to(`room:${room_id}`).emit('chat:typing', { from: userId, room_id });
});

socket.on('chat:stop-typing', ({ room_id }) => {
  socket.to(`room:${room_id}`).emit('chat:stop-typing', { from: userId, room_id });
});
```

**Note:** `socket.to()` = broadcast to others in room (exclude sender).

---

### `chat:read`

**Purpose:** Mark messages in room as read.

**Emitted By:** Client when viewing room

**Payload:**
```javascript
socket.emit('chat:read', { room_id: 123 });
```

**Server Logic:**
```javascript
socket.on('chat:read', async ({ room_id }) => {
  // Mark all messages from others as read
  await db.query(
    'UPDATE messages SET is_read = 1 WHERE room_id = ? AND sender_id != ?',
    [room_id, userId]
  );
  // Notify room that messages are read
  socket.to(`room:${room_id}`).emit('chat:read', { room_id, read_by: userId });
});
```

---

## 3. CLIENT SIDE (Example)

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'jwt_token_here' }
});

// Join room
socket.emit('chat:join', { room_id: 123 });

// Listen for new messages
socket.on('chat:receive', (message) => {
  console.log(`${message.sender_name}: ${message.content}`);
  addMessageToUI(message);
});

// Listen for typing indicator
socket.on('chat:typing', ({ from }) => {
  showTypingIndicator(from);
});

socket.on('chat:stop-typing', ({ from }) => {
  hideTypingIndicator(from);
});

// Send message
const content = 'Hello!';
socket.emit('chat:send', { room_id: 123, content });

// Mark as read
socket.emit('chat:read', { room_id: 123 });
```

---

## 4. SUMMARY

**chat.socket.js** provides:

1. **Direct Messaging** — One-to-one conversations
2. **Typing Indicators** — See when someone is typing
3. **Read Status** — Know who's read messages
4. **Offline Notifications** — Save notif if receiver offline
5. **Security** — Verify room membership

---

# EXAM.SOCKET.JS

## 1. FILE OVERVIEW

**File Name:** `exam.socket.js`  
**File Type:** Socket.io Event Handler  
**Purpose:** Real-time exam monitoring with tab-switch detection and instructor oversight.

---

## 2. EVENTS

### `exam:join`

**Purpose:** Student joins exam (starts quiz).

**Emitted By:** Client when starting quiz

**Payload:**
```javascript
socket.emit('exam:join', { quiz_id: 42 });
```

**Server Logic:**
```javascript
socket.on('exam:join', async ({ quiz_id }) => {
  const room = `exam:${quiz_id}`;
  socket.join(room);

  const [[student]] = await db.query(
    'SELECT full_name FROM user_profiles WHERE user_id = ?', [userId]
  );

  // Notify instructors monitoring this exam
  io.to(`exam-monitor:${quiz_id}`).emit('exam:student-joined', {
    student_id: userId,
    student_name: student?.full_name,
    time: new Date().toISOString(),
  });

  console.log(`[Socket] Student ${userId} joined exam:${quiz_id}`);
});
```

**Broadcast To:** `exam-monitor:{quiz_id}` room (instructors monitoring).

---

### `exam:monitor`

**Purpose:** Instructor joins exam monitor room.

**Emitted By:** Instructor opening exam dashboard

**Payload:**
```javascript
socket.emit('exam:monitor', { quiz_id: 42 });
```

**Server Logic:**
```javascript
socket.on('exam:monitor', ({ quiz_id }) => {
  // Role check
  if (role !== 'instructor' && role !== 'institute' && role !== 'superadmin') return;
  
  socket.join(`exam-monitor:${quiz_id}`);
  console.log(`[Socket] Instructor ${userId} monitoring exam:${quiz_id}`);
});
```

**Access Control:** Only instructors/institutes/superadmins allowed.

---

### `exam:tab-switch`

**Purpose:** Student switched browser tabs (detected on client).

**Emitted By:** Client detecting focus loss

**Payload:**
```javascript
socket.emit('exam:tab-switch', { quiz_id: 42, attempt_id: 100 });
```

**Server Logic:**
```javascript
socket.on('exam:tab-switch', async ({ quiz_id, attempt_id }) => {
  // Log to audit
  await db.query(
    "INSERT INTO audit_logs (user_id, action, reference_type, reference_id) VALUES (?, 'exam_tab_switch', 'quiz_attempt', ?)",
    [userId, attempt_id]
  );

  const [[student]] = await db.query(
    'SELECT full_name FROM user_profiles WHERE user_id = ?', [userId]
  );

  // Alert instructors
  io.to(`exam-monitor:${quiz_id}`).emit('exam:tab-switch-alert', {
    student_id: userId,
    student_name: student?.full_name,
    attempt_id,
    time: new Date().toISOString(),
  });
});
```

**Use Case:** Detect cheating (copying from other sources).

---

### `exam:submit`

**Purpose:** Student submits quiz.

**Emitted By:** Client when clicking submit

**Payload:**
```javascript
socket.emit('exam:submit', { quiz_id: 42, attempt_id: 100, score: 80, total: 100 });
```

**Server Logic:**
```javascript
socket.on('exam:submit', async ({ quiz_id, attempt_id, score, total }) => {
  const [[student]] = await db.query(
    'SELECT full_name FROM user_profiles WHERE user_id = ?', [userId]
  );

  io.to(`exam-monitor:${quiz_id}`).emit('exam:student-submitted', {
    student_id: userId,
    student_name: student?.full_name,
    attempt_id,
    score,
    total,
    time: new Date().toISOString(),
  });
});
```

**Broadcast To:** Instructors see submission in real-time.

---

### `progress:video-update`

**Purpose:** Track video watching progress in real-time.

**Emitted By:** Client every 10-30 seconds while watching

**Payload:**
```javascript
socket.emit('progress:video-update', {
  video_id: 5,
  course_id: 42,
  watched_seconds: 120,
  completed: false
});
```

**Server Logic:**

```javascript
socket.on('progress:video-update', async ({ video_id, course_id, watched_seconds, completed }) => {
  // 1. Upsert video progress
  await db.query(`
    INSERT INTO video_progress (student_id, video_id, watched_seconds, completed, last_watched_at)
    VALUES (?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      watched_seconds = GREATEST(watched_seconds, ?),
      completed = GREATEST(completed, ?),
      last_watched_at = NOW()
  `, [userId, video_id, watched_seconds, completed ? 1 : 0, watched_seconds, completed ? 1 : 0]);

  // 2. Recalculate course completion
  if (course_id) {
    const [[total]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM videos v
       JOIN course_modules cm ON cm.id = v.module_id WHERE cm.course_id = ?`,
      [course_id]
    );
    const [[completed_]] = await db.query(
      `SELECT COUNT(*) AS cnt FROM video_progress vp
       JOIN videos v ON v.id = vp.video_id
       JOIN course_modules cm ON cm.id = v.module_id
       WHERE cm.course_id = ? AND vp.student_id = ? AND vp.completed = 1`,
      [course_id, userId]
    );

    const pct = total.cnt > 0
      ? Math.round((completed_.cnt / total.cnt) * 100)
      : 0;

    // 3. Update course progress
    await db.query(`
      INSERT INTO course_progress (student_id, course_id, completion_percentage, last_activity_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        completion_percentage = ?,
        last_activity_at = NOW(),
        completed_at = IF(? = 100 AND completed_at IS NULL, NOW(), completed_at)
    `, [userId, course_id, pct, pct, pct]);

    // 4. Emit progress to student
    socket.emit('progress:updated', { course_id, percentage: pct });

    // 5. Auto-issue certificate if 100%
    if (pct === 100) {
      const [[existing]] = await db.query(
        'SELECT id FROM certificates WHERE student_id = ? AND course_id = ?',
        [userId, course_id]
      );
      if (!existing) {
        const { v4: uuidv4 } = require('uuid');
        const [[course]] = await db.query('SELECT title FROM courses WHERE id = ?', [course_id]);
        const code = uuidv4().replace(/-/g, '').toUpperCase().slice(0, 16);
        await db.query(
          "INSERT INTO certificates (student_id, course_id, title, certificate_code, type) VALUES (?, ?, ?, ?, 'course_completion')",
          [userId, course_id, `${course?.title} — Certificate of Completion`, code]
        );
        socket.emit('notification:new', {
          title: '🎉 Certificate Earned!',
          body: `You completed "${course?.title}" and earned a certificate!`,
          type: 'certificate',
        });
      }
    }
  }
});
```

**Features:**
- Uses `ON DUPLICATE KEY UPDATE` for upsert
- `GREATEST()` prevents rollback of progress
- Auto-calculates course completion %
- Auto-issues certificate at 100%
- Emits certificate notification

---

## 3. DATABASE SCHEMA

| Table | Fields |
|-------|--------|
| video_progress | student_id, video_id, watched_seconds, completed, last_watched_at |
| course_progress | student_id, course_id, completion_percentage, last_activity_at, completed_at |
| certificates | student_id, course_id, title, certificate_code, type |
| audit_logs | user_id, action, reference_type, reference_id |

---

## 4. SUMMARY

**exam.socket.js** provides:

1. **Exam Monitoring** — Instructors see students taking exams
2. **Tab-Switch Detection** — Log suspicious activity
3. **Real-Time Submission** — See scores as submitted
4. **Video Progress Tracking** — Automatic completion calculation
5. **Certificate Auto-Issue** — When 100% complete

---

# NOTIFICATION.SOCKET.JS & LIVE-SESSION.SOCKET.JS

## 1. FILE OVERVIEW

**File Name:** `notification.socket.js` & `live-session.socket.js`  
**File Type:** Socket.io Event Handlers  
**Purpose:** 
- Notifications: Manage unread count, mark as read
- Live Sessions: Real-time classroom with chat, polls, hand raise

---

## 2. NOTIFICATION EVENTS

### `notification:get-count`

**Purpose:** Fetch unread notification count.

**Server Logic:**
```javascript
socket.on('notification:get-count', async () => {
  const [[row]] = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  socket.emit('notification:count', { unread: row.count });
});
```

---

### `notification:mark-all-read`

**Purpose:** Mark all notifications as read.

**Server Logic:**
```javascript
socket.on('notification:mark-all-read', async () => {
  await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  socket.emit('notification:count', { unread: 0 });
});
```

---

### `notification:mark-read`

**Purpose:** Mark specific notification as read.

**Server Logic:**
```javascript
socket.on('notification:mark-read', async ({ notification_id }) => {
  await db.query(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notification_id, userId]
  );
  const [[row]] = await db.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  socket.emit('notification:count', { unread: row.count });
});
```

---

## 3. LIVE SESSION EVENTS

### `session:join` & `session:leave`

**Purpose:** Join/leave live classroom session.

**Server Logic:**
```javascript
socket.on('session:join', ({ session_id }) => {
  const room = `session:${session_id}`;
  socket.join(room);
  socket.to(room).emit('session:participant-joined', {
    user_id: userId,
    role,
    time: new Date().toISOString(),
  });
});

socket.on('session:leave', ({ session_id }) => {
  const room = `session:${session_id}`;
  socket.leave(room);
  socket.to(room).emit('session:participant-left', {
    user_id: userId,
    time: new Date().toISOString(),
  });
});
```

---

### `session:send-message`

**Purpose:** Send message in live session chat.

**Server Logic:**
```javascript
socket.on('session:send-message', ({ session_id, text }) => {
  if (!text?.trim()) return;
  io.to(`session:${session_id}`).emit('session:message', {
    from: userId,
    role,
    text: text.trim(),
    time: new Date().toISOString(),
  });
});
```

---

### `session:raise-hand` & `session:lower-hand`

**Purpose:** Student indicates need for help.

**Server Logic:**
```javascript
socket.on('session:raise-hand', ({ session_id }) => {
  io.to(`session:${session_id}`).emit('session:hand-raised', {
    user_id: userId,
    time: new Date().toISOString(),
  });
});

socket.on('session:lower-hand', ({ session_id }) => {
  io.to(`session:${session_id}`).emit('session:hand-lowered', {
    user_id: userId,
  });
});
```

---

### `session:send-poll` & `session:poll-answer`

**Purpose:** Instructor sends poll; students answer.

**Server Logic:**
```javascript
socket.on('session:send-poll', ({ session_id, question, options }) => {
  if (role !== 'instructor' && role !== 'institute') return;
  io.to(`session:${session_id}`).emit('session:poll', {
    question,
    options,
    time: new Date().toISOString(),
  });
});

socket.on('session:poll-answer', ({ session_id, option_index }) => {
  io.to(`session:${session_id}`).emit('session:poll-result', {
    user_id: userId,
    option_index,
  });
});
```

---

### `session:end`

**Purpose:** Instructor ends session.

**Server Logic:**
```javascript
socket.on('session:end', ({ session_id }) => {
  if (role !== 'instructor' && role !== 'institute') return;
  io.to(`session:${session_id}`).emit('session:ended', {
    ended_by: userId,
    time: new Date().toISOString(),
  });
});
```

---

## 4. CLIENT EXAMPLE (Live Session)

```javascript
// Join session
socket.emit('session:join', { session_id: 100 });

// Listen for participants
socket.on('session:participant-joined', ({ user_id, role }) => {
  console.log(`${user_id} (${role}) joined`);
  addParticipantToUI(user_id);
});

// Send message
socket.emit('session:send-message', { session_id: 100, text: 'Hello class!' });

// Listen for messages
socket.on('session:message', ({ from, role, text }) => {
  console.log(`${from}: ${text}`);
  addMessageToChat(from, text);
});

// Raise hand
socket.emit('session:raise-hand', { session_id: 100 });

// Listen for poll
socket.on('session:poll', ({ question, options }) => {
  showPoll(question, options);
});

// Answer poll
socket.emit('session:poll-answer', { session_id: 100, option_index: 1 });
```

---

## 5. SUMMARY

**notification.socket.js** provides:

1. **Unread Count** — Get count on demand
2. **Mark All Read** — Clear all notifications
3. **Mark Individual** — Mark one as read

**live-session.socket.js** provides:

1. **Participant Management** — Join, leave, see who's online
2. **In-Session Chat** — Classroom messaging
3. **Hand Raise** — Students request attention
4. **Polls** — Real-time feedback mechanism
5. **Session Control** — End session from instructor

---

## 6. COMPLETE SOCKET.IO ARCHITECTURE

```
Socket Server (index.js)
  ├─ Authentication Middleware (JWT)
  ├─ Online Users Map
  ├─ Room Management
  │   ├─ user:{userId} (private notifications)
  │   ├─ role:{role} (role broadcasts)
  │   ├─ room:{roomId} (1-on-1 chat)
  │   ├─ exam:{quizId} (exam monitoring)
  │   └─ session:{sessionId} (live class)
  │
  ├─ Chat Handler (chat.socket.js)
  │   ├─ chat:join
  │   ├─ chat:send
  │   ├─ chat:typing / chat:stop-typing
  │   └─ chat:read
  │
  ├─ Notification Handler (notification.socket.js)
  │   ├─ notification:get-count
  │   ├─ notification:mark-all-read
  │   └─ notification:mark-read
  │
  ├─ Exam Handler (exam.socket.js)
  │   ├─ exam:join
  │   ├─ exam:monitor
  │   ├─ exam:tab-switch
  │   ├─ exam:submit
  │   └─ progress:video-update
  │
  └─ Live Session Handler (live-session.socket.js)
      ├─ session:join
      ├─ session:leave
      ├─ session:send-message
      ├─ session:raise-hand
      ├─ session:lower-hand
      ├─ session:send-poll
      ├─ session:poll-answer
      └─ session:end
```

---

## 7. COMPLETE REQUEST FLOW

**Example: Send Chat Message**

```
1. Client
   socket.emit('chat:send', { room_id: 123, content: 'Hello' })

2. Server Receives (chat.socket.js)
   socket.on('chat:send', async ({ room_id, content }) => {
     ✓ Validate (not empty)
     ✓ Verify room membership
     ✓ Save to DB (INSERT messages)
     ✓ Update room timestamp
     ✓ Get sender info
     ✓ Create message object
     ✓ Broadcast to room (io.to(`room:${room_id}`))
     ✓ Check if receiver online
     ✓ If offline: create notification
     ✓ Send notification count update
   });

3. All Participants in room:123
   socket.on('chat:receive', (message) => {
     // Show message in UI
   });

4. Receiver (if offline)
   notification created → when they next connect, count updates
   io.to(`user:${receiverId}`).emit('notification:count', ...)

5. Receiver Sees
   - Message in chat (real-time if online)
   - Unread count badge (when they reconnect)
```

---

## 8. KEY PATTERNS

### Pattern 1: Verify Room Membership (Security)
```javascript
const [[room]] = await db.query(
  'SELECT id FROM message_rooms WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)',
  [room_id, userId, userId]
);
if (!room) return;  // Deny access
```

### Pattern 2: Broadcast vs Targeted Emit
```javascript
// Broadcast to all in room
io.to(`room:${roomId}`).emit('event', data);

// Broadcast to others (exclude sender)
socket.to(`room:${roomId}`).emit('event', data);

// Target specific user
io.to(`user:${userId}`).emit('event', data);

// Broadcast to role
io.to(`role:${role}`).emit('event', data);
```

### Pattern 3: Offline Handling
```javascript
const isOnline = onlineUsers.has(userId);
if (!isOnline) {
  // Save notification in DB
} else {
  // Send real-time event
}
```

### Pattern 4: Progress Tracking with Upsert
```javascript
INSERT INTO table (col1, col2)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE
  col1 = GREATEST(col1, ?),  // Only increase, never decrease
  updated_at = NOW()
```

---

## 9. SUMMARY

**Socket.io System** provides:

| Handler | Purpose | Events |
|---------|---------|--------|
| index.js | Init, auth, rooms, online users | connect, disconnect, ping |
| chat.socket.js | Direct messaging | join, send, typing, read |
| notification.socket.js | Notification mgmt | get-count, mark-read |
| exam.socket.js | Exam monitoring | join, monitor, tab-switch, submit |
| live-session.socket.js | Live classrooms | join, leave, message, poll, hand |

**Design:** Real-time, event-driven, room-based communication.

---
