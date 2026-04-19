# `live-sessions.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `live-sessions.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/live-sessions.html` |
| **Page Title** | Live Sessions — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page allows instructors to **schedule, view, and manage live teaching sessions**. It provides:
- A list of upcoming sessions with real-time "Starting in X min" countdown labels
- A table of past sessions with attendee count and optional recording link
- A modal form to schedule new live sessions
- Integration with external video conferencing platforms (Zoom, Google Meet, etc.) via meeting link

---

## 2. Responsibility

- Fetch upcoming live sessions: `GET /instructor/live-sessions?status=upcoming`
- Fetch past live sessions: `GET /instructor/live-sessions?status=past`
- Fetch instructor's courses for dropdown in schedule modal: `GET /instructor/courses`
- Render upcoming sessions as interactive cards (with "Today" badge when applicable)
- Render past sessions as a table with attendance and recording data
- Allow scheduling new sessions via modal form
- Allow cancelling upcoming sessions

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icon rendering |
| `Chart.js 4.4.1` | Loaded but **not actively used** on this page |

### Local CSS / JS
Same standard set as all portal pages: `variables.css`, `reset.css`, `global.css`, `components.css`, `layout.css`, `utils.js`, `store.js`, `api.js`, `auth.js`, `init.js`.

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode restoration from `localStorage`.

### Step 2 — Auth Guard
Standard instructor IIFE guard.

### Step 3 — DOMContentLoaded
Standard app shell wiring + helpers.

### Step 4 — Tab System
Two tabs: **Upcoming Sessions** and **Past Sessions**.
```js
var tabs = document.querySelectorAll('.page-tab');
tabs.forEach(function(t) {
  t.addEventListener('click', function() {
    // Toggle active class on tabs and panels
  });
});
```

### Step 5 — `loadSessions()` — Parallel Data Fetch
```js
var [uRes, pRes, cRes] = await Promise.all([
  Api.get('/instructor/live-sessions?status=upcoming'),
  Api.get('/instructor/live-sessions?status=past'),
  Api.get('/instructor/courses')
]);
```
- Populates upcoming and past session arrays
- Populates course `<select>` dropdown in the schedule modal
- Calls `renderUpcoming()` and `renderPast()`

### Step 6 — "Today" and Countdown Logic
For each upcoming session, the scheduled time is compared to `new Date()`:
```js
var isToday = dt.toDateString() === new Date().toDateString();
var diff = Math.ceil((dt - new Date()) / 60000); // minutes until start
var timeLabel = isToday && diff > 0 ? 'Starting in ' + diff + ' min' : dtStr;
```
Sessions scheduled for today display a red "Today" badge and a countdown.

---

## 5. Functions / Methods

### `loadSessions()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch all session and course data in parallel and render |
| **Parameters** | None |
| **Returns** | `Promise<void>` |
| **API Calls** | 3 parallel: upcoming sessions, past sessions, courses |
| **On Error** | Sets `#upcoming-sessions` to red "Failed to load sessions" message |

---

### `renderUpcoming(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render upcoming live session cards in `#upcoming-sessions` |
| **Parameters** | `list` — array of upcoming session objects |
| **Returns** | `void` |

**Each card displays:**
- "Today" red badge (if scheduled today)
- Session title, course title, duration
- Countdown or formatted date/time
- Meeting link (if provided)
- "Start Session" button (only if `meeting_link` exists) → opens link in new tab
- "Cancel" button → calls `cancelSession(id)`

**Empty state**: "No upcoming sessions — Schedule your first live class."

---

### `renderPast(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render past sessions in `#past-tbody` as table rows |
| **Parameters** | `list` — array of past session objects |
| **Returns** | `void` |

**Each row displays:**
- Title, course title
- Scheduled date (formatted `en-IN`)
- Duration in minutes
- Attendee count
- Recording link (if `recording_url` exists) → "Watch" button; else "None"

---

### Schedule Session Handler (`#save-session-btn` click) — async

| Property | Detail |
|---|---|
| **Purpose** | Create a new live session |
| **Validation** | Title and date/time are required |
| **API Call** | `POST /instructor/live-sessions` |
| **Payload** | `{ title, course_id, scheduled_at, duration_minutes, platform, meeting_link, description }` |
| **Success** | Close modal, show success toast, reset form fields, `loadSessions()` |
| **Failure** | `showToast('error', ...)` |

---

### `cancelSession(id)` — `window.cancelSession` async

| Property | Detail |
|---|---|
| **Purpose** | Cancel (delete) an upcoming session |
| **Parameters** | `id` — session ID |
| **Guard** | `confirm()` dialog |
| **API Call** | `DELETE /instructor/live-sessions/{id}` |
| **Success** | Show success toast, `loadSessions()` |
| **Failure** | Show error toast |

---

## 6. API Role

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| `GET` | `/instructor/live-sessions` | `status=upcoming` | Get upcoming sessions |
| `GET` | `/instructor/live-sessions` | `status=past` | Get past sessions |
| `GET` | `/instructor/courses` | — | Get course list for dropdown |
| `POST` | `/instructor/live-sessions` | — | Create/schedule a new session |
| `DELETE` | `/instructor/live-sessions/{id}` | — | Cancel a session |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .page-header
        │   ├── Title: "Live Sessions"
        │   └── "Schedule Session" button → opens #schedule-modal
        ├── .page-tabs
        │   ├── Upcoming (active by default)
        │   └── Past
        ├── #tab-upcoming
        │   └── #upcoming-sessions  ← Dynamic cards
        ├── #tab-past
        │   └── table (#past-tbody) ← Title | Course | Date | Duration | Attendees | Recording
        └── #schedule-modal ← Schedule new session form
```

### Schedule Modal Fields

| Field | Input Type | Required |
|---|---|---|
| Title | text | ✅ |
| Course | select (from API) | ❌ |
| Date & Time | datetime-local | ✅ |
| Duration (min) | number (default 60) | ❌ |
| Platform | select (Zoom, Meet, Teams, Other) | ❌ |
| Meeting Link | text (URL) | ❌ |
| Description | textarea | ❌ |

---

## 8. Data Flow

```
Page Load
    → loadSessions() → Promise.all([upcoming, past, courses])
    → renderUpcoming(upcoming)  → #upcoming-sessions (cards)
    → renderPast(past)          → #past-tbody (table rows)
    → populate #ls-course dropdown

User clicks "Schedule Session"
    → openModal('schedule-modal')
    → fills form + clicks "Schedule"
    → POST /instructor/live-sessions
    → closeModal, showToast, reset fields, loadSessions()

User clicks "Cancel" on a session card
    → confirm()
    → DELETE /instructor/live-sessions/{id}
    → showToast, loadSessions()
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `Api.get`, `Api.post`, `Api.delete` |
| `utils.js` | `_esc()` for XSS prevention |
| `dashboard.html` | Quick action entry point to schedule sessions |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `loadSessions()` API failure | Sets `#upcoming-sessions` to red error message (only upcoming panel, not past) |
| Save session fails | `catch(err)` → `showToast('error', ...)` |
| Cancel fails | `catch(err)` → `showToast('error', ...)` |
| Missing title or datetime | `showToast('error', 'Title and date/time are required.')` before API call |
| Empty upcoming sessions | Empty state card with prompt to schedule |
| Empty past sessions | Table row with empty state message |

---

## 11. Edge Cases / Notes

- **Countdown precision**: `diff` is computed in minutes using `Math.ceil((dt - new Date()) / 60000)`. This is a one-time computation — it does not update in real-time (no interval timer).
- **"Start Session" button only visible if meeting_link exists**: The button is not shown if `s.meeting_link` is falsy, avoiding broken links.
- **Meeting link also shown as text**: The session card shows both the full link as clickable text and a "Start Session" button for redundancy.
- **Session cancellation = deletion**: `DELETE /instructor/live-sessions/{id}` is used — sessions are not "soft-cancelled" but deleted from the API perspective.
- **Platform field**: A select field (Zoom, Google Meet, MS Teams, Other) but the selected value is just a label — no deep platform integration (no OAuth, no automatic meeting creation).
- **Chart.js unused**: Loaded via CDN but no charts are rendered on this page.

---

## 12. Summary

`live-sessions.html` is the **Live Sessions Management page** of the EduVerse Instructor Portal. It allows instructors to schedule upcoming live classes with external meeting links, view past session records, and cancel upcoming sessions. The page uses parallel API calls for performance, computes real-time countdown labels for today's sessions, and provides a clean form-based workflow for creating new sessions.
