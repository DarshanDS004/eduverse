# `students.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `students.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/students.html` |
| **Page Title** | Students — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page provides instructors with a **Student Management view** — a centralized table showing all students who have enrolled in or purchased content from the instructor. Instructors can:
- See total students, active students, average progress, and completions at a glance
- Browse a full table of students with name, course, progress bar, last-active time, and status badge
- Search students by name or email
- Filter students by course

---

## 2. Responsibility

- Fetch all students from `GET /instructor/students`
- Compute aggregate stats: total, active (within 30 days), average progress, completions
- Render each student as a table row with initials avatar, progress bar, last-active, and status badge
- Populate a course filter dropdown dynamically from loaded student data
- Support real-time client-side search (name/email) and course filter
- Enforce instructor-only access

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icon rendering |
| `Chart.js 4.4.1` | Loaded but **not used** on this page |

### Local CSS / JS
Same standard set: `variables.css`, `reset.css`, `global.css`, `components.css`, `layout.css`, `utils.js`, `store.js`, `api.js`, `auth.js`, `init.js`.

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode restoration.

### Step 2 — Auth Guard (IIFE)
Standard instructor token + role check.

### Step 3 — DOMContentLoaded
Standard app shell wiring + helpers.

### Step 4 — Module-Level State
```js
var allStudents = [];
```
All fetched students stored for client-side filtering.

### Step 5 — `loadStudents()` — Fetch, Compute, Render
```js
async function loadStudents() {
  var res = await Api.get('/instructor/students');
  allStudents = (res && res.data) || [];

  // Compute active students (last_active_at within 30 days)
  var active = allStudents.filter(s =>
    s.last_active_at && (new Date() - new Date(s.last_active_at)) < 30 * 86400000
  ).length;

  // Compute average progress
  var progs = allStudents.map(s => s.progress || 0);
  var avgProg = progs.length
    ? (progs.reduce((a,b) => a+b, 0) / progs.length).toFixed(0) + '%'
    : '—';

  // Count completions (progress >= 100)
  var comp = allStudents.filter(s => s.progress >= 100).length;

  // Update stat elements
  // Populate course filter dropdown
  // renderStudents(allStudents)
}
```

### Step 6 — Course Filter Dropdown Population
Unique course titles are extracted from loaded student data using a `Set`:
```js
var courses = [...new Set(allStudents.map(s => s.course_title).filter(Boolean))];
courses.forEach(function(c) {
  var o = document.createElement('option');
  o.value = c; o.textContent = c;
  sel.appendChild(o);
});
```
No additional API call needed — courses are derived from students response.

### Step 7 — `renderStudents(list)` — Table Rendering
Each student row includes:
- Initials avatar (first char of first + all subsequent words)
- Name + email (two-line cell)
- Course title
- Progress bar (color-coded) + percentage
- Last-active relative time via `timeAgo()`
- Status badge (Completed / In Progress / Not Started)

### Step 8 — `filterStudents()` — Client-Side Filtering
```js
function filterStudents() {
  var q = document.getElementById('search-students').value.toLowerCase();
  var course = document.getElementById('filter-course').value;
  renderStudents(allStudents.filter(function(s) {
    return (!q || name.includes(q) || email.includes(q))
        && (!course || s.course_title === course);
  }));
}
```
Fires on every `input` event (no debounce). Both search and course filter compose (AND logic).

---

## 5. Functions / Methods

### `loadStudents()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch all students and render the full view |
| **API Call** | `GET /instructor/students` |
| **Returns** | `Promise<void>` |
| **On Error** | Sets `#students-tbody` to a red "Failed to load students." error row |

**Stat elements updated:**

| ID | Value |
|---|---|
| `#s-total` | `allStudents.length` |
| `#s-active` | Count of students active within 30 days |
| `#s-avgprog` | Average `progress` across all students (formatted `'N%'` or `'—'`) |
| `#s-completed` | Count of students with `progress >= 100` |

---

### `renderStudents(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render student rows in `#students-tbody` |
| **Parameters** | `list` — array of student objects |
| **Returns** | `void` |
| **Empty State** | Full-width row with 👥 icon + "No students yet" message |

**Progress bar color logic:**
```js
var barColor = pct >= 80 ? 'var(--color-success)'
             : pct >= 50 ? 'var(--color-primary-600)'
             :              'var(--color-warning)';
```

**Status badge logic:**
```js
pct >= 100 → badge-success  "Completed"
pct >   0  → badge-primary  "In Progress"
else       → badge-neutral  "Not Started"
```

**Initials generation:**
```js
var ini = (s.name || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
```
Takes first character of each word, then slices to max 2 characters.

---

### `filterStudents()` — function

| Property | Detail |
|---|---|
| **Purpose** | Apply search and course filter to `allStudents`, re-render |
| **Parameters** | None (reads from `#search-students` and `#filter-course`) |
| **Returns** | `void` |
| **Filter Logic** | Search matches `name` OR `email` (case-insensitive); course filter is exact match |

---

### `timeAgo(d)` — pure function

| Property | Detail |
|---|---|
| **Purpose** | Format a Date into a human-readable relative string |
| **Parameters** | `d` — Date object |
| **Returns** | `'Just now'`, `'Xm ago'`, `'Xh ago'`, `'Xd ago'`, or formatted date |
| **Differences from messages.html** | This version returns "Just now" (not "now"), adds "ago" suffix, has day range |

---

## 6. API Role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/instructor/students` | Get all students for instructor |

**Expected response per student object:**
```json
{
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "course_title": "Python Basics",
  "progress": 65,
  "last_active_at": "2025-04-10T14:30:00Z"
}
```

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .page-header
        │   ├── Title: "Students"
        │   ├── Search input (#search-students)
        │   └── Course filter select (#filter-course)
        ├── Stats row (4 cards)
        │   ├── #s-total      — Total Students
        │   ├── #s-active     — Active (30 days)
        │   ├── #s-avgprog    — Avg Progress
        │   └── #s-completed  — Completions
        └── .dash-card (Students Table)
            └── table
                ├── Columns: Student | Course | Progress | Last Active | Status
                └── #students-tbody (dynamic rows)
```

### Progress Bar Colors

| Progress | Color |
|---|---|
| ≥ 80% | Green (success) |
| 50–79% | Blue (primary) |
| < 50% | Amber (warning) |

### Status Badges

| Condition | Badge Style | Text |
|---|---|---|
| `progress >= 100` | `.badge-success` | Completed |
| `progress > 0` | `.badge-primary` | In Progress |
| `progress === 0` | `.badge-neutral` | Not Started |

---

## 8. Data Flow

```
Page Load
    → Auth guard
    → DOMContentLoaded
    → loadStudents()
        → GET /instructor/students
        → allStudents = [...]
        → Compute: active, avgProg, comp
        → Update 4 stat cards
        → Populate #filter-course dropdown (from student data)
        → renderStudents(allStudents)

User types in search
    → filterStudents() immediately
    → renderStudents(filtered)

User selects a course from dropdown
    → filterStudents() immediately
    → renderStudents(filtered)
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `Api.get('/instructor/students')` |
| `utils.js` | Loaded, available |
| `store.js` | Loaded, available |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `loadStudents()` API fails | `catch(e)` → `#students-tbody` set to red error message cell |
| No students returned | Empty state row with 👥 icon and "No students yet" message |
| `progress` field missing | `s.progress || 0` fallback in all calculations |
| `last_active_at` missing | `timeAgo()` only called if truthy; else "Never" |
| `s.name` missing | Falls back to `'?'` for initials, `'Unknown'` for display name |
| `s.email` missing | Falls back to `''` |
| `s.course_title` missing | Displays `'—'` in the course column |

---

## 11. Edge Cases / Notes

- **"Active" definition**: A student is considered active if their `last_active_at` timestamp is within the last 30 days (30 × 86400000 ms). This is a client-side calculation on the data returned by the API.
- **Average progress calculation**: If `allStudents` is empty, `avgProg` returns `'—'` to avoid `NaN%`. Non-empty arrays use `toFixed(0)` for integer display.
- **Course filter options are derived from students**: No separate courses API call is made — unique course titles are extracted from student data using `Set`. This means only courses that currently have students appear in the filter.
- **Filter composition**: Both search and course filter use AND logic — a student must match both conditions to be shown.
- **No pagination**: All students are loaded at once. Large instructor accounts with many students may experience slow initial loads.
- **Progress bar width**: Directly set as `width: pct + '%'` inline in the div style — capped naturally at 100% by the browser.
- **Initials slice**: `slice(0, 2)` ensures the avatar never shows more than 2 characters, even for names with many words.
- **`timeAgo()` differences**: The implementation in `students.html` has slightly different output than `messages.html` — `'Just now'` vs `'now'`, with `' ago'` suffix here.

---

## 12. Summary

`students.html` is the **Student Management page** of the EduVerse Instructor Portal. It displays all students who have enrolled in or purchased from the instructor, with aggregate KPI stats, a searchable and filterable table, progress bars, status badges, and last-active timestamps. All filtering is client-side for instant responsiveness. The page makes a single API call (`GET /instructor/students`) and derives all computed values — including the course filter options and aggregate stats — from that response.
