# `courses.html` — My Courses & Course Catalog

## Overview

`courses.html` is the **course management hub** of the EduVerse Student Portal. It presents two distinct views via a tab system: **My Courses** (enrolled courses with progress tracking) and **Catalog** (the full course library with search, category filtering, and enrollment). Students can browse, enroll in new courses, and continue learning from where they left off.

---

## File Location

```
pages/student/courses.html
```

---

## Authentication & Access Control

Standard synchronous student-only guard before DOM load.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Search icon, star ratings |
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
            ├── .page-header
            ├── .page-tabs          ← My Courses | Catalog
            ├── #tab-my-courses
            │   └── .courses-grid   ← enrolled course cards
            └── #tab-catalog
                ├── .filters-bar    ← search + category + level + price
                ├── .courses-grid   ← catalog course cards
                └── .pagination     ← page navigation buttons
```

---

## Tab System

| Tab | Panel ID | Contents |
|---|---|---|
| My Courses | `#tab-my-courses` | Enrolled courses with progress bars and continue buttons |
| Catalog | `#tab-catalog` | Paginated browsable course library with enroll flow |

---

## My Courses Tab

### API Call

```js
Api.student.courses()   // GET /student/courses
```

### Course Card (`.course-card`)

| Element | Content |
|---|---|
| `.course-card-thumb` | Coloured background + emoji (e.g., 📚, 🔬, 🎨) |
| `.course-card-category` | Subject/category label (uppercase, blue) |
| `.course-card-title` | Course title (2-line clamp) |
| `.course-card-instructor` | "By Instructor Name" |
| `.course-progress-wrap` | Progress label row + animated fill bar |
| `.course-card-footer` | Status badge + action button |

### Progress Bar

```html
<div class="course-progress-bar">
  <div class="course-progress-fill" style="width: 65%; background: #1A56DB;"></div>
</div>
```
Width is set from `course.progress` (0–100), animated via CSS `transition: width 0.8s ease`.

### Status Badges

| Value | Badge Class | Label |
|---|---|---|
| `enrolled` | `.badge-enrolled` | "In Progress" |
| `completed` | `.badge-completed` | "Completed" |
| `new` | `.badge-new` | "New" |

### Action Buttons

- **Enrolled/In-progress** → "Continue" button → `player.html?course=<id>`
- **Completed** → "Review" button → `player.html?course=<id>`

---

## Catalog Tab

### API Calls

| Call | Endpoint | Params |
|---|---|---|
| `Api.courses.list(params)` | `GET /courses` | `category`, `search`, `level`, `price`, `page`, `limit` |
| `Api.courses.categories()` | `GET /courses/categories` | — |

Categories are fetched once on page load to populate the category dropdown.

### Filter Bar

| Control | Filters On |
|---|---|
| Search input | `search` (query param, debounced) |
| Category dropdown | `category` |
| Level dropdown | `level` (preschool, primary, middle, high, ug, pg) |
| Price dropdown | `price` (all, free, paid) |

All filter changes trigger a new API call with `page=1`.

### Catalog Course Card (`.catalog-course-card`)

| Element | Content |
|---|---|
| `.catalog-thumb` | Emoji thumbnail |
| `.catalog-title` | Course title (2-line clamp) |
| `.catalog-instructor` | Instructor name |
| `.catalog-rating` | Star rating (★ symbol, amber, numeric) |
| `.catalog-price` | Price or "Free" in green |
| Action button | "Enroll" or "Enrolled" (disabled) |

### Enrollment Flow

```
User clicks "Enroll" button
    ↓
openEnrollModal(course)  ← stores selectedCourse
    ↓
Modal shows course details + confirm button
    ↓
User clicks "Confirm Enrollment"
    ↓
Api.post('/courses/' + selectedCourse.id + '/enroll')
    ↓
Success → close modal → showToast('success') → reload My Courses tab
Failure → showToast('error', err.message)
```

### Enrollment Modal

```html
<div class="modal-overlay" id="enroll-modal">
  <div class="modal-box">
    <div class="modal-header">Enroll in Course</div>
    <div class="modal-body"><!-- course info --></div>
    <div class="modal-footer">
      <button id="enroll-cancel">Cancel</button>
      <button id="enroll-confirm">Confirm Enrollment</button>
    </div>
  </div>
</div>
```

---

## Pagination

The catalog uses **server-side pagination**:

```js
var currentPage = 1;
var totalPages  = 1;

function renderPagination(total, pages) {
  // Renders Previous, page number buttons, Next
  // Active page highlighted with .active class
}
```

Page buttons call `loadCatalog(pageNumber)` on click.

---

## Toast Notifications

```js
function showToast(type, title, msg) {
  // type: 'success' | 'error'
  // Auto-removed after 4 seconds
}
```

---

## State Variables

| Variable | Description |
|---|---|
| `currentPage` | Active catalog page number |
| `totalPages` | Total catalog pages from API |
| `selectedCourse` | Course object staged for enrollment |
| `debounce` | Timeout reference for search debounce |

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.courses-grid` | `auto-fill minmax(300px, 1fr)` responsive card grid |
| `.course-card` | Enrolled course card |
| `.course-card-thumb` | Coloured emoji thumbnail (140px height) |
| `.course-progress-bar` / `.course-progress-fill` | Progress indicator |
| `.course-badge` | Status pill (enrolled / completed / new) |
| `.catalog-course-card` | Catalog browse card |
| `.catalog-rating` | Star + score display |
| `.catalog-price` | Price or Free label |
| `.pagination` / `.page-btn` | Page navigation strip |
| `.modal-overlay` / `.modal-box` | Enrollment confirm dialog |
| `.filters-bar` / `.filter-select` | Filter controls row |
| `.search-wrap` | Relative-positioned search field with icon |
| `.empty-box` | No-results placeholder |

---

## Empty States

| Context | Icon | Message |
|---|---|---|
| No enrolled courses | 📚 | "You haven't enrolled in any courses yet." |
| No catalog results | 🔍 | "No courses found matching your filters." |

---

## Sidebar Active State

```html
<a class="sidebar-item active" href="courses.html">
```

The Assignments sidebar link also shows a badge (`#badge-assignments`) if pending count > 0 — this is populated by `init.js` on boot.

---

## Notes for Developers

- Category dropdown is populated once from `Api.courses.categories()`. If categories change frequently, consider re-fetching on each tab switch.
- The Catalog uses **server-side filtering and pagination** — filter changes always go to the API.
- My Courses uses **client-side rendering only** — all enrolled courses are fetched in one request with no pagination.
- The `openEnrollModal` function is attached to `window` for use in dynamically generated `onclick` attributes.
- After enrollment, both the Catalog card state and My Courses list should be refreshed; ensure both re-render on success.
