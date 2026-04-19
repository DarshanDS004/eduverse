# `calendar.html` — Academic Calendar

## Overview

`calendar.html` is the **academic calendar page** of the EduVerse Student Portal. It fetches events for the current month from the API and renders them in a 6-week (42-cell) monthly grid. Events are colour-coded by type (assignment deadlines, live sessions, quizzes, general deadlines). Clicking a day shows that day's events in a side panel. The student can navigate between months with previous/next arrows.

---

## File Location

```
pages/student/calendar.html
```

---

## Authentication & Access Control

Standard synchronous student guard:

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
| Feather Icons | 4.29.1 | Chevron navigation arrows |
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
            ├── .page-header        ← "Calendar" title
            └── .cal-layout         ← CSS grid (1fr 300px)
                ├── .cal-card       ← monthly grid (left)
                │   ├── .cal-header ← month title + nav arrows
                │   ├── .cal-weekdays ← Sun Mon Tue…
                │   └── #cal-days   ← 42 day cells
                └── .cal-right      ← event list panel (right)
                    ├── #selected-date-title
                    └── #events-list
```

---

## API Calls

| Call | Method | Endpoint | Params | Description |
|---|---|---|---|---|
| `Api.student.calendar(...)` | `GET` | `/student/calendar` | `?year=YYYY&month=M` | Fetch all events for the given month |

Called on initial load and again on each month navigation.

### Response Shape

```json
{
  "data": [
    {
      "title": "Chapter 3 Quiz",
      "type": "quiz",
      "date": "2025-09-14",
      "scheduled_at": null,
      "deadline": null
    },
    {
      "title": "Essay Submission",
      "type": "assignment",
      "date": null,
      "deadline": "2025-09-20T23:59:00Z"
    }
  ]
}
```

An event is matched to a day cell by checking three date fields: `date`, `deadline`, and `scheduled_at` (whichever is non-null).

---

## Calendar Grid Rendering

The grid always renders **42 cells** (6 rows × 7 columns) to maintain consistent height:

```
Step 1: Calculate firstDay (day-of-week, 0=Sun) for the 1st of the month
Step 2: Fill leading cells with days from the previous month (.other-month)
Step 3: Fill current month's days
Step 4: Fill trailing cells with days from the next month (.other-month)
```

### Day Cell States

| CSS Class | Condition |
|---|---|
| `.cal-day` | Base class for every cell |
| `.other-month` | Day belongs to prev/next month (dimmed) |
| `.today` | Matches today's date (highlighted ring) |
| `.selected` | Currently selected by user click (blue background) |

### Event Dots (`.day-event-dot`)

Each day cell shows up to 3 event labels as small coloured dots:

```js
var typeColors = {
  assignment: '#ef4444',   // Red
  live:       '#3b82f6',   // Blue
  quiz:       '#f59e0b',   // Amber
  deadline:   '#7c3aed'    // Purple
};
```

The event label is truncated to 12 characters for display.

---

## Month Navigation

Two buttons (previous / next) call:

```js
document.getElementById('prev-month').addEventListener('click', function(){
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  loadEvents();
});

document.getElementById('next-month').addEventListener('click', function(){
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  loadEvents();
});
```

`loadEvents()` re-fetches from the API for the new year/month combination.

---

## Day Selection Flow

```
User clicks a day cell
    ↓
selectDay(dateStr)  ← dateStr = "YYYY-MM-DD"
    ↓
selectedDate = dateStr
    ↓
renderCalendar()    ← re-renders grid to apply .selected class
    ↓
Filter allEvents[] where date/deadline/scheduled_at starts with dateStr
    ↓
renderEventsList(dayEvents)
    ↓
#events-list updated, #selected-date-title set to formatted date
```

---

## Upcoming Events Panel

On initial load (before any day is selected), the events panel shows the next **5 upcoming events** sorted by date:

```js
function renderUpcoming() {
  var todayStr = today.toISOString().split('T')[0];
  var upcoming = allEvents
    .filter(e => (e.date || e.deadline || e.scheduled_at || '') >= todayStr)
    .sort(...)
    .slice(0, 5);
  renderEventsList(upcoming);
}
```

---

## Event List Item Rendering

Each event in the side panel renders as:

```html
<div class="event-item">
  <div class="event-dot" style="background:#ef4444;"></div>
  <div class="event-info">
    <div class="event-title">Essay Submission</div>
    <div class="event-date">20 Sep</div>
    <div class="event-type-badge">Assignment</div>
  </div>
</div>
```

Date is formatted using `toLocaleDateString('en-IN', { day:'numeric', month:'short' })`.

---

## State Variables

| Variable | Type | Description |
|---|---|---|
| `today` | `Date` | Current date object, set once on page load |
| `currentYear` | `number` | Year being displayed |
| `currentMonth` | `number` | Month being displayed (0-indexed) |
| `allEvents` | `Array` | All events for the current month from API |
| `selectedDate` | `string \| null` | Currently selected date string (`YYYY-MM-DD`) |

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.cal-layout` | Two-column grid (calendar left, events right) |
| `.cal-card` | Card wrapper for the monthly grid |
| `.cal-header` | Month title + navigation arrows |
| `.cal-weekdays` | Row of weekday labels (Sun–Sat) |
| `.cal-day` | Individual day cell |
| `.other-month` | Dimmed day from adjacent month |
| `.today` | Today's date cell (highlighted) |
| `.selected` | User-selected day cell |
| `.day-num` | Day number within cell |
| `.day-events` | Container for event dots |
| `.day-event-dot` | Coloured event label chip |
| `.ev-assignment` / `.ev-quiz` / `.ev-live` / `.ev-deadline` | Type-specific dot colours |
| `.event-item` | Event row in the side panel |
| `.event-dot` | Circular colour indicator |

---

## Error Handling

If the API call fails, `allEvents` is set to `[]` (no error message shown — the calendar renders as empty). This is a graceful degradation — the grid still renders, just without event markers.

---

## Locale

Date formatting uses `'en-IN'` locale for the day selection header:

```js
d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })
// → "Saturday, 14 September"
```

---

## Notes for Developers

- The calendar always fetches on month change — events are **not cached** between months.
- The 42-cell grid calculation handles months starting on any weekday correctly by padding with previous/next month days.
- Event date matching supports three different field names (`date`, `deadline`, `scheduled_at`) to accommodate multiple event types from a unified endpoint.
- Locale is hard-coded to `en-IN`. To support other locales, make this configurable via `window.EV_CONFIG`.
