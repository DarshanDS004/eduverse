# `analytics.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `analytics.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/analytics.html` (inferred from `../../` base path) |
| **Page Title** | Analytics — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This file is the **Analytics Dashboard** page for instructors on the EduVerse platform. It allows instructors to track and visualize performance metrics for their courses, including:
- Course views and new enrollments
- Watch hours and completion rate
- Enrollment trend over time (line chart)
- Student progress distribution (doughnut chart)
- Top courses by enrollment count
- Quiz performance per quiz

---

## 2. Responsibility

This page is responsible for:
- **Fetching** analytics data from the backend via `GET /instructor/analytics`
- **Rendering** four KPI stat cards (views, enrollments, watch hours, completion rate)
- **Rendering** two Chart.js charts (enrollment trend line chart, progress distribution doughnut chart)
- **Rendering** top courses list and quiz performance bars dynamically
- **Providing** a time period filter (`last 7 days`, `last 30 days`, `last 3 months`, `this year`) that re-fetches and re-renders all data on change
- Enforcing **authentication and role-based access control** (instructor only)

---

## 3. Imports / Dependencies

### External CDN Scripts & Stylesheets

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | UI typography (weights 400–800) |
| `Feather Icons 4.29.1` | SVG icon rendering via `feather.replace()` |
| `Chart.js 4.4.1` | Line chart (enrollment trend) and doughnut chart (progress distribution) |

### Local CSS Files (relative `../../css/`)

| File | Purpose |
|---|---|
| `variables.css` | CSS custom properties (colors, spacing, border radii, shadows, etc.) |
| `reset.css` | Cross-browser CSS normalization |
| `global.css` | Base global styles (body, typography) |
| `components.css` | Reusable UI component styles (buttons, avatars, dropdowns) |
| `layout.css` | App shell, sidebar, navbar, and main layout styles |

### Local JavaScript Files (relative `../../js/`)

| File | Purpose |
|---|---|
| `utils.js` | Shared utility functions (HTML escaping, date formatting, etc.) |
| `store.js` | Client-side state store (likely key/value wrapper around localStorage) |
| `api.js` | HTTP API client exposing `Api.get()`, `Api.post()`, etc. |
| `auth.js` | Auth utilities (token management, avatar upload, etc.) |
| `init.js` | Global app initialization (navbar, sidebar, theme, etc.) |

---

## 4. Core Logic Breakdown

### Step 1 — Inline Theme Bootstrap (before DOM ready)
```html
<script>
  try {
    if (localStorage.getItem('ev_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
</script>
```
Runs synchronously before render to prevent a flash of unstyled light theme. Reads `ev_theme` from `localStorage` and applies `data-theme="dark"` to `<html>` immediately if needed.

---

### Step 2 — Inline Auth Guard (immediately invoked)
```js
(function(){
  var t, u;
  try { t = localStorage.getItem('ev_token'); u = t ? JSON.parse(localStorage.getItem('ev_user')) : null; } catch(e) {}
  if (!t || !u) { window.location.replace('../../pages/auth/login.html'); return; }
  if (u.role !== 'instructor') { window.location.replace('../../pages/errors/403.html'); }
})();
```
Before any DOM initialization, this IIFE checks:
1. If `ev_token` and `ev_user` exist in `localStorage`. If not → redirect to login.
2. If the user's `role` is `'instructor'`. If not → redirect to `403.html`.

---

### Step 3 — DOMContentLoaded Initialization
After the DOM is ready:
- Feather icons are replaced with SVGs via `feather.replace()`
- User name and avatar are read from `localStorage` (`ev_user`) and injected into sidebar/navbar elements
- Sidebar toggle (open/close/collapse) listeners are attached
- Dark/light theme toggle listener is attached
- Navbar user dropdown toggle is wired
- Logout button listener clears `ev_token`, `ev_user`, `ev_refresh_token` from localStorage and redirects to login
- Global helper functions `_esc()`, `showToast()`, `openModal()`, `closeModal()` are defined and assigned to `window`

---

### Step 4 — Period Filter & Analytics Load
A `<select id="period-filter">` with values `7`, `30`, `90`, `365` (days) drives data fetching. On change, `loadAnalytics()` is called again. It is also called once on page load.

---

### Step 5 — `loadAnalytics()` (Async)
The central data-fetching function. It:
1. Reads the current period value from `#period-filter`
2. Calls `Api.get('/instructor/analytics', { days: days })`
3. Populates KPI stat values via direct DOM text setting
4. Conditionally renders the enrollment trend line chart
5. Conditionally renders the progress distribution doughnut chart
6. Renders the top courses ranked list dynamically
7. Renders quiz performance bars with color-coded scores
8. Errors are silently caught via `catch(e)` and logged to console

---

## 5. Functions / Methods

### `loadAnalytics()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetches analytics data from backend and renders all widgets |
| **Parameters** | None (reads period from DOM) |
| **Returns** | `Promise<void>` |
| **API Called** | `GET /instructor/analytics?days=<n>` |

**Internal Logic:**
1. Gets `days` from `document.getElementById('period-filter').value`
2. `await Api.get('/instructor/analytics', { days })` — sends `days` as query parameter
3. Sets text content for `#s-views`, `#s-enrollments`, `#s-watchtime`, `#s-completion`
4. If `d.enrollment_trend` array exists and has items:
   - Destroys existing `enrollChart` instance if any (prevents chart duplication)
   - Creates a new `Chart.js` line chart on `<canvas id="enrollment-chart">`
   - Data: dates as labels, enrollment counts as values; green fill; tension 0.4
5. If `d.progress_distribution` object exists:
   - Destroys `progressChart` if it exists
   - Creates a doughnut chart on `<canvas id="progress-chart">`
   - Three segments: Not Started (grey), In Progress (blue), Completed (green)
6. Renders top courses as inline HTML in `#top-courses-list`:
   - Each item shows rank circle, course title, enrollment count
   - Falls back to "No data yet" message if empty
7. Renders quiz performance bars in `#quiz-perf-list`:
   - Each quiz shows title, score percentage, and a colored bar
   - Color logic: ≥75% = green (success), ≥50% = blue (primary), <50% = red (danger)
8. `catch(e)` logs to console — no user-facing error for analytics load failure

---

### `_esc(s)` — inline helper

| Property | Detail |
|---|---|
| **Purpose** | HTML-encode a string to prevent XSS |
| **Parameters** | `s` (any) |
| **Returns** | String with `&`, `<`, `>`, `"` escaped to HTML entities |

---

### `showToast(type, title, msg)` — inline helper

| Property | Detail |
|---|---|
| **Purpose** | Appends a self-dismissing toast notification to `#toast-container` |
| **Parameters** | `type` (string: `'success'`, `'error'`, `'info'`), `title` (string), `msg` (string, optional) |
| **Returns** | `void` |
| **Behavior** | Creates a `.toast.toast-{type}` div, appends it. Auto-removes after 4000ms. Has a manual close button. |

---

### `openModal(id)` / `closeModal(id)` — inline helpers

| Property | Detail |
|---|---|
| **Purpose** | Show/hide modal overlays by toggling `.open` class |
| **Parameters** | `id` (string) — DOM element ID of the `.modal-overlay` |
| **Returns** | `void` |

---

## 6. Component / UI Details

### Layout Structure
```
.app-shell
├── .app-sidebar          ← Fixed left navigation
│   ├── sidebar-brand     ← EduVerse logo + "Instructor Portal"
│   ├── .sidebar-nav      ← Navigation links (Analytics is .active)
│   └── .sidebar-user     ← Avatar + user name
├── .sidebar-overlay      ← Mobile backdrop
└── .app-body
    ├── .app-navbar        ← Top bar (menu btn, theme toggle, user dropdown)
    └── .app-main
        └── .page-content
            ├── .page-header   ← Title + period filter <select>
            ├── stats grid     ← 4 stat cards (views, enrollments, watchtime, completion)
            ├── 2-col grid     ← Enrollment trend chart | Top courses list
            └── 2-col grid     ← Progress doughnut | Quiz performance bars
```

### Stat Cards (4 Total)

| ID | Metric | Icon Color |
|---|---|---|
| `#s-views` | Course Views | Blue |
| `#s-enrollments` | New Enrollments | Green |
| `#s-watchtime` | Watch Hours | Amber |
| `#s-completion` | Completion Rate | Purple |

### Charts

| Canvas ID | Chart Type | Data Field |
|---|---|---|
| `enrollment-chart` | Line | `d.enrollment_trend[]` |
| `progress-chart` | Doughnut | `d.progress_distribution` |

### Period Filter Options

| Value | Label |
|---|---|
| `7` | Last 7 days |
| `30` | Last 30 days (default) |
| `90` | Last 3 months |
| `365` | This year |

### Skeleton Loading
`.skel` class animates with a `shimmer` CSS keyframe (opacity oscillation). Used as placeholder content in `#top-courses-list` and `#quiz-perf-list` before data loads.

---

## 7. Data Flow

```
User selects period → #period-filter change event
        ↓
loadAnalytics()
        ↓
Api.get('/instructor/analytics', { days })
        ↓
Backend returns JSON: {
  total_views, new_enrollments, watch_hours, completion_rate,
  enrollment_trend: [{ label, date, count }],
  progress_distribution: { not_started, in_progress, completed },
  top_courses: [{ title, enrollment_count }],
  quiz_performance: [{ title, avg_score }]
}
        ↓
DOM update: stat card text content
Chart.js: rebuild enrollment line chart
Chart.js: rebuild progress doughnut chart
Inline HTML: top courses ranked list
Inline HTML: quiz performance progress bars
```

---

## 8. Connections

### Files That Depend On This File
- None directly; it is a standalone page navigated to via sidebar links

### Files This File Depends On
| Dependency | How Used |
|---|---|
| `../../js/api.js` | `Api.get()` to call backend analytics endpoint |
| `../../js/utils.js` | Utility helpers (HTML escaping, etc.) |
| `../../js/store.js` | Client-side state store |
| `../../js/auth.js` | Authentication utilities |
| `../../js/init.js` | App shell initialization |
| `../../css/*.css` | All styling |
| `Chart.js` (CDN) | Chart rendering |
| `Feather Icons` (CDN) | SVG icon rendering |

---

## 9. Middleware / Auth

### Client-Side Auth Guard
```js
(function(){
  var t, u;
  try { t = localStorage.getItem('ev_token'); ... } catch(e) {}
  if (!t || !u) { window.location.replace('../../pages/auth/login.html'); return; }
  if (u.role !== 'instructor') { window.location.replace('../../pages/errors/403.html'); }
})();
```
- Runs immediately on script parse, before `DOMContentLoaded`
- Checks `ev_token` (JWT) and `ev_user` (parsed user object) from `localStorage`
- Redirects unauthenticated users to `/pages/auth/login.html`
- Redirects non-instructor users to `/pages/errors/403.html`

### API Auth
The `Api.get()` call (from `api.js`) is expected to attach the `Authorization: Bearer <token>` header from `localStorage` automatically. No explicit token handling is present in this file.

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` inaccessible | `try/catch` around theme init and auth guard — silently fails |
| API call fails in `loadAnalytics` | `catch(e)` → `console.error(e)`. **No user-facing error is shown for analytics load failure.** |
| Missing/null API response fields | Uses `|| 0`, `|| '0%'`, `|| '0h'`, `|| []` fallbacks throughout |
| Empty `enrollment_trend` or `progress_distribution` | Skips chart creation — existing charts are not updated |
| Missing top courses or quiz data | Renders inline "No data yet" fallback message |

---

## 11. Example Usage

This is a browser page, not a module. It is accessed by navigating to:
```
/pages/instructor/analytics.html
```
The user must be authenticated (valid `ev_token` and `ev_user` in localStorage) with `role === 'instructor'`.

Upon load:
1. Theme is restored from localStorage
2. Auth is verified; redirect if invalid
3. App shell UI (sidebar, navbar) initializes
4. `loadAnalytics()` is called with default period = 30 days
5. Charts and stat cards populate with API data

---

## 12. Edge Cases / Notes

- **Chart re-render**: Before creating a new Chart.js instance, the existing one is destroyed (`enrollChart.destroy()`, `progressChart.destroy()`). This prevents memory leaks and visual duplication when the period filter changes.
- **`window.EV_BASE = "../../"`**: Set as a global before JS files load, presumably used by `api.js` to construct base API URLs.
- **No pagination**: All top courses and quiz performance data is rendered as returned by the API with no client-side pagination.
- **No retry mechanism**: If the API call fails, data stays as dashes (`—`) in stat cards and skeleton loaders remain in place — there is no retry or user-facing error toast.
- **Chart.js loaded via CDN `defer`**: Chart.js is loaded with `defer`, which means it's available by the time `DOMContentLoaded` fires and `loadAnalytics()` runs.
- **Currency**: Watch hours display with `h` suffix; completion rate with `%`. No formatting is applied — values are used directly from the API.

---

## 13. Summary

`analytics.html` is the **Analytics Dashboard page** of the EduVerse Instructor Portal. It is a self-contained, server-rendered-style HTML page that:
1. Enforces instructor-only access via a client-side JWT check
2. Provides a time period filter to scope all analytics data
3. Calls `GET /instructor/analytics?days=N` from the backend
4. Renders 4 KPI stat cards, 2 Chart.js visualizations (line chart, doughnut), a ranked top-courses list, and color-coded quiz performance bars
5. Uses shared JS modules (`api.js`, `utils.js`, `auth.js`, etc.) and a CSS variable-based design system for consistency across the Instructor Portal
