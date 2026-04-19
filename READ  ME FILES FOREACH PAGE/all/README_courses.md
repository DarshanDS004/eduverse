# `courses.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `courses.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/courses.html` |
| **Page Title** | My Courses — EduVerse Instructor |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page is the **Course Management hub** for instructors. It allows instructors to:
- View all their courses in either **grid view** (3-column card layout) or **list view** (compact rows)
- Create new courses via a rich modal form
- Edit existing courses via the same modal form
- Delete courses with a confirmation dialog
- Filter courses by search text, status, and sort order
- Navigate to the **Course Builder** for a specific course

---

## 2. Responsibility

- Fetch all instructor courses via `GET /instructor/courses`
- Render courses as cards (grid) or rows (list) with thumbnail, status badge, stats
- Provide a full-featured Create/Edit modal with course metadata fields
- Handle thumbnail upload for new and existing courses
- Handle coupon management within the course form
- Navigate to `course-builder.html?course={id}` after creation (or on edit)
- Delete courses with confirmation

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icons |

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
| `utils.js` | Shared utilities |
| `store.js` | State store |
| `api.js` | HTTP API client |
| `auth.js` | Auth helpers |
| `init.js` | App shell init |

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode restoration from `localStorage`.

### Step 2 — Auth Guard
```js
(function(){
  var t, u;
  try { t = localStorage.getItem('ev_token'); ... } catch(e) {}
  if (!t || !u) { redirect to login }
  if (u.role !== 'instructor') { redirect to 403 }
})();
```

### Step 3 — DOMContentLoaded Init
Standard app shell setup: feather icons, user name/avatar, sidebar toggle, theme toggle, dropdown, logout wired.

### Step 4 — `loadCourses()` — Fetch & Store
```js
async function loadCourses() {
  var res = await apiFetch('GET', '/instructor/courses');
  allCourses = (res.data && res.data.courses) || res.data || [];
  applyFilters();
}
```
Stores courses in module-level `allCourses` array. Calls `applyFilters()` to render.

### Step 5 — `applyFilters()` — Filter, Sort & Render
Filters `allCourses` by:
1. Search text (matches `title` or `description`, case-insensitive)
2. Status filter (`all`, `published`, `draft`, `review`, `archived`)

Sorts by:
- `newest` (default) — `created_at` descending
- `oldest` — `created_at` ascending
- `title` — alphabetical
- `students` — `enrollment_count` descending
- `revenue` — `total_revenue` descending

Then calls `renderCourses(filtered)`.

### Step 6 — `renderCourses(list)` — View Mode Rendering
Depending on `currentView` (`'grid'` or `'list'`):
- **Grid**: Renders `.courses-grid` with `.ccard` elements
- **List**: Renders `.courses-list` with `.clist-item` elements
- **Empty**: Shows a centered empty state message

### Step 7 — Create/Edit Modal
`openCreateModal()` clears the form. `openEditModal(course)` pre-fills all fields. The same `saveCourse()` function handles both by checking `editingId`.

### Step 8 — Coupon Management
Coupons are stored as an array `coupons = []`. Add/remove coupon rows dynamically. Coupons are sent with course payload as `coupons: [{ code, discount, type, max_uses }]`.

---

## 5. Functions / Methods

### `loadCourses()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch all instructor courses from backend |
| **API Call** | `GET /instructor/courses` |
| **Side Effects** | Populates `allCourses`; calls `applyFilters()` |

---

### `applyFilters()` — function

| Property | Detail |
|---|---|
| **Purpose** | Apply search, status filter, and sort to `allCourses`, then render |
| **Parameters** | None (reads from DOM filter inputs) |
| **Returns** | `void` |

---

### `renderCourses(list)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render courses as grid cards or list items |
| **Parameters** | `list` — filtered and sorted array of course objects |
| **Returns** | `void` |

**Grid card fields rendered:**
- Thumbnail (`<img>` or emoji fallback)
- Status badge (`published`, `draft`, `review`, `archived`, `rejected`)
- Category label
- Title (2-line clamp)
- Meta: student count, rating, level
- Price (or FREE)
- Action buttons: Edit, Builder, Delete

**List item fields rendered:**
- Thumbnail (120×68)
- Title, category, student count, price, status badge
- Action buttons: Edit, Builder, Delete

---

### `openCreateModal()` — function

| Property | Detail |
|---|---|
| **Purpose** | Reset the course form and open modal in create mode |
| **Side Effects** | Clears `editingId`, resets all form fields, clears coupon list, hides thumbnail preview |

---

### `openEditModal(course)` — `window.openEditModal`

| Property | Detail |
|---|---|
| **Purpose** | Open modal pre-filled with existing course data for editing |
| **Parameters** | `course` — course object |
| **Side Effects** | Sets `editingId = course.id`; populates all form fields including coupons |

---

### `saveCourse()` — `window.saveCourse` async

| Property | Detail |
|---|---|
| **Purpose** | Create or update a course |
| **Validation** | Course title must not be empty |
| **API Calls** | `POST /instructor/courses` (create) or `PATCH /instructor/courses/{id}` (edit) |
| **Thumbnail** | If `thumbFile` selected: `POST /instructor/courses/{id}/thumbnail` (multipart) |
| **Post-Create** | `confirm()` dialog asking if user wants to open the Course Builder |

**Payload structure:**
```json
{
  "title": "...",
  "description": "...",
  "short_description": "...",
  "category": "...",
  "level": "beginner|intermediate|advanced",
  "language": "...",
  "price": 0,
  "is_free": true,
  "what_you_learn": "...",
  "requirements": "...",
  "target_audience": "...",
  "tags": "...",
  "status": "draft|published|...",
  "coupons": [{ "code": "...", "discount": 10, "type": "percent", "max_uses": 100 }]
}
```

---

### `confirmDelete(id, title)` — `window.confirmDelete`

| Property | Detail |
|---|---|
| **Purpose** | Open delete confirmation modal for a course |
| **Parameters** | `id`, `title` |
| **Side Effects** | Sets `deletingId`; populates `#delete-course-name` text |

---

### Delete Confirm Handler (`#confirm-delete-btn` click) — async

| Property | Detail |
|---|---|
| **Purpose** | Execute course deletion |
| **API Call** | `DELETE /instructor/courses/{deletingId}` |
| **Success** | Closes modal, shows toast, reloads courses |

---

### `addCouponRow()` — function

| Property | Detail |
|---|---|
| **Purpose** | Add a new coupon input row to the coupons section |
| **Data** | Creates `{ code:'', discount:10, type:'percent', max_uses:'' }` in `coupons[]` and renders HTML row |

---

### `removeCouponRow(index)` — `window.removeCouponRow`

| Property | Detail |
|---|---|
| **Purpose** | Remove a coupon row by index |
| **Parameters** | `index` — array index of coupon |

---

## 6. API Role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/instructor/courses` | Get all instructor's courses |
| `POST` | `/instructor/courses` | Create new course |
| `PATCH` | `/instructor/courses/{id}` | Update course metadata |
| `DELETE` | `/instructor/courses/{id}` | Delete course |
| `POST` | `/instructor/courses/{id}/thumbnail` | Upload course thumbnail |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .page-header
        │   ├── Title: "My Courses"
        │   ├── Search input (#search-input)
        │   ├── Status filter (#filter-status)
        │   ├── Sort filter (#filter-sort)
        │   ├── View toggle (Grid / List)
        │   └── "New Course" button
        ├── #courses-container
        │   ├── .courses-grid (3-col card grid) [default]
        │   └── .courses-list (compact list)
        ├── #course-modal — Create / Edit course form
        └── #delete-modal — Delete confirmation dialog
```

### Course Status Badges

| Status | Style |
|---|---|
| `published` | Green (`.s-published`) |
| `draft` | Grey (`.s-draft`) |
| `review` | Amber (`.s-review`) |
| `archived` | Red (`.s-archived`) |
| `rejected` | Red (`.s-rejected`) |

---

## 8. Data Flow

```
Page Load
    → loadCourses() → GET /instructor/courses
    → allCourses = [...] → applyFilters() → renderCourses()

User types in search / changes status filter / changes sort
    → debounce(300ms) → applyFilters() → renderCourses()

User clicks "New Course"
    → openCreateModal() → open #course-modal
    → user fills form + clicks "Save Course"
    → POST /instructor/courses → if thumbFile → POST thumbnail
    → confirm() → redirect to course-builder.html?course={id}
    → OR closeModal → loadCourses()

User clicks "Edit" on a course card
    → openEditModal(course) → pre-filled modal
    → user edits + clicks "Save Course"
    → PATCH /instructor/courses/{id} → if thumbFile → POST thumbnail
    → closeModal → loadCourses()

User clicks "Builder" on a course card
    → window.location.href = 'course-builder.html?course={id}'

User clicks "Delete" on a course card
    → confirmDelete(id, title) → open #delete-modal
    → confirm click → DELETE /instructor/courses/{id}
    → closeModal → loadCourses()

User clicks Grid/List toggle
    → currentView = 'grid' or 'list'
    → renderCourses(current filtered list) — re-renders only
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `apiFetch()` for all HTTP calls |
| `course-builder.html` | Redirect target after course create (or Builder button) |
| `utils.js` | `escapeHtml`, `formatDate` |
| `store.js` | Token/state access |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `loadCourses()` fails | `showToast('error', ...)` |
| `saveCourse()` fails | `showToast('error', 'Save failed: ' + err.message)` |
| Thumbnail upload fails | Separate `try/catch` → `showToast('error', 'Thumbnail upload failed: ...')` — does not block course save |
| Delete fails | `showToast('error', err.message \|\| 'Delete failed.')` |
| Empty title | Validates before API call: `showToast('error', 'Course title is required.')` |
| `safeUpload()` errors | Handled with try/catch inline |

---

## 11. Edge Cases / Notes

- **`apiFetch` vs `Api`**: This page defines its own `apiFetch(method, path, body)` wrapper that constructs the full URL using `window.EV_BASE` — different from the `Api.get/post` pattern used in other pages.
- **View persistence**: `currentView` defaults to `'grid'` but is toggled by the Grid/List buttons. It is not persisted to localStorage.
- **Thumbnail preview**: A 16:9 thumbnail zone shows a preview of the selected file before upload using `URL.createObjectURL()`.
- **Coupon rows**: Coupons array is managed in memory (`coupons[]`). When editing an existing course, pre-existing coupons from `course.coupons` are loaded into this array.
- **Price field visibility**: Price input is hidden when "Free" is selected and shown only when "Paid" is selected via the `c-price-type` select.
- **Post-creation builder prompt**: After creating a course, a native `confirm()` dialog asks the instructor if they want to go directly to the Course Builder — this provides a natural user flow.
- **Enrollment/revenue sort**: These fields (`enrollment_count`, `total_revenue`) must be present in the API response for sorting to work correctly. If absent, the sort has no effect.
- **`safeUpload()` helper**: Used specifically for thumbnail upload — attempts multipart POST with Authorization header.

---

## 12. Summary

`courses.html` is the **Course Management page** of the EduVerse Instructor Portal. It provides a full CRUD interface for instructor courses with grid/list views, advanced filtering and sorting, a rich creation/editing modal with thumbnail upload and coupon management, and a seamless link into the Course Builder. It uses a module-level cache (`allCourses`) and client-side filtering for fast interaction, re-fetching from the server only on mutation operations.
