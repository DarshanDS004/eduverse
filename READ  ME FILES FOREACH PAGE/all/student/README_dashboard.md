# `dashboard.html` — Student Dashboard

## Overview

`dashboard.html` is the **primary home screen** of the EduVerse Student Portal. After login, students land here. It aggregates key data from multiple API sources and presents a personalised, at-a-glance view of the student's academic status: stats, in-progress courses, a score trend chart, and upcoming calendar events.

---

## File Location

```
pages/student/dashboard.html
```

---

## Authentication & Access Control

A synchronous IIFE runs before `DOMContentLoaded`:

```js
(function(){
  var t = localStorage.getItem('ev_token');
  var u = t ? JSON.parse(localStorage.getItem('ev_user')) : null;
  if (!t || !u)      { window.location.replace('../../pages/auth/login.html'); return; }
  if (u.role !== 'student') { window.location.replace('../../pages/errors/403.html'); }
})();
```

- No token → redirected to login
- Non-student role → redirected to 403

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | SVG icons (loaded with `defer`) |
| Chart.js | 4.4.1 | Score trend line chart (loaded with `defer`) |
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
<script src="../../js/modules/dashboard.js"></script>
```

The page-specific logic is extracted into `js/modules/dashboard.js` — the only student page to do this.

---

## Layout Structure

```
.app-shell
├── .app-sidebar          ← shared navigation
└── .app-body
    ├── .app-navbar       ← top bar (theme toggle, user dropdown)
    └── .app-main
        └── .page-content
            ├── .welcome-banner       ← greeting + quick action buttons
            ├── .stats-grid           ← 4 stat cards
            └── .dash-grid
                ├── .dash-left        ← in-progress courses + score chart
                └── .dash-right       ← upcoming events (sticky)
```

---

## UI Components

### Welcome Banner

A gradient card (`#1A56DB → #4f46e5`) displaying:
- Student's first name (populated from `localStorage` → `ev_user.name`)
- Motivational subtitle
- Two quick-action buttons: **Continue Learning** (→ `courses.html`) and **View Performance** (→ `performance.html`)
- A decorative emoji illustration (`🎓`)

### Stats Grid (`.stats-grid`)

Four stat cards rendered in a `repeat(4, 1fr)` CSS grid:

| Stat | Icon | Color Scheme |
|---|---|---|
| Enrolled Courses | `book-open` | Blue |
| Avg. Quiz Score | `award` | Amber |
| Pending Assignments | `clipboard` | Green |
| Certificates Earned | `star` | Purple |

Each card includes:
- A value field (populated from API, shows `—` while loading)
- A label
- An optional delta indicator (up/down trend with colour coding)

### Score Trend Chart

A Chart.js `line` chart rendered on `<canvas id="score-chart">`:
- X-axis: date labels from `score_trend[].label`
- Y-axis: score values from `score_trend[].score`
- Styling: blue line (`#1A56DB`), light fill, tension `0.4`, filled area

### In-Progress Courses (`.course-item`)

A list of enrolled courses with:
- Coloured emoji thumbnail
- Subject tag (uppercase, primary colour)
- Course title
- Instructor name
- Progress bar (CSS width animated on render)
- "Continue" link → `player.html?course=<id>`

### Upcoming Events Panel

A sticky right column listing the next 5 calendar events, colour-coded by type:

| Type | Colour |
|---|---|
| `assignment` | Red `#ef4444` |
| `quiz` | Amber `#f59e0b` |
| `live` | Blue `#3b82f6` |
| `deadline` | Purple `#7c3aed` |

---

## API Calls

All API calls are made in `js/modules/dashboard.js` on `DOMContentLoaded`.

| Call | Endpoint (inferred) | Data Used |
|---|---|---|
| `Api.student.courses()` | `GET /student/courses` | In-progress course list |
| `Api.student.performance(...)` | `GET /student/performance` | Stats: enrolled, avg score, pending, certificates; score_trend array |
| `Api.student.calendar(...)` | `GET /student/calendar` | Upcoming events |
| `Api.notifications.markAllRead()` | `POST /notifications/mark-all-read` | Clears unread notification badge |

---

## State Management

The dashboard subscribes to the `Store` for reactive updates:

```js
Store.subscribe('student', function(state) {
  // re-render stats or course list on state change
});
```

User data for the welcome banner and sidebar is read from `localStorage`:
```js
var user = Store.get('auth.user');
```

---

## Skeleton Loading

All data regions show animated skeleton placeholders while loading:

```html
<div class="skel" style="height:80px;border-radius:8px;"></div>
```

These are replaced by real content once the API responds.

---

## Error Handling

Each API call is wrapped in `try/catch`. On failure, affected sections display an inline error message styled with `var(--color-danger)` rather than crashing the whole page.

---

## Sidebar Active State

The sidebar link for Dashboard has the `.active` class:
```html
<a class="sidebar-item active" href="dashboard.html">
```

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.welcome-banner` | Gradient hero card at top of page |
| `.welcome-name` | Student name display (large, bold) |
| `.stats-grid` | 4-column responsive stat card grid |
| `.stat-card` | Individual stat card with icon + value |
| `.dash-grid` | Two-column main/sidebar layout |
| `.dash-left` / `.dash-right` | Content columns; right is sticky |
| `.dash-card` | Generic section card with header/body |
| `.course-item` | Row item for an in-progress course |
| `.course-thumb` | Coloured emoji thumbnail |
| `.course-progress-bar` / `.course-progress-fill` | Progress bar |
| `.delta-up` / `.delta-down` | Trend indicators (green/red) |

---

## Responsive Behaviour

- The `.stats-grid` collapses from 4 columns to 2 on tablet and 1 on mobile
- The `.dash-grid` collapses to a single column on screens below ~900px
- The sticky right panel becomes a normal flow element on mobile

---

## Notes for Developers

- The dashboard is the only student page that loads a dedicated module file (`dashboard.js`). All other pages use inline scripts.
- Chart.js is loaded with `defer` — ensure `dashboard.js` initialises the chart inside `DOMContentLoaded`, not at the top level.
- The `Store.subscribe('student', ...)` pattern allows the dashboard to react to data pushed from `init.js` without re-fetching.
- The welcome banner name comes from `localStorage`, not an API call, so it renders immediately without a loading state.
