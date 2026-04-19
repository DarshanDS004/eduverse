# EduVerse Instructor Portal — Documentation Index

This directory contains individual `README.md` files for each page in the **EduVerse Instructor Portal** frontend. Each README provides complete documentation covering file purpose, responsibility, imports, core logic, functions, API usage, UI structure, data flow, error handling, and edge cases.

---

## 📁 File Index

| File | README | Description |
|---|---|---|
| `analytics.html` | [README_analytics.md](./README_analytics.md) | Analytics dashboard — KPI cards, Chart.js charts for enrollment trend and progress distribution, quiz performance |
| `assessments.html` | [README_assessments.md](./README_assessments.md) | Assessment management — quizzes, assignments, pending submissions grading |
| `course-builder.html` | [README_course-builder.md](./README_course-builder.md) | Course content builder — modules, lessons, video upload with progress, article/quiz stubs, inline player |
| `courses.html` | [README_courses.md](./README_courses.md) | Course management — grid/list view, create/edit modal, thumbnail upload, coupon management, delete |
| `dashboard.html` | [README_dashboard.md](./README_dashboard.md) | Instructor home — welcome banner, KPI stats, recent materials, quick actions, profile completeness |
| `earnings.html` | [README_earnings.md](./README_earnings.md) | Financial overview — earnings KPIs, revenue trend bar chart, breakdown doughnut, transaction history |
| `live-sessions.html` | [README_live-sessions.md](./README_live-sessions.md) | Live session management — upcoming/past sessions, schedule form, cancellation, countdown labels |
| `materials.html` | [README_materials.md](./README_materials.md) | Study materials — drag-and-drop upload with XHR progress, materials list with stats, delete |
| `messages.html` | [README_messages.md](./README_messages.md) | Instructor messaging — two-panel chat UI, room list, send/receive, mark as read, search |
| `profile.html` | [README_profile.md](./README_profile.md) | Profile management — edit info, avatar upload, password change, immediate UI sync |
| `students.html` | [README_students.md](./README_students.md) | Student management — table with progress bars, search/filter, aggregate stats |

---

## 🏗️ Architecture Overview

All 11 pages share the following patterns:

### Shared Infrastructure

```
pages/instructor/
├── analytics.html
├── assessments.html
├── course-builder.html
├── courses.html
├── dashboard.html
├── earnings.html
├── live-sessions.html
├── materials.html
├── messages.html
├── profile.html
└── students.html

css/
├── variables.css     ← Design tokens (colors, spacing, radii, shadows)
├── reset.css         ← CSS normalization
├── global.css        ← Base styles
├── components.css    ← Reusable UI component classes
└── layout.css        ← App shell: sidebar, navbar, main layout

js/
├── utils.js          ← Shared utilities (escapeHtml, formatDate, etc.)
├── store.js          ← Client-side state store (localStorage wrapper)
├── api.js            ← HTTP API client (Api.get, Api.post, Api.patch, Api.delete)
├── auth.js           ← Auth helpers (uploadAvatar, token management)
└── init.js           ← App shell initialization
```

### Common Page Patterns

Every page follows this exact structure:

1. **Inline theme bootstrap** — synchronous dark mode check before DOM parse
2. **External dependencies** — Google Fonts, Feather Icons, optionally Chart.js
3. **CSS imports** — 5 shared stylesheet files
4. **HTML body** — `.app-shell` containing `.app-sidebar` + `.app-body`
5. **JS imports** — `window.EV_BASE`, then 5 shared JS files
6. **Inline auth guard (IIFE)** — checks `ev_token` + `ev_user.role` from localStorage
7. **`DOMContentLoaded` handler** — feather icons, user info, sidebar, theme, dropdown, logout, helpers
8. **Page-specific logic** — data fetch, render, event handlers

### Authentication Model
- JWT stored in `localStorage` as `ev_token`
- User object stored as `localStorage.ev_user` (JSON)
- All API calls attach `Authorization: Bearer <token>` header (handled by `api.js`)
- Role-based guard: only `role === 'instructor'` can access any portal page
- Unauthenticated → redirect to `../../pages/auth/login.html`
- Wrong role → redirect to `../../pages/errors/403.html`

### API Client Convention
Most pages use the shared `Api.*` methods from `api.js`:
```js
Api.get('/path', { queryParam: value })
Api.post('/path', { body })
Api.patch('/path', { body })
Api.delete('/path')
```
Exception: `materials.html` and `course-builder.html` use raw **XHR** for file uploads to track progress.

### Toast Notification Pattern
All pages define a `showToast(type, title, msg)` function:
- `type`: `'success'`, `'error'`, `'info'`
- Auto-dismisses after 4000ms
- Appends to `#toast-container` fixed at bottom-right

### Chart.js Usage

| Page | Charts Used |
|---|---|
| `analytics.html` | Line chart (enrollment trend), Doughnut (progress distribution) |
| `earnings.html` | Bar chart (revenue trend), Doughnut (earnings breakdown) |
| `assessments.html` | None (loaded but unused) |
| `live-sessions.html` | None (loaded but unused) |
| `messages.html` | None (loaded but unused) |
| `profile.html` | None (loaded but unused) |
| `students.html` | None (loaded but unused) |

### Currency
All monetary values are displayed in **Indian Rupees (₹)** with `toFixed(0)` formatting.

---

## 🔐 Security Notes

- All user-generated content is HTML-escaped via `_esc()` (inline) or `Utils.escapeHtml()` before DOM insertion
- JWT is stored in `localStorage` (not `httpOnly` cookie) — susceptible to XSS if any third-party script is injected
- Role check is client-side only — server-side auth middleware on the backend is the actual security layer
- File upload API calls require a valid Bearer token — unauthorized uploads are rejected by the backend

---

## 🌐 Base URL Configuration

```js
window.EV_BASE = "../../";
```
Set on each page before JS files load. Used by `api.js` to construct absolute API URLs. Points two directories up from `pages/instructor/` to the project root.
