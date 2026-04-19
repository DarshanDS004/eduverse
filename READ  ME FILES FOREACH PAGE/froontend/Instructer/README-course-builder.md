# course-builder.html — Course Builder

## Overview

`course-builder.html` is the content-editing workspace of the **EduVerse Instructor Portal**. It provides a rich two-panel interface where instructors can define course metadata, organise modules, add lessons (video, article, or quiz), upload media, and publish or save their course.

## Location in Project

```
/instructor/
└── course-builder.html   (accessed as course-builder.html?id=<course_id>)
```

## Layout

The page uses a two-column grid layout (`.builder-layout`):

| Column | Content |
|---|---|
| Left sidebar (360px, sticky) | Course metadata, thumbnail upload, readiness checklist |
| Right main area (fluid) | Module and lesson management |

---

## Left Sidebar — Course Details

### Course Details Panel
Form fields for course metadata:
- **Title** (required)
- **Short Description**
- **Category** — Programming, Design, Business, Mathematics, Science, Language, Other
- **Level** — Beginner through Post Graduate and Professional
- **Price (₹)** — 0 for free
- **Language** — English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Other

### Course Thumbnail Panel
- 16:9 drag-and-drop/click upload zone
- Accepts JPG, PNG, WEBP up to 5 MB
- Live image preview after selection
- Recommended size: 1280×720px

### Readiness Panel
A live checklist showing course completion percentage:
- ✅ Title added
- ✅ Description added
- ✅ Thumbnail uploaded
- ✅ At least one module exists
- ✅ At least one lesson exists

Progress bar and percentage update dynamically as fields are filled.

---

## Right Area — Module & Lesson Management

### Module List
Each module is a collapsible `.module-item` card showing:
- Drag handle for reordering
- Module title (editable inline)
- Lesson count badge
- Expand/collapse toggle
- Rename and delete actions

### Lesson Rows
Inside each module, lessons are listed as `.lesson-item` rows:
- Drag handle for reordering within the module
- Video thumbnail (or placeholder icon)
- **Type badge** — `VIDEO`, `ARTICLE`, or `QUIZ`
- Lesson title and metadata (duration, processing status)
- Status dot: Ready (green), Processing (amber), No file (grey)
- Edit and delete buttons
- Expand to show an **inline video player** for uploaded videos or YouTube/Vimeo embeds

### Add Lesson Button
An `+ Add Lesson` row at the bottom of each module opens the Lesson Modal.

### Add Module Button
A full-width `+ Add Module` button appends a new empty module.

---

## Lesson Modal

A multi-tabbed modal (`.modal-box.modal-lg`) for creating or editing a lesson.

### Tabs
| Tab | Content |
|---|---|
| Upload | Drag-and-drop zone for local video files |
| YouTube | Paste a YouTube URL |
| Vimeo | Paste a Vimeo URL |
| Article | Rich text area for written lessons |

### Upload Tab — Fields
- File dropzone (drag-and-drop or click) — shows file name on selection
- Upload progress bar with percentage and speed
- Video preview player (16:9) after upload

### Common Fields (all tabs)
- Lesson title
- Duration (auto-detected for uploads)
- Free preview toggle (makes lesson viewable without enrollment)

### Resources Section
Add downloadable attachments to a lesson:
- Title, file URL, type (PDF, Link, Code, ZIP, Other)
- Dynamic add/remove rows

---

## Top Navbar

| Element | Description |
|---|---|
| ← Back | Returns to `courses.html` |
| Course title | Shows the course title pulled from API |
| Status chip | Current status: Draft / Pending Review / Published |
| Save button | Saves current changes as a draft |
| Publish button | Submits the course for review / publishes it |
| Theme toggle | Switches between light and dark mode |
| User dropdown | Shows instructor name; Sign Out button |

---

## Toast Notifications

Slide-in toasts (`.toast`) at the bottom-right for actions:
- `toast-success` — green left border
- `toast-error` — red left border
- `toast-info` — blue left border

---

## UI Components

| Component | Class / ID |
|---|---|
| Two-panel layout | `.builder-layout` |
| Sticky sidebar | `.builder-sidebar` |
| Info panels | `.panel`, `.panel-header`, `.panel-body` |
| Thumbnail zone | `.thumb-zone` |
| Module cards | `.module-item`, `.module-header`, `.module-body` |
| Lesson rows | `.lesson-item` |
| Type badges | `.badge-video`, `.badge-article`, `.badge-quiz` |
| Lesson modal | `.modal-overlay`, `.modal-box.modal-lg` |
| Tab bar | `.tab-bar`, `.tab-btn` |
| Dropzone | `.dropzone` |
| Upload progress | `.upload-progress`, `.upload-progress-fill` |
| Video preview | `.video-preview-wrap` |
| Readiness checklist | `.checklist`, `.check-item`, `.check-icon` |
| Progress bar | `.progress-bar`, `.progress-fill` |
| Toast | `.toast-container`, `.toast` |
| Skeleton | `.skel` shimmer |

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
| ≤ 1023px | Two-column layout collapses to single column; sidebar becomes static |
| ≤ 640px | Two/three column form grids collapse to single column |

## Query Parameter

The page expects a `?id=<course_id>` query parameter to load an existing course. Without it, a new course creation flow is initiated.

## Related Pages

- `courses.html` — course listing (Back button target)
- `dashboard.html` — instructor home
