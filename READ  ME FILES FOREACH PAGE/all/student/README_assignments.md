# `assignments.html` — Assignments

## Overview

`assignments.html` is the **assignment management page** of the EduVerse Student Portal. It fetches all of a student's assignments in a single API call, then categorises and displays them across three tabs: **Pending**, **Submitted**, and **Graded**. Students can search, filter, and submit assignments directly from this page via a modal dialog with text input and file upload support.

---

## File Location

```
pages/student/assignments.html
```

---

## Authentication & Access Control

Standard student-only guard runs synchronously before page render:

```js
(function(){
  var t = localStorage.getItem('ev_token');
  var u = t ? JSON.parse(localStorage.getItem('ev_user')) : null;
  if (!t || !u)         { window.location.replace('../../pages/auth/login.html'); return; }
  if (u.role !== 'student') { window.location.replace('../../pages/errors/403.html'); }
})();
```

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Icons (clock, award, search, etc.) |
| Google Fonts — Inter | latest | UI typography |

### Internal JS (load order)

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
            ├── .page-header         ← title + subtitle
            ├── .page-tabs           ← Pending | Submitted | Graded
            └── .tab-panel (×3)
                ├── .filters-bar     ← search + course filter + sort (Pending tab only)
                └── #pending-list / #submitted-list / #graded-list
```

---

## Tab System

Three tabs are implemented with CSS classes, no JavaScript framework:

| Tab | `data-tab` | Panel ID | Contents |
|---|---|---|---|
| Pending | `pending` | `#tab-pending` | Overdue / upcoming assignments with Submit button |
| Submitted | `submitted` | `#tab-submitted` | Assignments awaiting grading |
| Graded | `graded` | `#tab-graded` | Graded assignments with score display |

On tab click:
1. All `.page-tab` elements have `.active` removed
2. All `.tab-panel` elements have `.active` removed
3. The clicked tab and its panel get `.active` added

The **Pending** tab header shows a live red badge with the pending count:
```html
<span id="pending-count" style="background:var(--color-danger);..."></span>
```

---

## Filter Bar (Pending Tab)

| Control | ID | Behaviour |
|---|---|---|
| Search input | `#search-input` | Debounced (300ms), filters `allAssignments` client-side by title |
| Course filter | `#filter-course` | Populated dynamically from API data; filters by `course_id` |
| Sort dropdown | `#filter-sort` | Options: "Due Soonest" / "Due Latest" |

All filtering is **client-side** — no extra API calls on filter change.

---

## API Calls

| Call | Method | Endpoint | Description |
|---|---|---|---|
| `Api.student.assignments()` | `GET` | `/student/assignments` | Fetches all assignments for the logged-in student |
| `Api.post(...)` | `POST` | `/student/assignments/:id/submit` | Submits an assignment (text + optional file) |

### Response Shape (`GET /student/assignments`)

```json
{
  "data": [
    {
      "id": 1,
      "title": "Essay on Photosynthesis",
      "description": "Write a 500-word essay...",
      "course_id": 12,
      "course_title": "Biology 101",
      "status": "pending",
      "deadline": "2025-09-10T23:59:00Z",
      "max_score": 100,
      "score": null,
      "total_score": null,
      "feedback": null
    }
  ]
}
```

`status` values: `"pending"`, `"submitted"`, `"graded"`

---

## Assignment Card (`.assignment-card`)

Each assignment renders as a horizontal card with:

| Part | Content |
|---|---|
| `.assignment-date-box` | Deadline day number (large) and month abbreviation |
| `.assignment-course` | Course title (primary blue) |
| `.assignment-title` | Assignment title (bold) |
| `.assignment-desc` | Description (2-line clamp, muted) |
| `.assignment-meta` | Clock icon + due text + max score |
| `.assignment-status` | Context-dependent action (see below) |

### Deadline Urgency Logic

| Condition | CSS Class | Display Text |
|---|---|---|
| Past deadline | `.due-urgent` (red) | "Overdue" |
| ≤ 2 days remaining | `.due-soon` (amber) | "Due today" / "Due tomorrow" / "In N days" |
| > 2 days remaining | `.due-later` (muted) | "In N days" |

### Status Action Column

| Tab | Action |
|---|---|
| Pending | Blue "Submit" button → opens submit modal |
| Submitted | Info badge: "Submitted" |
| Graded | Score display: `score/total_score` in green |

---

## Submit Modal (`#submit-modal`)

Triggered by clicking a "Submit" button on a pending assignment.

### Modal Fields

| Field | Element | Validation |
|---|---|---|
| Assignment info | Read-only display block | Shows title + description |
| Answer / Notes | `<textarea id="submit-text">` | Optional text |
| File attachment | `<input type="file" id="submit-file">` | `.pdf,.doc,.docx,.zip,.txt` up to 10 MB |

### File Upload UX

- A styled dropzone (`#submit-dropzone`) triggers the hidden `<input type="file">` on click
- On file selected, the filename is displayed below: `📎 filename.pdf`
- Drag-and-drop is handled by the dropzone click delegation (full drag events would require additional JS)

### Submission Flow

```
User clicks "Submit Assignment"
    ↓
Button disabled + text → "Submitting…"
    ↓
Api.post('/student/assignments/:id/submit', { text })
    ↓
Success → close modal → showToast('success') → reload assignments
Failure → showToast('error', err.message)
    ↓
Button re-enabled
```

> **Note:** The code constructs a `FormData` object (for file support) but the actual `Api.post` call sends only `{ text }` as JSON. File upload via `FormData` multipart would require a separate implementation in `api.js`.

### Modal Dismiss

- Close button (`#submit-modal-close`)
- Cancel button (`#submit-cancel`)
- Click outside modal overlay (`e.target === modal-overlay`)

---

## Toast Notifications

Each page maintains its own `showToast(type, title, msg)` function:

```js
function showToast(type, title, msg) {
  // Creates .toast.toast-{type} element
  // Appends to #toast-container
  // Auto-removes after 4000ms
}
```

| Type | Border Colour | Use Case |
|---|---|---|
| `success` | Green | Assignment submitted |
| `error` | Red | API failure, validation error |

---

## Data Flow Diagram

```
DOMContentLoaded
    ↓
loadAssignments()
    ↓
Api.student.assignments() → GET /student/assignments
    ↓
allAssignments[] populated
    ↓
renderByStatus()
    ├── Filter by search query (client-side)
    ├── Filter by course (client-side)
    ├── Split into pending / submitted / graded arrays
    ├── Sort pending by deadline (ascending)
    └── renderList() for each tab
            ↓
        DOM updated with assignment cards
        feather.replace() called for new icons
```

---

## Empty States

Each tab shows a contextual empty state when no assignments exist:

| Tab | Icon | Message |
|---|---|---|
| Pending | ✅ | "No pending assignments! 🎉" |
| Submitted | 📋 | "No submitted assignments yet." |
| Graded | 📋 | "No graded assignments yet." |

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.page-tabs` / `.page-tab` | Tab navigation strip |
| `.tab-panel` | Tab content panel (hidden unless `.active`) |
| `.assignment-card` | Individual assignment row card |
| `.assignment-date-box` | Deadline date display box |
| `.assignment-info` | Text content column |
| `.assignment-status` | Right-side action column |
| `.due-urgent` / `.due-soon` / `.due-later` | Deadline urgency text colours |
| `.filters-bar` | Horizontal filter control row |
| `.modal-overlay` / `.modal-box` | Submission modal structure |
| `.dropzone` | File drag-and-drop target area |

---

## Notes for Developers

- All filtering is done **client-side** on the `allAssignments` array — no API re-fetches on filter change.
- The debounce on the search input (`setTimeout(renderByStatus, 300)`) prevents excessive re-renders while typing.
- `openSubmit()` is attached to `window` so it can be called from inline `onclick` attributes in dynamically generated HTML.
- After a successful submission, `loadAssignments()` is called again to re-fetch and re-render, ensuring the assignment moves from Pending to Submitted tab.
- File uploads via `FormData` will need `Api.postForm()` or a multipart fetch wrapper — the current `Api.post()` sends JSON only.
