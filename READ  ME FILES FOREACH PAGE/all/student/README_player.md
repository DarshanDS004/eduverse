# `player.html` — Video Lesson Player

## Overview

`player.html` is the **in-app video lesson player** of the EduVerse Student Portal. It provides a focused, distraction-free learning environment with a two-column layout: a video playback area on the left and a course lesson list sidebar on the right. Students can navigate between lessons without leaving the page, and the URL updates via `history.replaceState` to keep the state bookmarkable.

---

## File Location

```
pages/student/player.html
```

---

## URL Parameters

The player is accessed with query parameters:

| Parameter | Required | Description |
|---|---|---|
| `course` | ✅ Yes | The course ID to load lessons for |
| `lesson` | Optional | The lesson ID to auto-play on load |

**Example URL:**
```
pages/student/player.html?course=12&lesson=45
```

Both parameters are read using `Utils.getParam('course')` and `Utils.getParam('lesson')`.

---

## Authentication & Access Control

Standard synchronous student guard before render.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Play circle, X (exit), clock icons |
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

The player uses a **full-viewport, no-sidebar layout** (unlike other student pages):

```
body (background: var(--neutral-900))
├── .player-topbar          ← brand + course title + exit button
└── .player-main            ← flex row
    ├── .player-video-area  ← flex: 1
    │   ├── .player-video-wrap  ← aspect-ratio 16/9, black bg
    │   │   ├── #video-placeholder  ← shown before any lesson selected
    │   │   └── #video-el           ← <video controls> element
    │   └── .player-info        ← lesson title + duration metadata
    └── .player-sidebar     ← 320px fixed, hidden on mobile
        ├── .player-sidebar-header  ← "Course Content"
        └── .player-lesson-list (#lesson-list)  ← scrollable lesson items
```

> **Note:** The standard `.app-shell` / `.app-sidebar` layout is NOT used. The player has its own dedicated full-screen layout with a custom topbar.

---

## API Calls

| Call | Method | Endpoint | Description |
|---|---|---|---|
| `Api.courses.detail(courseId)` | `GET` | `/courses/:id` | Fetch course with lesson list |
| `Api.post(...)` | `POST` | `/student/lessons/:id/progress` | Report lesson start / progress |

### Response Shape (`GET /courses/:id`)

```json
{
  "data": {
    "id": 12,
    "title": "Introduction to Biology",
    "lessons": [
      {
        "id": 45,
        "title": "Chapter 1: Cell Structure",
        "duration": 18,
        "video_url": "https://cdn.eduverse.com/videos/bio-ch1.mp4",
        "watched": true
      },
      {
        "id": 46,
        "title": "Chapter 2: Photosynthesis",
        "duration": 22,
        "video_url": "https://cdn.eduverse.com/videos/bio-ch2.mp4",
        "watched": false
      }
    ]
  }
}
```

---

## Page Load Flow

```
DOMContentLoaded
    ↓
Read ?course and ?lesson from URL
    ↓
If no courseId → show "No course selected" in lesson list → stop
    ↓
loadCourse()
    ↓
Api.courses.detail(courseId)  →  GET /courses/:id
    ↓
Set course title in topbar (#course-title-top)
    ↓
Render lesson list (#lesson-list)
    ↓
If ?lesson param found in lessons array:
    playLesson(foundLesson)  ← auto-play the requested lesson
```

---

## Lesson List Rendering (`.lesson-item`)

Each lesson renders as a clickable row:

| Element | Content |
|---|---|
| `.lesson-num` | Lesson number (1-based) OR ✓ checkmark if `watched === true` |
| `.lesson-title` | Lesson title (truncated with `text-overflow: ellipsis`) |
| `.lesson-dur` | Duration in minutes |

CSS state classes:
- `.active` — currently playing lesson (blue left border + tinted background)
- `.done` — watched lesson (green circle with ✓)

```js
'<div class="lesson-num' + (done ? ' done' : '') + '">'
  + (done ? '✓' : (i + 1))
+ '</div>'
```

---

## Play Lesson Flow (`window.playLesson`)

```
User clicks a lesson item (or auto-play on load)
    ↓
playLesson(lesson)
    ↓
1. Toggle .active class on lesson items (match by lesson.id)
2. Set #lesson-title text content
3. If lesson.duration → show #lesson-duration with minutes
    ↓
4. If lesson.video_url or lesson.url:
     - Hide #video-placeholder
     - Show <video id="video-el"> and set .src
     - Call video.play() (catches error silently — browser autoplay policies)
   Else:
     - Hide <video>
     - Show #video-placeholder
    ↓
5. history.replaceState(null, '', '?course=' + courseId + '&lesson=' + lesson.id)
    ↓
6. Api.post('/student/lessons/' + lesson.id + '/progress', { progress: 0 })
   ← fire-and-forget (caught silently)
```

`playLesson` is attached to `window` so it can be called from `onclick` attributes in dynamically generated lesson HTML.

---

## Video Element

```html
<video id="video-el" style="display:none;" controls></video>
```

- Native browser `<video>` element with built-in controls (play/pause, scrubber, fullscreen, volume)
- `object-fit: contain` ensures the video maintains aspect ratio within the black letterbox area
- Autoplay is attempted via `video.play()` — silently fails on browsers requiring user gesture

---

## URL State Management

The player uses `history.replaceState` (not `pushState`) to update the URL without creating a new browser history entry:

```js
history.replaceState(null, '', '?course=' + courseId + '&lesson=' + lesson.id);
```

This means:
- The Back button returns to the previous page (e.g., courses.html), not the previously played lesson
- The current lesson URL is bookmarkable and shareable
- Page refresh reloads the same lesson automatically

---

## Topbar

```html
<div class="player-topbar">
  <a class="player-brand" href="courses.html">
    <div class="player-brand-logo">E</div>
    <span class="player-brand-name">EduVerse</span>
  </a>
  <div class="player-course-title" id="course-title-top">Loading…</div>
  <a href="courses.html" class="btn btn-ghost btn-sm">✕ Exit</a>
</div>
```

- Brand logo links back to `courses.html`
- Course title is populated from the API response
- Exit button links to `courses.html`

---

## Responsive Behaviour

On screens ≤ 767px:
- `.player-sidebar` is hidden (`display: none`)
- `.player-course-title` in topbar is hidden

Students on mobile see only the video area and lesson info; lesson navigation would need a separate mobile UI (e.g., a bottom sheet).

---

## Skeleton Loading

While the course loads, the lesson list shows three skeleton items:

```html
<div class="skel" style="height:56px;margin:8px;border-radius:8px;"></div>
```

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.player-topbar` | Fixed top navigation bar |
| `.player-brand` | Logo + name link |
| `.player-course-title` | Centred course name in topbar |
| `.player-main` | Full-height flex row |
| `.player-video-area` | Left column (flex: 1) |
| `.player-video-wrap` | 16:9 video container |
| `.player-video-placeholder` | Placeholder before lesson selection |
| `.player-info` | Lesson title + metadata below video |
| `.player-lesson-title` | Large white lesson title |
| `.player-lesson-meta` | Duration display |
| `.player-sidebar` | Right lesson list panel (320px) |
| `.player-sidebar-header` | "Course Content" header |
| `.player-lesson-list` | Scrollable lesson items container |
| `.lesson-item` | Individual lesson row |
| `.lesson-item.active` | Currently playing lesson |
| `.lesson-num` | Circle with number or ✓ |
| `.lesson-num.done` | Green ✓ circle |
| `.lesson-info` | Title + duration text |
| `.lesson-dur` | Duration in minutes |

---

## Notes for Developers

- `playLesson()` is on `window` because lesson items are generated as strings with inline `onclick` attributes — be aware this is a global namespace pattern.
- Progress tracking (`Api.post('/student/lessons/:id/progress', { progress: 0 })`) currently only reports `progress: 0` (lesson started). Implement video `timeupdate` event listener to report real-time progress percentage.
- `video.play()` is intentionally wrapped in `.catch(function(){})` — browsers with strict autoplay policies will block it, and the student can press play manually.
- The sidebar is not shown on mobile. Consider implementing a collapsible bottom sheet or accordion for the lesson list on small screens.
- The player does not use the standard `.app-shell` sidebar, so `Sidebar.init()` is called with `initTheme()` and `initLogout()` only — no visual sidebar is rendered.
