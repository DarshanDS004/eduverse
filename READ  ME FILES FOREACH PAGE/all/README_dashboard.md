# `dashboard.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `dashboard.html` |
| **File Type** | Frontend Page — Instructor Portal (Home/Overview) |
| **Location** | `pages/instructor/dashboard.html` |
| **Page Title** | Instructor Dashboard — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This is the **main landing page** of the EduVerse Instructor Portal after login. It provides a high-level overview of the instructor's activity, including:
- A personalized welcome banner with key stats
- Four top-level KPI stat cards (Materials, Students, Courses, Earnings)
- A two-column main layout: left with recent materials, courses, and students; right with quick actions, earnings summary, and profile completeness
- Placeholder sections for courses and students (pending full implementation)

---

## 2. Responsibility

- Display a personalized welcome greeting with the instructor's name
- Fetch and display the instructor's published study materials (`GET /materials/my/materials`)
- Compute derived stats: total earnings, purchases, and downloads from materials data
- Render recent materials (up to 4) in the main panel
- Display placeholder content for courses and students
- Show a profile completeness progress bar based on `localStorage` user data
- Provide quick-action navigation buttons

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography (weights 400–800) |
| `Feather Icons 4.29.1` | SVG icon rendering |

### Local CSS

| File | Purpose |
|---|---|
| `variables.css` | Design tokens |
| `reset.css` | CSS normalization |
| `global.css` | Base styles |
| `components.css` | UI component styles |
| `layout.css` | App shell layout |

### Local JavaScript

| File | Purpose |
|---|---|
| `utils.js` | `escapeHtml`, `formatDate`, etc. |
| `store.js` | Client-side state store |
| `api.js` | HTTP API client |
| `auth.js` | Auth utilities |
| `init.js` | App shell initialization |

---

## 4. Core Logic Breakdown

### Step 1 — Inline Theme Bootstrap
Synchronously applies dark theme from `localStorage` before render to avoid flash.

### Step 2 — DOMContentLoaded Setup
The full app shell is initialized inside the `DOMContentLoaded` listener using the shared `init.js` pattern:
- Feather icons replaced
- User name and avatar injected into sidebar, navbar, dropdown from `ev_user` in localStorage
- Sidebar open/collapse toggle wired
- Theme toggle wired
- Navbar user dropdown toggle wired
- Notification panel toggle wired (click outside closes it)
- Logout wired

### Step 3 — `loadDashboard()` Async Function
The single data-loading function:

```js
async function loadDashboard() {
  try {
    var matRes = await Api.get('/materials/my/materials');
    var materials = (matRes && matRes.data) || [];
    renderMaterials(materials);
    // Compute totals from materials array
    // Update stat IDs in DOM
  } catch(err) {
    // Set all stats to 0
  }
  renderCoursesPlaceholder();
  renderStudentsPlaceholder();
}
```

Note: Courses and students stats are **not** fetched from the API; they are rendered as zero-value placeholders.

### Step 4 — Profile Strength Panel
After the user object is loaded, `_renderProfileStrength(user)` computes a completeness percentage:
```
Fields checked: name, email, bio, avatar
Percentage = (filled fields / 4) * 100
```
Updates `#profile-bar` width and `#profile-pct` text. Lists missing fields as tips.

---

## 5. Functions / Methods

### `loadDashboard()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch materials data and populate the dashboard |
| **API Call** | `GET /materials/my/materials` |
| **Returns** | `Promise<void>` |

**Internal logic:**
1. Fetches materials list
2. Calls `renderMaterials(materials)` for the recent materials panel
3. Reduces materials to compute total earnings, purchases, downloads
4. Updates `#stat-materials`, `#earnings-materials`, `#earnings-total`, `#stat-earnings`, `#welcome-subtitle` in DOM
5. On error: sets all stats to `0`/`₹0` via `_text()`
6. Always calls `renderCoursesPlaceholder()` and `renderStudentsPlaceholder()`

---

### `renderMaterials(materials)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render up to 4 recent materials in `#materials-list` |
| **Parameters** | `materials` — array of material objects |
| **Returns** | `void` |

**Type config mapping:**
```js
{
  notes:          { emoji: '📝', bg: '#dbeafe' },
  question_paper: { emoji: '📋', bg: '#fef3c7' },
  study_guide:    { emoji: '📖', bg: '#d1fae5' },
  assignment:     { emoji: '✏️',  bg: '#ede9fe' },
  other:          { emoji: '📄', bg: '#f3f4f6' },
}
```
Each row shows: emoji icon, title (truncated), purchases + downloads, price (or "FREE").

**Empty state**: Shows 📭 with a link to `materials.html`.

---

### `renderCoursesPlaceholder()` — function

| Property | Detail |
|---|---|
| **Purpose** | Render a "Course builder coming soon" placeholder in `#courses-list` |
| **Side Effect** | Also sets `#stat-courses` to `'0'` |

---

### `renderStudentsPlaceholder()` — function

| Property | Detail |
|---|---|
| **Purpose** | Render a "Students will appear here" placeholder in `#students-list` |
| **Side Effect** | Also sets `#stat-students` to `'0'` |

---

### `_renderProfileStrength(user)` — function

| Property | Detail |
|---|---|
| **Purpose** | Compute and display profile completeness |
| **Parameters** | `user` — user object from localStorage |
| **Returns** | `void` |

**Fields evaluated:**
| Field | Condition |
|---|---|
| Full name | `!!user.name` |
| Email | `!!user.email` |
| Bio | `!!user.bio` |
| Avatar | `!!user.avatar` |

Updates: `#profile-bar` (width %), `#profile-pct` (text), `#profile-tips` (missing field list or ✅).

---

### `_text(id, val)` — private helper

| Property | Detail |
|---|---|
| **Purpose** | Set text content of an element by ID |
| **Parameters** | `id` (string), `val` (any) |
| **Returns** | `void` |
| **Null safety** | If `val` is null/undefined, sets empty string |

---

## 6. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .welcome-banner          ← Gradient banner with name, subtitle, quick action buttons
        ├── .stats-grid (4 cols)     ← Materials | Students | Courses | Earnings stat cards
        └── .dash-grid (2 cols)
            ├── .dash-left (1fr)
            │   ├── Recent Materials card   (#materials-list)
            │   ├── My Courses card         (#courses-list — placeholder)
            │   └── Recent Students card    (#students-list — placeholder)
            └── .dash-right (320px, sticky)
                ├── Quick Actions panel     (4 action tiles: New Course, Upload Material, Schedule Session, View Analytics)
                ├── Earnings summary card   (dark indigo gradient, ₹ total)
                └── Profile Strength card  (progress bar + missing field tips)
```

### Welcome Banner
- Background: `linear-gradient(135deg, #065f46, #059669, #10b981)` (green gradient)
- Decorative circle pseudo-element
- Displays: greeting label, instructor name (from localStorage), subtitle (dynamic: material count, purchases, downloads)
- Action buttons: "Upload Material" → `materials.html`, "View Analytics" → `analytics.html`

### Stat Cards (4)

| ID | Metric |
|---|---|
| `#stat-materials` | Study materials published |
| `#stat-students` | Total students (placeholder: 0) |
| `#stat-courses` | Courses published (placeholder: 0) |
| `#stat-earnings` | Total earnings (₹) |

### Earnings Card (right sidebar)
- Dark indigo gradient background
- Shows `#earnings-total` (total), `#earnings-materials` (from materials), `#earnings-courses` (from courses — currently hardcoded 0 in placeholder)

---

## 7. Data Flow

```
Page Load
    → Auth guard (localStorage check)
    → DOMContentLoaded
    → User data injected from ev_user (localStorage)
    → _renderProfileStrength(user)
    → loadDashboard()
        → GET /materials/my/materials
        → renderMaterials(materials)     → DOM update
        → reduce: earnings, purchases, downloads
        → _text('stat-materials', ...)   → DOM update
        → _text('stat-earnings', ...)    → DOM update
        → _text('welcome-subtitle', ...) → DOM update
        → renderCoursesPlaceholder()     → DOM update
        → renderStudentsPlaceholder()    → DOM update
```

---

## 8. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `Api.get('/materials/my/materials')` |
| `utils.js` | `Utils.escapeHtml()`, `Utils.formatDate()` |
| `materials.html` | Welcome banner "Upload Material" button |
| `analytics.html` | Welcome banner "View Analytics" button |
| `live-sessions.html` | Quick action tile |
| `courses.html` | Quick action tile |

---

## 9. Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` inaccessible | `try/catch` around theme init and user data read |
| `loadDashboard()` API failure | `catch(err)` → `console.error()` + all stats reset to zero |
| Materials render with empty list | Shows empty state with link to `materials.html` |
| Notification panel outside click | `document.addEventListener('click')` dismisses panel |
| User has no avatar | Falls back to text initials |

---

## 10. Edge Cases / Notes

- **Courses and students are hardcoded to 0**: The comment in code says "will be built when course module is complete" — these are placeholder sections pending backend integration.
- **Profile strength uses localStorage data**: The completeness check reads from `ev_user` (cached localStorage), not from a live API call. This means if the user updates their profile elsewhere, the dashboard strength meter may be stale until re-login.
- **Earnings breakdown**: `#earnings-courses` is shown in the earnings card but currently is not computed (no course earnings API call). Only material earnings are real.
- **Material list limited to 4**: `materials.slice(0, 4)` is used — only the most recent 4 materials are shown, with a "View All" link to `materials.html`.
- **Notification panel**: A notification button/panel UI is present in the navbar but its data population is not implemented in this file (the panel toggle wiring is done but no `Api.get('/notifications')` call exists).
- **`window.EV_BASE = "../../"`**: Set before JS files to allow `api.js` to build base URLs correctly.

---

## 11. Summary

`dashboard.html` is the **home/overview page** of the EduVerse Instructor Portal. It provides a personalized welcome experience, key stats from the instructor's materials, and quick-access navigation to core features. The page is intentionally lightweight on API calls — only one endpoint (`/materials/my/materials`) is called, with courses and students shown as placeholders pending future implementation. Profile completeness is derived from cached localStorage data, and all monetary values are in Indian Rupees (₹).
