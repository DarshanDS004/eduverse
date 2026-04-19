# `course-builder.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `course-builder.html` |
| **File Type** | Frontend Page — Instructor Portal (Complex Builder) |
| **Location** | `pages/instructor/course-builder.html` |
| **Page Title** | Course Builder — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This is the **most complex page** in the EduVerse Instructor Portal. It is a full-featured course content editor that allows instructors to:
- View and edit metadata of a specific course (loaded via `?course=<id>` URL param)
- Create, edit, and delete **modules** (sections/chapters)
- Create, edit, and delete **lessons** within modules (video, article, or quiz type)
- Upload video files directly to the backend with real-time progress tracking
- Link external video URLs (YouTube, Vimeo, direct MP4/WebM)
- Preview video/article content inline in a modal player
- Publish or save a course draft

---

## 2. Responsibility

- **Course loading**: Reads `?course=<id>` from URL, calls `GET /instructor/courses/{id}` to load course details and its modules/lessons
- **Course metadata editing**: Title, description, category, level, price, status — saved via `PATCH`
- **Module management**: Create, collapse/expand, delete modules
- **Lesson management**: Create and edit lessons with three types (video, article, quiz stub); set title, duration, description, preview flag, timestamps
- **Video upload**: Multipart file upload via XHR with progress bar and real-time percentage display
- **Video URL**: Supports YouTube, Vimeo, and direct URL linking
- **Inline preview**: Plays video lessons or shows article content in a modal
- **Thumbnail upload**: Uploads course thumbnail with 16:9 preview

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icon rendering via `feather.replace()` |

> Note: Chart.js is **not** loaded on this page — it is specific to data pages.

### Local CSS

| File | Purpose |
|---|---|
| `variables.css` | Design tokens |
| `reset.css` | CSS normalization |
| `global.css` | Base styles |
| `components.css` | UI components |
| `layout.css` | App shell layout |

### Local JavaScript

| File | Purpose |
|---|---|
| `utils.js` | HTML escaping, date formatting |
| `store.js` | State store (for token access) |
| `api.js` | HTTP API client |
| `auth.js` | Auth utilities |
| `init.js` | App shell initialization |

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Runs synchronously before DOM render to apply dark mode from `localStorage`.

### Step 2 — Course ID Resolution
```js
var params = new URLSearchParams(window.location.search);
var courseId = params.get('course');
if (!courseId) { showToast('error', 'No course ID'); return; }
```
If no `?course=` param, an error toast is shown and initialization halts.

### Step 3 — `loadCourse()` — Main Data Load
Fetches `GET /instructor/courses/{courseId}` and:
- Populates sidebar panel with course metadata fields
- Renders all modules and lessons using `renderModules()`
- Updates the "completeness" progress bar based on filled fields

### Step 4 — Module Creation
A "New Module" button triggers `POST /instructor/courses/{id}/modules` (or `/sections`). On success, `loadCourse()` is called to refresh.

### Step 5 — Lesson Modal
The lesson modal supports three tabs: **Video**, **Article**, **Quiz stub**.

For Video lessons:
- Sub-tabs: **Upload** (file) vs **URL** (external link)
- Upload: Uses XHR directly (not `Api.post`) to track upload progress
- URL: Supports YouTube, Vimeo, direct MP4

For Article lessons:
- Textarea for markdown/plain-text content

For Quiz stub:
- Minimal form; creates a placeholder lesson of type `quiz`

### Step 6 — Video Upload via XHR
```js
var xhr = new XMLHttpRequest();
xhr.open('POST', API_BASE + '/instructor/lessons/' + lessonId + '/video');
xhr.setRequestHeader('Authorization', 'Bearer ' + token);
xhr.upload.onprogress = function(e) { /* update progress bar */ };
xhr.onload = function() { /* handle success/error */ };
xhr.send(formData);
```
The JWT token is retrieved from `Store.get('auth.token')` with fallback to `localStorage.getItem('ev_token')`.

### Step 7 — `buildPlayerHTML(url, title)` — Video Player Factory
Determines which embed type to use based on the URL:
- YouTube URL → `<iframe>` with `youtube.com/embed/`
- Vimeo URL → `<iframe>` with `player.vimeo.com/video/`
- Other (direct file, local `/uploads/`) → `<video controls>` element

---

## 5. Functions / Methods

### `loadCourse()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Load course data and render the full builder UI |
| **Parameters** | None (reads `courseId` from outer scope) |
| **Returns** | `Promise<void>` |
| **API Call** | `GET /instructor/courses/{courseId}` |
| **Side Effects** | Populates form fields, calls `renderModules()`, updates progress bar |

---

### `renderModules(modules)` — function

| Property | Detail |
|---|---|
| **Purpose** | Render all modules with nested lessons into `#modules-list` |
| **Parameters** | `modules` — array of module objects with nested `videos` or `lessons` array |
| **Returns** | `void` |
| **Behavior** | Generates collapsible module items, each with lesson rows inside |

---

### `renderLessonRow(lesson, modId)` — function

| Property | Detail |
|---|---|
| **Purpose** | Build a single lesson row HTML with type badge, title, status, and action buttons |
| **Parameters** | `lesson` — lesson object, `modId` — parent module ID |
| **Returns** | HTML string |

**Status Dot Logic:**
- Green (`.dot-ready`) — lesson has a `video_url`
- Amber (`.dot-processing`) — lesson is processing
- Grey (`.dot-nofile`) — no file attached

---

### `openLessonModal(modId, lesson)` — function

| Property | Detail |
|---|---|
| **Purpose** | Open the lesson editor modal, pre-populating fields if editing |
| **Parameters** | `modId` — parent module ID, `lesson` — lesson object (or `null` for create) |
| **Returns** | `void` |
| **Side Effects** | Sets `currentModuleId`, `currentEditLesson` state; resets form; if editing, fills in existing values |

---

### Lesson Save Handler (`#save-lesson-btn` click) — `async`

| Property | Detail |
|---|---|
| **Purpose** | Create or update a lesson, handling video upload or URL linking |
| **Flow** | Reads form → validates → if upload mode and file selected: upload via XHR → else if URL mode: PATCH/POST with `video_url` → else: create stub lesson |
| **API Calls** | `POST /instructor/modules/{id}/videos`, `PATCH /instructor/lessons/{id}`, `POST /instructor/sections/{id}/lessons`, `POST /instructor/lessons/{id}/upload` |

---

### `deleteLesson(lessonId)` — `window.deleteLesson` async function

| Property | Detail |
|---|---|
| **Purpose** | Delete a lesson after confirmation |
| **Parameters** | `lessonId` (string or number) |
| **API Call** | `DELETE /instructor/lessons/{lessonId}` |

---

### `playLesson(videoUrl, title, type, lessonId)` — `window.playLesson`

| Property | Detail |
|---|---|
| **Purpose** | Open the inline video/article preview modal |
| **Parameters** | `videoUrl`, `title`, `type` (`'video'`, `'article'`), `lessonId` |
| **Behavior** | For articles: finds lesson in `courseData` cache and shows plain text content. For videos: builds player HTML from URL. If no URL, shows info toast. |

---

### `buildPlayerHTML(url, title)` — private function

| Property | Detail |
|---|---|
| **Purpose** | Returns HTML string for the appropriate video player based on URL |
| **Parameters** | `url` (string), `title` (string) |
| **Returns** | HTML string — `<iframe>` for YouTube/Vimeo, `<video>` for direct files |

**YouTube detection regex:**
```js
url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/)
```
**Vimeo detection regex:**
```js
url.match(/vimeo\.com\/(\d+)/)
```

---

### `closePlayerModal()` — `window.closePlayerModal`

| Property | Detail |
|---|---|
| **Purpose** | Stops video playback and closes the player modal |
| **Behavior** | Sets `#player-container innerHTML = ''` (stops video/iframe), then `closeModal()` |

---

### `deleteModule(moduleId)` — `window.deleteModule` async

| Property | Detail |
|---|---|
| **Purpose** | Delete a module and all its lessons |
| **API Call** | `DELETE /instructor/modules/{moduleId}` |
| **Guard** | `confirm()` dialog |

---

### `saveCourseInfo()` — course metadata save handler

| Property | Detail |
|---|---|
| **Purpose** | Save course metadata (title, description, category, level, price, status) |
| **API Call** | `PATCH /instructor/courses/{courseId}` |
| **Thumbnail** | If new thumbnail file selected: uploads via `POST /instructor/courses/{id}/thumbnail` using multipart FormData |

---

## 6. API Role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/instructor/courses/{id}` | Load course with modules and lessons |
| `PATCH` | `/instructor/courses/{id}` | Update course metadata |
| `POST` | `/instructor/courses/{id}/thumbnail` | Upload course thumbnail |
| `POST` | `/instructor/courses/{id}/modules` | Create new module |
| `DELETE` | `/instructor/modules/{id}` | Delete module |
| `POST` | `/instructor/modules/{id}/videos` | Add video lesson to module |
| `POST` | `/instructor/sections/{id}/lessons` | Add stub lesson to section |
| `PATCH` | `/instructor/lessons/{id}` | Update lesson |
| `DELETE` | `/instructor/lessons/{id}` | Delete lesson |
| `POST` | `/instructor/lessons/{id}/upload` | Upload video file for lesson |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        └── .builder-layout (2-col grid: 360px sidebar | 1fr content)
            ├── .builder-sidebar (sticky)
            │   ├── Course info panel      ← Title, description, category, price, status
            │   ├── Thumbnail panel        ← 16:9 drop zone with preview
            │   └── Progress panel         ← Completeness bar
            └── Main content
                ├── Page header            ← Course title + action buttons
                └── #modules-list          ← Dynamically rendered modules
                    └── .module-item
                        ├── .module-header  ← Title, collapse toggle, add/delete buttons
                        └── .module-body
                            └── .lesson-item (per lesson)
                                ├── Type badge, thumbnail, title, status dot
                                └── Play | Edit | Delete buttons
```

### Modals
- `#lesson-modal` — Create/edit lesson (Video/Article/Quiz tabs; Upload/URL sub-tabs)
- `#player-modal` — Inline video/article preview with auto-stop on close
- `#module-modal` — Create module (title only)

---

## 8. Data Flow

```
URL: /course-builder.html?course=42
        ↓
loadCourse() → GET /instructor/courses/42
        ↓
courseData = { id, title, modules: [{ id, title, videos: [...] }] }
        ↓
renderModules(courseData.modules)
        ↓
Each module → renderLessonRow() for each lesson
        ↓
User clicks "Add Lesson" →
    openLessonModal(modId, null) → empty form
    User fills form → clicks "Save Lesson"
        ├── If upload file → XHR upload with progress
        ├── If URL → PATCH/POST with video_url
        └── If stub → POST /sections/{id}/lessons
        → showToast → loadCourse() (full refresh)

User clicks lesson "Play" →
    playLesson(url, title, type, id) → buildPlayerHTML(url)
    → openModal('player-modal') → iframe or <video> renders

User clicks "Save Course Info" →
    PATCH /instructor/courses/{id} → if thumbFile → POST thumbnail
    → showToast → loadCourse()
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `apiGet`, `apiPost`, `apiPatch`, `apiDelete` wrappers |
| `store.js` | `Store.get('auth.token')` for XHR upload auth |
| `utils.js` | `esc()` for HTML escaping |
| `courses.html` | Entry point: after creating a course, user is offered a redirect here |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| No `?course=` param in URL | `showToast('error', ...)` + function returns |
| `loadCourse()` fails | `showToast('error', ...)` shown |
| Lesson save fails | `catch(e)` → `showToast('error', e.message)` |
| Video upload fails | XHR `onload` (non-2xx status) → `reject(new Error(err.message))` → `catch` → `showToast('error', ...)` |
| Network error on upload | XHR `onerror` → `reject(new Error('Network error.'))` |
| No video URL in "URL mode" | Validates before API call → `showToast('error', 'Please enter a video URL.')` |
| Lesson title empty | Validates → `showToast('error', 'Lesson title is required.')` |
| Module delete | `confirm()` guard before API call |
| Lesson delete | `confirm()` guard before API call |

---

## 11. Edge Cases / Notes

- **`courseData` cache**: The loaded course object is stored in a module-level `courseData` variable, used by `playLesson()` to find article content without re-fetching.
- **Video URL normalization**: `urlToSave` is built by checking if the URL starts with `http` — if not, it is prefixed with the API base path for local uploads.
- **Lesson type handling**: The module stores lessons in either `m.videos` or `m.lessons` — the render function handles both: `(m.videos || m.lessons || [])`.
- **Upload progress display**: The upload progress bar is shown/hidden only during an active XHR upload. After completion, it is hidden and reset.
- **Player cleanup on close**: Setting `innerHTML = ''` on the player container stops video playback (browser unloads the video element) and prevents iframe audio from continuing.
- **Stub lessons**: If no file is selected and no URL is entered, a "stub" lesson is created with `video_url: null` — it appears in the list with a grey status dot.
- **Feather icons in modals**: `feather.replace()` is called again when modals open, as dynamically injected HTML contains `data-feather` attributes that were not present during initial page init.
- **1,200+ lines**: This is the largest file in the portal due to the complexity of the builder logic.

---

## 12. Summary

`course-builder.html` is the **Course Content Builder** for EduVerse instructors. It is the most feature-rich page in the portal, enabling instructors to build structured course content with modules and lessons. It handles three lesson types (video, article, quiz stub), supports both file uploads and URL-based video linking, and provides inline preview via an embedded player. The builder uses a combination of the shared `Api.*` client and raw XHR for upload progress tracking. All UI state is local — the page re-fetches from the server on every create/edit/delete operation to stay in sync.
