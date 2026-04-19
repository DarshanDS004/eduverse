# courses.html — My Courses

## Overview

`courses.html` is the course management page of the **EduVerse Instructor Portal**. It lets instructors view all their courses, create new ones, edit existing course details, archive or delete courses, and manage coupon codes.

## Location in Project

```
/instructor/
└── courses.html
```

## Features

### Course Listing
Displays all courses belonging to the logged-in instructor. Supports two view modes:

| Mode | Layout |
|---|---|
| Grid view | 3-column card grid with thumbnails |
| List view | Compact horizontal rows |

Each course card shows:
- Thumbnail (16:9 aspect ratio)
- Status badge (Published / Draft / Pending Review / Archived / Rejected)
- Category label
- Title (2-line clamp in grid view)
- Metadata: student count, rating, total duration
- Price (₹ or "Free")
- Action buttons: **Edit**, **Builder**, **Archive/Delete**

### Filtering & Sorting
Toolbar above the list allows filtering by:
- Status (All / Published / Draft / Pending / Archived)
- Search by title keyword
- Sort by: Newest, Oldest, Most Students, Rating

### Create Course Modal
A multi-section modal form to create a new course:

**Basic Info**
- Title, short description
- Category, sub-category, level
- Language, tags

**Pricing**
- Free toggle or paid price (₹)
- Coupon codes (code, discount type, discount value, max uses)

**Thumbnail**
- Drag-and-drop or click-to-upload zone
- Preview image (16:9 ratio recommended: 1280×720px)

**Advanced**
- Requirements, what students will learn, target audience

After submission the user is redirected to the Course Builder for content creation.

### Course Actions (per card)
- **Edit** — opens the create/edit modal pre-filled with course data
- **Builder** — navigates to `course-builder.html?id=<course_id>`
- **Archive** — changes course status to `archived`
- **Delete** — permanently removes the course (with confirmation)

---

## UI Components Used

| Component | Details |
|---|---|
| View toggle | Grid / List toggle buttons (`.view-toggle`, `.view-btn`) |
| Course cards | `.ccard` (grid) and `.clist-item` (list) |
| Status badges | `.ccard-status` with color-coded classes |
| Create modal | Full-width overlay modal with sticky header/footer |
| Thumbnail zone | Dashed drop zone with live preview (`.thumb-zone-modal`) |
| Coupon rows | Dynamic rows with code, type, value, max uses, delete button |
| Toast notifications | Slide-in toasts bottom-right for save/delete feedback |
| Skeleton loaders | Shimmer placeholders while courses load |

## Navigation (Sidebar)

Left sidebar with links to all instructor portal pages. **My Courses** is marked active.

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

## Responsive Behaviour

| Breakpoint | Behaviour |
|---|---|
| ≤ 1023px | Grid switches from 3-column to 2-column |
| ≤ 640px | Single column; form rows collapse to 1 column |

## Related Pages

- `dashboard.html` — instructor home
- `course-builder.html` — content editing for a specific course
- `materials.html` — study materials management
