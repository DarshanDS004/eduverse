# dashboard.html — Instructor Dashboard

## Overview

`dashboard.html` is the main landing page for the **Instructor Portal** of EduVerse. It provides a personalized overview of an instructor's teaching activity, including key stats, recent enrollments, upcoming live sessions, and quick-action shortcuts.

## Location in Project

```
/instructor/
└── dashboard.html
```

## Features

### Welcome Banner
A styled green gradient banner that greets the instructor by name, shows a contextual subtitle, and offers quick-action buttons such as:
- **Create Course** — navigates to course creation
- **Schedule Session** — navigates to live sessions

### Stats Grid (4 Cards)
Displays key metrics for the instructor at a glance:

| Stat | Description |
|---|---|
| Total Students | Cumulative enrolled learners across all courses |
| Active Courses | Courses currently published |
| This Month Earnings | Revenue earned in the current calendar month |
| Avg. Rating | Average student rating across all courses |

Each stat card has a colored icon, a large value, and a label. Cards lift on hover.

### Recent Enrollments Table
A table of the most recently enrolled students showing:
- Student name and avatar
- Course enrolled in
- Enrollment date
- Amount paid

### Upcoming Live Sessions
A card listing scheduled upcoming live sessions with:
- Session title
- Scheduled date and time
- Status badge (Scheduled / Live / Ended)
- Quick join/manage link

### Quick Actions
Shortcut buttons for common tasks:
- Create New Course
- Schedule Live Session
- Upload Study Material
- View Analytics

---

## UI Components Used

| Component | Details |
|---|---|
| Welcome banner | CSS gradient (`#065f46 → #059669 → #10b981`) with decorative circle overlay |
| Stat cards | `.stat-card` with colored icon wraps (blue, green, amber, purple) |
| Skeleton loaders | `.skel` shimmer animation while data is loading |
| Toast notifications | Bottom-right animated toast for action feedback |
| Dark mode | Toggled via `localStorage` key `ev_theme`; applies `data-theme="dark"` on `<html>` |

## Navigation (Sidebar)

The left sidebar links to all instructor portal sections:

- Dashboard *(active)*
- My Courses
- Study Materials
- Students
- Assessments
- Live Sessions
- Analytics
- Earnings
- Messages
- My Profile

## External Dependencies

| Library | Version | CDN |
|---|---|---|
| Inter font | — | Google Fonts |
| Feather Icons | 4.29.1 | cdnjs |

## Shared CSS Files

```
../../css/variables.css
../../css/reset.css
../../css/global.css
../../css/components.css
../../css/layout.css
```

## Theme Support

Dark mode is initialized before the page renders to prevent a flash of light theme:

```js
if (localStorage.getItem('ev_theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.classList.add('dark');
}
```

## Related Pages

- `courses.html` — manage all courses
- `live-sessions.html` — manage live sessions
- `materials.html` — upload study materials
- `analytics.html` — detailed performance analytics
- `earnings.html` — income and payout history
