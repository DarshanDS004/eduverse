# `materials.html` — Study Materials

## Overview

`materials.html` is the **study materials library page** of the EduVerse Student Portal. It provides students with a searchable, filterable catalog of supplementary learning resources (PDFs, notes, videos, etc.) that can be browsed, previewed in a detail modal, purchased, and downloaded. A dedicated "My Purchases" tab lists all previously acquired materials.

---

## File Location

```
pages/student/materials.html
```

---

## Authentication & Access Control

Standard synchronous student guard before render. Unauthenticated users → login. Non-students → 403.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Download, search, tag icons |
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
            ├── .page-tabs           ← Browse | My Purchases
            ├── #tab-browse
            │   ├── .filters-bar     ← search + subject + type + price
            │   └── .materials-grid  ← material cards
            └── #tab-purchases
                └── #purchases-list  ← purchased material rows
```

---

## Tab System

| Tab | Panel | Contents |
|---|---|---|
| Browse | `#tab-browse` | Searchable/filterable materials catalog |
| My Purchases | `#tab-purchases` | List of purchased materials with download button |

---

## Browse Tab

### API Call

```js
Api.get('/materials', params)
// params: { subject, type, search, price, page, limit }
```

### Filter Bar

| Control | Filters On | Options |
|---|---|---|
| Search input | `search` (debounced) | Free text |
| Subject dropdown | `subject` | Math, Science, English, History, etc. |
| Type dropdown | `type` | PDF, Video, Notes, Practice Set, etc. |
| Price dropdown | `price` | All, Free, Paid |

Filter changes trigger a new API call with reset pagination.

### Material Card (`.material-card`)

| Element | Content |
|---|---|
| Thumbnail area | Coloured background with file-type emoji or icon |
| `.material-card-category` | Subject/category (uppercase, blue) |
| `.material-card-title` | Material title (2-line clamp) |
| `.material-card-instructor` | "By Instructor Name" |
| Tags row | Pill tags rendered from `material.tags` (split on comma) |
| Level + pages metadata | `Utils.getLevelLabel(m.level)` + page count |
| Price / Free label | Decimal price or "Free" in green |
| Action button | "View Details" → opens detail modal |

---

## Material Detail Modal

Triggered by clicking "View Details" on any material card.

```js
async function openMaterialModal(id) {
  var res = await Api.get('/materials/' + id);
  var m = res && res.data;
  // Populates modal with full material details
}
```

### Modal Contents

| Field | Description |
|---|---|
| Title + subject | Header info |
| Description | Full text description |
| Instructor | Creator name |
| Level | Mapped via `Utils.getLevelLabel()` |
| File size | Formatted via `Utils.formatBytes()` |
| Tags | Rendered as coloured pill spans |
| Price | Decimal or "Free" |
| Action button | "Purchase" (paid) or "Download" (free / already purchased) |

### Purchase Flow

```
User clicks "Purchase" in modal
    ↓
buyMaterial(material)
    ↓
Api.post('/materials/' + material.id + '/purchase')
    ↓
Success:
  - If response includes download_url → trigger download immediately
  - Else → showToast('success', 'Purchased!') → close modal
Failure → showToast('error', err.message)
```

### Download Flow (already purchased or free)

```
User clicks "Download"
    ↓
downloadMaterial(id, title)
    ↓
Api.get('/materials/' + id + '/download')
    ↓
response.data.download_url → Utils.download(url, title)
```

---

## My Purchases Tab

### API Call

```js
Api.get('/materials/my/purchases')
// GET /materials/my/purchases
```

### Purchase Row

Each purchased material is listed as a horizontal row with:

| Element | Content |
|---|---|
| `.purchase-title` | Material title |
| Instructor + subject | Secondary metadata |
| File size | `Utils.formatBytes(item.file_size)` |
| Purchase date | `Utils.timeAgo(item.purchased_at)` |
| Download button | Triggers `downloadMaterial(id, title)` |

---

## API Calls Summary

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `loadMaterials(page)` | `GET` | `/materials` | Browse catalog with filters + pagination |
| `openMaterialModal(id)` | `GET` | `/materials/:id` | Fetch full material details |
| `buyMaterial(material)` | `POST` | `/materials/:id/purchase` | Purchase a material |
| `downloadMaterial(id, title)` | `GET` | `/materials/:id/download` | Get download URL |
| `loadPurchases()` | `GET` | `/materials/my/purchases` | List student's purchases |

---

## Response Shapes

### `GET /materials`

```json
{
  "data": {
    "materials": [
      {
        "id": 5,
        "title": "Algebra Practice Set",
        "description": "...",
        "instructor_name": "Mr. Shah",
        "subject": "Mathematics",
        "level": "high",
        "price": 0,
        "file_size": 204800,
        "pages": 48,
        "tags": "algebra,practice,worksheets",
        "purchased": false
      }
    ],
    "total": 42,
    "page": 1,
    "pages": 5
  }
}
```

### `GET /materials/:id/download`

```json
{
  "data": { "download_url": "https://cdn.eduverse.com/files/..." }
}
```

---

## XSS Prevention

All API-sourced strings use `Utils.escapeHtml()`:

```js
Utils.escapeHtml(m.title)
Utils.escapeHtml(m.instructor_name)
Utils.escapeHtml(tag.trim())
```

Tags are split on comma and each rendered individually through `escapeHtml`.

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.materials-grid` | Responsive auto-fill card grid |
| `.material-card` | Individual material card |
| `.material-card-category` | Subject label |
| `.material-card-title` | 2-line clamped title |
| `.purchase-row` | Row in My Purchases tab |
| `.purchase-title` | Material name in purchase list |
| `.price-free` | Green "Free" label |
| `.modal-overlay` / `.modal-box` | Detail/purchase modal |

---

## Empty States

| Context | Message |
|---|---|
| No materials found | "No materials found matching your filters." |
| No purchases | "You haven't purchased any materials yet." |

---

## Notes for Developers

- Tags are stored as a comma-separated string in the API response and split client-side: `m.tags.split(',')`.
- `Utils.formatBytes()` handles display of file sizes (e.g., "200 KB", "1.5 MB").
- `Utils.getLevelLabel()` maps level codes (`ug`, `pg`, `high`, etc.) to human-readable strings.
- `Utils.timeAgo()` is used for purchase dates in the My Purchases tab.
- Free materials can be downloaded directly without a purchase step — check `material.price === 0` or `material.purchased === true` to determine which button to show.
