# `performance.html` — Performance Analytics

## Overview

`performance.html` is the **academic analytics page** of the EduVerse Student Portal. It provides a comprehensive view of a student's performance through key statistics, animated visual components, and Chart.js-powered charts. Students can filter data by time period (7, 30, or 90 days). The page shows an average score ring, a score trend line chart, a subject-wise bar chart, a recent quizzes list, and assignment grades.

---

## File Location

```
pages/student/performance.html
```

---

## Authentication & Access Control

Standard synchronous student guard before render.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | UI icons |
| Chart.js | 4.4.1 | Score trend line chart + subject bar chart |
| Google Fonts — Inter | latest | UI typography |

### Internal JS

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
            ├── .page-header + period-filter dropdown
            └── .perf-layout          ← main content area
                ├── .stats-row        ← 4 summary stat cards
                └── .perf-grid        ← chart cards
                    ├── Score trend chart card
                    ├── Overall score ring card
                    ├── Subject-wise chart card
                    ├── Recent quizzes card
                    └── Assignment grades card
```

---

## Period Filter

A `<select>` dropdown at the top right of the page:

| Option | Value | Description |
|---|---|---|
| Last 7 Days | `7` | Short-term view |
| Last 30 Days | `30` | Monthly view (default) |
| Last 90 Days | `90` | Quarterly view |

On change, `loadPerformance()` is called with the new `days` value.

---

## API Call

```js
Api.student.performance({ days: days })
// GET /student/performance?days=30
```

Called on page load and on period filter change.

### Response Shape

```json
{
  "data": {
    "avg_score": 78,
    "quizzes_taken": 12,
    "assignments_completed": 8,
    "attendance_rate": 91,
    "highest_score": 96,
    "lowest_score": 45,
    "courses_enrolled": 5,
    "courses_completed": 2,
    "score_trend": [
      { "label": "Sep 1", "score": 72 },
      { "label": "Sep 8", "score": 80 }
    ],
    "subjects": [
      { "name": "Mathematics", "score": 85 },
      { "name": "Biology", "score": 70 }
    ],
    "recent_quizzes": [
      { "title": "Chapter 3 Quiz", "score": 8, "total": 10, "taken_at": "2025-09-10T..." }
    ],
    "assignment_grades": [
      { "title": "Essay on Photosynthesis", "score": 88, "total_score": 100 }
    ]
  }
}
```

---

## Summary Stat Cards (`.stats-row`)

Four cards rendered from API data:

| Card | Field | Unit |
|---|---|---|
| Avg. Score | `avg_score` | `%` |
| Quizzes Taken | `quizzes_taken` | count |
| Assignments Done | `assignments_completed` | count |
| Attendance Rate | `attendance_rate` | `%` |

---

## Score Ring (SVG Animated)

An SVG `<circle>` with `stroke-dasharray="314"` (circumference of a r=50 circle). The ring fill is animated on data load:

```js
var circle = document.getElementById('score-ring-circle');
var offset = 314 - (314 * (avg_score / 100));
circle.style.transition = 'stroke-dashoffset 1s ease';
circle.style.strokeDashoffset = offset;
circle.style.stroke = avg_score >= 75 ? '#10b981'    // green
                    : avg_score >= 50 ? '#3b82f6'    // blue
                    : '#f59e0b';                     // amber
```

The ring is accompanied by a 2-column stat table:

| Label | Field |
|---|---|
| Highest Score | `highest_score` + `%` |
| Lowest Score | `lowest_score` + `%` |
| Courses Enrolled | `courses_enrolled` |
| Courses Completed | `courses_completed` |

---

## Chart.js Charts

### Score Trend Chart (`#score-chart`)

- **Type:** `line`
- **X-axis:** `score_trend[].label` (e.g., "Sep 1", "Sep 8")
- **Y-axis:** `score_trend[].score` (0–100)
- **Styling:** Blue line (`#1A56DB`), light fill (`rgba(26,86,219,0.08)`), tension 0.4, filled area, blue points

```js
if (scoreChart) scoreChart.destroy(); // destroy before re-create on filter change
scoreChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: labels,
    datasets: [{
      label: 'Score',
      data: scores,
      borderColor: '#1A56DB',
      backgroundColor: 'rgba(26,86,219,0.08)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#1A56DB'
    }]
  }
});
```

### Subject-wise Chart (`#subject-chart`)

- **Type:** `bar`
- **X-axis:** `subjects[].name`
- **Y-axis:** `subjects[].score` (0–100)
- **Styling:** Gradient fills per bar or a solid blue/teal color palette

```js
if (subjectChart) subjectChart.destroy(); // destroyed on period change
subjectChart = new Chart(ctx, { type: 'bar', ... });
```

Both chart instances are stored in `var scoreChart` and `var subjectChart` at page scope, and `.destroy()` is called before recreation to prevent memory leaks when the filter changes.

---

## Recent Quizzes List (`#quiz-list`)

Each quiz entry renders as a row:

```js
return '<div class="quiz-row">' +
  '<div style="flex:1;">' +
    '<div style="font-weight:600;">' + _esc(q.title) + '</div>' +
    '<div>' + Utils.timeAgo(q.taken_at) + '</div>' +
  '</div>' +
  '<span class="quiz-score-badge ' + cls + '">' + q.score + '/' + q.total + '</span>' +
'</div>';
```

Score badge colour class (`cls`):

| Score % | Class |
|---|---|
| ≥ 80% | `.badge-success` (green) |
| ≥ 50% | `.badge-warning` (amber) |
| < 50% | `.badge-danger` (red) |

---

## Assignment Grades List (`#grade-list`)

Similar row structure to quiz list, showing assignment title and `score / total_score`.

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.perf-layout` | Main content wrapper |
| `.stats-row` | Row of 4 summary stat cards |
| `.perf-card` | Individual analytics section card |
| `.perf-card-header` / `.perf-card-body` | Card header + content |
| `.score-ring-wrap` | SVG ring + stat table flex container |
| `.score-ring-val` | Central text inside ring |
| `.score-ring-num` | Large score percentage text |
| `.stat-row` | Label + value row inside ring card |
| `.quiz-row` | Quiz history list item |
| `.quiz-score-badge` | Score pill (success/warning/danger) |

---

## Error Handling

If the API call fails:
- All stat fields remain at `—` (their default state from skeleton render)
- Charts are not rendered
- No error toast is shown for analytics (silent fail)

Consider adding an error state notification for better UX.

---

## Notes for Developers

- Chart.js is loaded with `defer`. The chart initialisation code inside `DOMContentLoaded` fires after the library is ready.
- Both chart instances **must be destroyed** before re-creation on filter change, or Chart.js will throw a "Canvas is already in use" error.
- `Utils.timeAgo()` is used for quiz timestamps; ensure the API returns ISO 8601 strings.
- The score ring uses `strokeDashoffset` animation — this requires the SVG circle element to have `stroke-dasharray="314 314"` pre-set in HTML.
- `_text(id, value)` is a local helper: `document.getElementById(id).textContent = value`.
