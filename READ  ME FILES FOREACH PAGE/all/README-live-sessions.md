# live-sessions.html — Live Sessions

## Overview

`live-sessions.html` is the live class management page of the **EduVerse Instructor Portal**. It allows instructors to schedule, manage, and monitor live sessions linked to their courses or institute classes.

## Location in Project

```
/instructor/
└── live-sessions.html
```

## Features

### Stats Grid (4 Cards)
Summary metrics displayed at the top of the page:

| Stat | Color | Description |
|---|---|---|
| Total Sessions | Blue | All sessions ever created |
| Live Now | Green | Sessions currently in progress |
| Upcoming | Amber | Scheduled future sessions |
| Total Students Joined | Purple | Cumulative attendance across all sessions |

Each stat card has a colored icon wrap and lifts on hover.

### Sessions List / Table
Displays all live sessions for the instructor. Each row shows:
- Session title
- Linked course or class name
- Scheduled date and time
- Duration (minutes)
- Platform (Jitsi / Zoom / Google Meet / Other)
- Status badge: **Scheduled**, **Live**, **Ended**, **Cancelled**
- Action buttons: **Join / Start**, **Edit**, **Cancel**

### Schedule Session Modal
A modal form (`.modal-box`) for creating or editing a live session:

| Field | Details |
|---|---|
| Title | Session name |
| Description | Optional notes for students |
| Course | Dropdown to link a course |
| Class | Dropdown to link an institute class |
| Scheduled Date & Time | `datetime-local` input |
| Duration | Duration in minutes (default 60) |
| Platform | Jitsi, Zoom, Google Meet, Other |
| Meeting Link | URL for students to join |
| Meeting ID | Optional platform meeting ID |
| Meeting Password | Optional password |

### Session Status Badges

| Badge | Class | Meaning |
|---|---|---|
| Scheduled | `.badge-warning` | Future session |
| Live | `.badge-success` | Currently in progress |
| Ended | `.badge-neutral` | Completed |
| Cancelled | `.badge-danger` | Cancelled |

### Attendance Chart (Chart.js)
A bar or line chart showing session attendance trends over recent sessions, rendered via Chart.js 4.4.1.

---

## UI Components Used

| Component | Details |
|---|---|
| Stats grid | `.stats-grid` with 4 `.stat-card` elements |
| Dashboard cards | `.dash-card`, `.dash-card-header`, `.dash-card-body` |
| Badges | `.badge`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-neutral`, `.badge-primary` |
| Schedule modal | `.modal-overlay`, `.modal-box` with form groups |
| Toast notifications | `.toast-container`, `.toast` with success/error/info variants |
| Skeleton loaders | `.skel` shimmer animation on load |
| Form inputs | `.form-input`, `.form-select`, `.form-textarea` |

## Navigation (Sidebar)

Left sidebar with links to all instructor portal pages. **Live Sessions** is marked active.

## External Dependencies

| Library | Version | CDN |
|---|---|---|
| Inter font | — | Google Fonts |
| Feather Icons | 4.29.1 | cdnjs |
| Chart.js | 4.4.1 | cdnjs |

## Shared CSS Files

```
../../css/variables.css
../../css/reset.css
../../css/global.css
../../css/components.css
../../css/layout.css
```

## Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| ≤ 1023px | Stats grid switches from 4-column to 2-column |

## Theme Support

Dark/light mode toggled via `localStorage` key `ev_theme`, applied on page load before rendering.

## Database Relation

Live sessions are stored in the `live_sessions` table in `schema.sql`, with fields for `course_id`, `class_id`, `instructor_id`, `platform`, `meeting_link`, `scheduled_at`, `status`, and `recording_url`.

## Related Pages

- `dashboard.html` — instructor home
- `courses.html` — course management
- `course-builder.html` — course content editing
