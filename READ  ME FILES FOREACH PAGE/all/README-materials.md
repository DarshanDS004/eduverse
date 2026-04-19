# materials.html — Study Materials

## Overview

`materials.html` is the study materials management page of the **EduVerse Instructor Portal**. It allows instructors to upload, publish, and manage educational documents such as notes, question papers, study guides, and assignments — either for free or as paid resources.

## Location in Project

```
/instructor/
└── materials.html
```

## Features

### Upload Card
A prominent upload section at the top of the page with a two-column form grid:

**File Upload**
- Drag-and-drop zone (`.dropzone`) for selecting the material file
- Accepts PDF and document formats
- Shows a confirmation panel (`.file-selected`) with file name and size after selection

**Metadata Fields**

| Field | Details |
|---|---|
| Title | Name of the material (required) |
| Subject | Subject area (e.g. Mathematics, Science) |
| Description | Brief description of the content |
| Type | Notes, Question Paper, Study Guide, Assignment, Other |
| Category | Broad category grouping |
| Level | Education level (e.g. Primary, High School, UG) |
| Language | Language of the material (default: English) |
| Price (₹) | 0 for free; positive value for paid |
| Tags | Comma-separated keywords for search |
| Thumbnail | Optional cover image upload |

**Submit**
An **Upload & Publish** button submits the form and immediately publishes the material.

---

### Materials Listing
Below the upload card, all previously uploaded materials are listed. Each item shows:
- Thumbnail (or default file-type icon)
- Title and subject
- Type badge (Notes / Question Paper / Study Guide / Assignment)
- Level and language
- Price (₹ or "Free")
- Download count and purchase count
- Average rating (stars)
- Status (Published / Draft / Archived)
- Action buttons: **Edit**, **Preview**, **Archive / Delete**

### Filtering & Search
Toolbar above the listing for:
- Search by title or subject
- Filter by type
- Filter by status
- Sort by: Newest, Most Downloads, Highest Rated, Price

---

## UI Components Used

| Component | Class / Detail |
|---|---|
| Upload card | `.upload-card` with `.upload-card-title` |
| Two-column form grid | `.form-grid-2` |
| Dropzone | `.dropzone`, `.dropzone:hover`, `.dropzone.dragover` |
| File selected confirmation | `.file-selected` (shown after file pick) |
| Material cards / rows | Similar card pattern to courses listing |
| Toast notifications | Bottom-right animated slide-in toasts |
| Skeleton loaders | `.skel` shimmer on initial data load |
| Dark mode | Toggled via `localStorage` key `ev_theme` |

## Navigation (Sidebar)

Left sidebar with links to all instructor portal pages. **Study Materials** is marked active.

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
| ≤ 768px | Two-column form grid collapses to single column |

## Theme Support

Dark/light mode initialized before page render to avoid flash:

```js
if (localStorage.getItem('ev_theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.classList.add('dark');
}
```

## Database Relation

Study materials are stored in the `study_materials` table in `schema.sql`. Paid materials generate records in `material_purchases`; student ratings are stored in `material_reviews`.

## Related Pages

- `dashboard.html` — instructor home
- `courses.html` — course management
- `live-sessions.html` — live class scheduling
