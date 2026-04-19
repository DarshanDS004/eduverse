# `materials.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `materials.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/materials.html` |
| **Page Title** | Study Materials — EduVerse Instructor |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page is the **Study Materials management hub** for instructors. It allows instructors to:
- Upload study materials (PDF, DOCX, images, etc.) with metadata (title, subject, type, price, tags)
- Set pricing: free or paid (with a price in INR)
- View all their published materials with purchase/download stats and earnings
- Delete materials

This is the **primary revenue-generating feature** for instructors on EduVerse outside of full courses.

---

## 2. Responsibility

- Present an upload form with a drag-and-drop zone for file selection
- Handle multipart file upload via raw XHR with real-time progress tracking
- Fetch and display all published materials via `GET /materials/my/materials`
- Compute and display aggregate stats (total materials, total purchases, downloads, earnings)
- Support material deletion via `DELETE /materials/{id}`
- Enforce instructor-only access

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icon rendering |

> Note: Chart.js is **not** imported on this page.

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
| `utils.js` | `Utils.escapeHtml()`, `Utils.formatDate()` |
| `store.js` | `Store.get('auth.token')` for XHR auth |
| `api.js` | `Api.get()`, `Api.delete()` |
| `auth.js` | Auth helpers |
| `init.js` | App shell init |

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode apply from `localStorage`.

### Step 2 — Auth Guard (IIFE)
Token + role check before DOM init.

### Step 3 — DOMContentLoaded Setup
Standard app shell wiring (feather, user info, sidebar, theme, dropdown, logout, `showToast`).

### Step 4 — Dropzone Setup
The file dropzone handles:
- `click` → triggers hidden `<input type="file">`
- `dragover` → adds `.dragover` class for visual feedback
- `dragleave` / `drop` → removes `.dragover` class; on drop, reads `e.dataTransfer.files[0]`
- On file select: shows `#file-selected` confirmation area with file name + size

### Step 5 — Price Toggle
```js
document.getElementById('is-free').addEventListener('change', function() {
  priceGroup.style.display = this.checked ? 'none' : 'block';
});
```
The price input group is hidden when "Free material" checkbox is checked.

### Step 6 — Upload Handler (`#upload-btn` click)
This is the core upload flow:
1. Validate: file must be selected and title must be filled
2. Build `FormData` with: `file`, `title`, `type`, `subject`, `description`, `price`, `is_free`, `tags`
3. Show progress bar
4. Create XHR manually (to track upload progress)
5. Set `Authorization: Bearer <token>` header (from `Store.get` or `localStorage`)
6. Track `xhr.upload.onprogress` to update bar width and percentage label
7. On `xhr.onload`: resolve if 2xx, reject with error message otherwise
8. On `xhr.onerror`: reject with 'Network error.'
9. On success: show toast, reset form, hide progress bar, call `loadMyMaterials()`
10. On failure: show error toast, hide progress bar

### Step 7 — `loadMyMaterials()` — Fetch & Render
```js
var res = await Api.get('/materials/my/materials');
var items = (res && res.data) || [];
```
Computes aggregate stats, updates 4 stat boxes, renders material rows.

### Step 8 — Material Row Rendering
For each material, renders a `.mat-row` with:
- Emoji icon (type-based) with colored background
- Title (truncated with ellipsis), subject + type + date meta
- Stats: Purchases, Downloads, Rating (★), Earned (₹)
- Price (FREE or ₹N)
- Delete button

---

## 5. Functions / Methods

### Upload Handler (anonymous, `#upload-btn` click) — `async`

| Property | Detail |
|---|---|
| **Purpose** | Upload a study material file with metadata |
| **Validation** | File required + title required |
| **Transport** | Raw XHR (not `fetch` or `Api.post`) for progress tracking |
| **API Call** | `POST /materials/upload` (multipart/form-data) |
| **Auth** | `Authorization: Bearer <token>` via `Store.get('auth.token')` or `localStorage.getItem('ev_token')` |
| **Progress** | Updates `#progress-bar-fill` width and `#progress-label` text in real-time |
| **Success** | Reset form, hide progress, `loadMyMaterials()`, success toast |
| **Failure** | Error toast with message |

**FormData fields:**

| Field | Source |
|---|---|
| `file` | Selected file object |
| `title` | `#mat-title` input |
| `type` | `#mat-type` select |
| `subject` | `#mat-subject` input |
| `description` | `#mat-desc` textarea |
| `price` | `#mat-price` (0 if free) |
| `is_free` | `#is-free` checkbox |
| `tags` | `#mat-tags` input |

---

### `loadMyMaterials()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch all instructor materials and render the list + stats |
| **API Call** | `GET /materials/my/materials` |
| **Returns** | `Promise<void>` |

**Aggregate stats computed client-side:**
```js
var totalPurchases = items.reduce((a, m) => a + (m.purchase_count || 0), 0);
var totalDownloads = items.reduce((a, m) => a + (m.download_count || 0), 0);
var totalEarnings  = items.reduce((a, m) => a + parseFloat(m.total_earnings || 0), 0);
```

**Stat box IDs updated:**
| ID | Value |
|---|---|
| `#stat-total` | `items.length` |
| `#stat-purchases` | `totalPurchases` |
| `#stat-downloads` | `totalDownloads` |
| `#stat-earnings` | `'₹' + totalEarnings.toFixed(0)` |

**Material row rendering** uses `typeConfig` for emoji and background color:
```js
{
  notes:          { emoji: '📝', bg: '#dbeafe' },
  question_paper: { emoji: '📋', bg: '#fef3c7' },
  study_guide:    { emoji: '📖', bg: '#d1fae5' },
  assignment:     { emoji: '✏️', bg: '#ede9fe' },
  other:          { emoji: '📄', bg: '#f3f4f6' }
}
```

---

### `deleteMaterial(id, title)` — `window.deleteMaterial` async

| Property | Detail |
|---|---|
| **Purpose** | Delete a material after confirmation |
| **Parameters** | `id` (number), `title` (string) |
| **Guard** | `confirm('Delete "' + title + '"? This cannot be undone.')` |
| **API Call** | `DELETE /materials/{id}` |
| **Success** | `showToast('success', ...)`, `loadMyMaterials()` |
| **Failure** | `showToast('error', ...)` |

---

### `_setStat(id, val)` — private helper

| Property | Detail |
|---|---|
| **Purpose** | Set text of a stat box and ensure correct class |
| **Parameters** | `id` (string), `val` (any) |
| **Side Effect** | Also sets `el.className = 'stat-box-value'` (reset on each update) |

---

### `showToast(type, title, message)` — local helper

| Property | Detail |
|---|---|
| **Purpose** | Display a toast notification (local implementation, not from shared helpers) |
| **Behavior** | Creates `.toast.toast-{type}` div, uses `Utils.escapeHtml()` (not `_esc`) for sanitization, auto-removes after 4000ms |
| **Note** | This is a **locally defined** `showToast` — separate from the global helper pattern used in other pages. Uses `Utils.escapeHtml` instead of inline `_esc`. |

---

## 6. API Role

| Method | Endpoint | Description | Format |
|---|---|---|---|
| `POST` | `/materials/upload` | Upload new study material | `multipart/form-data` |
| `GET` | `/materials/my/materials` | Get instructor's materials | JSON |
| `DELETE` | `/materials/{id}` | Delete a material | JSON |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        ├── .stats-row (4 boxes)
        │   ├── #stat-total     — Total Materials
        │   ├── #stat-purchases — Total Purchases
        │   ├── #stat-downloads — Total Downloads
        │   └── #stat-earnings  — Total Earned (₹)
        ├── .upload-card
        │   ├── .dropzone              ← Click or drag to select file
        │   ├── #file-selected         ← Shows selected file name + size
        │   ├── Form fields:
        │   │   ├── Title*, Type*, Subject, Description, Tags
        │   │   ├── "Free material" checkbox
        │   │   └── Price input (hidden when free)
        │   ├── .progress-bar-wrap     ← Upload progress (hidden until upload)
        │   └── Buttons: Reset | Upload Material
        └── .materials-table-wrap
            ├── Header: "My Materials" + count
            └── #my-materials-list (dynamic .mat-row per material)
```

### Material Types

| Value | Label |
|---|---|
| `notes` | Notes |
| `question_paper` | Question Paper |
| `study_guide` | Study Guide |
| `assignment` | Assignment |
| `other` | Other |

---

## 8. Data Flow

```
Page Load
    → Auth guard
    → DOMContentLoaded
    → loadMyMaterials()
        → GET /materials/my/materials
        → Compute stats → update stat boxes
        → Render material rows

User selects file via dropzone or file input
    → File stored in `selectedFile` variable
    → #file-selected area shown with name + size

User fills form + clicks "Upload Material"
    → Validate: file? title?
    → Show progress bar
    → XHR POST /materials/upload (multipart)
        → onprogress → update bar + %
        → onload (200-299) → resolve
        → onload (4xx/5xx) → reject
        → onerror → reject
    → Success: toast, reset form, loadMyMaterials()
    → Failure: toast error

User clicks "Delete" on a material row
    → confirm()
    → DELETE /materials/{id}
    → toast + loadMyMaterials()
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `Api.get('/materials/my/materials')`, `Api.delete('/materials/{id}')` |
| `store.js` | `Store.get('auth.token')` for XHR Authorization header |
| `utils.js` | `Utils.escapeHtml()`, `Utils.formatDate()` in row rendering |
| `dashboard.html` | References `materials.html` as a shortcut from welcome banner |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| No file selected | `showToast('error', 'Please select a file.')` — no XHR initiated |
| Empty title | `showToast('error', 'Please enter a title.')` |
| No auth token found | `reject(new Error('Not authenticated. Please log in again.'))` → caught → error toast |
| XHR non-2xx response | Parse response JSON for `.message` → `reject(new Error(...))` → caught → error toast |
| Network error | XHR `onerror` → `reject(new Error('Network error.'))` → caught → error toast |
| `loadMyMaterials()` fails | `list.innerHTML = '<div style="color:var(--color-danger)...">Failed to load materials.</div>'` |
| Delete fails | `showToast('error', err.message \|\| 'Failed to delete material.')` |
| Null/undefined material fields | `|| 0`, `|| 0`, `parseFloat(... || 0)` fallbacks in reduce |

---

## 11. Edge Cases / Notes

- **`finally` block**: The upload `try/catch/finally` ensures the upload button is re-enabled and its label restored regardless of success or failure — prevents the button from getting stuck in a disabled state.
- **Token fallback chain**: `Store.get('auth.token') || localStorage.getItem('ev_token')` — dual source for the JWT ensures compatibility even if the Store module isn't initialized.
- **`Utils.escapeHtml` vs `_esc`**: Unlike other pages that define and use an inline `_esc()` function, `materials.html` uses `Utils.escapeHtml()` from `utils.js` — the only page with this distinction.
- **Price handling**: When free checkbox is checked, `price` is set to `0` in the FormData. The backend determines free/paid by the `is_free` field.
- **Rating display**: If `m.avg_rating` is falsy, "No ratings" is displayed instead of a star rating.
- **Drag-and-drop**: `e.preventDefault()` is called on `dragover` to allow dropping. The `drop` event reads `e.dataTransfer.files[0]`.
- **Progress bar state**: The `#progress-bar-wrap` is shown at upload start and hidden in both success (`finally`) and error paths. The fill percentage is reset to `0%` after upload.

---

## 12. Summary

`materials.html` is the **Study Materials Upload and Management page** of the EduVerse Instructor Portal. It is the most important revenue-generation page for instructors — enabling upload of PDFs, documents, and other study files with flexible pricing. It uses raw XHR for file upload (instead of `fetch`) specifically to support real-time upload progress tracking. All stats (purchases, downloads, earnings) are computed client-side from the materials list response. The page differs from others in using `Utils.escapeHtml` for XSS protection rather than the inline `_esc` pattern.
