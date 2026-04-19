# `certificates.html` — My Certificates

## Overview

`certificates.html` is the **certificates page** of the EduVerse Student Portal. It displays all certificates a student has earned by completing courses. Each certificate is shown as a styled card with a colour-coded banner, course title, issue date, certificate code, and action buttons to download (as PDF) or copy a shareable verification link.

---

## File Location

```
pages/student/certificates.html
```

---

## Authentication & Access Control

Standard synchronous student guard before render.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Download and share icons |
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
            ├── .page-header        ← title + subtitle
            └── .cert-grid          ← responsive certificate card grid
                └── .cert-card (×N)
```

---

## API Calls

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `loadCerts()` | `GET` | `/student/certificates` | Fetch all earned certificates |
| `downloadCert(id, title)` | `GET` | `/student/certificates/:id/download` | Get PDF download URL |
| `copyCertLink(code)` | — | (client-only) | Copy verification URL to clipboard |

### Response Shape (`GET /student/certificates`)

```json
{
  "data": [
    {
      "id": 1,
      "course_title": "Introduction to Biology",
      "title": "Introduction to Biology",
      "issued_at": "2025-08-20T00:00:00Z",
      "certificate_code": "EV-2025-BIO-001"
    }
  ]
}
```

### Response Shape (`GET /student/certificates/:id/download`)

```json
{
  "data": {
    "download_url": "https://cdn.eduverse.com/certs/EV-2025-BIO-001.pdf"
  }
}
```

---

## Certificate Card (`.cert-card`)

Each certificate renders as a vertical card:

### Banner Section (`.cert-banner`)

A gradient-filled header area (120px height) with a trophy emoji and "Certificate of Completion" label. Banner gradient is assigned by cycling through a predefined palette based on card index:

```js
var bannerColors = [
  'linear-gradient(135deg,#1e3a8a,#1A56DB)',   // Navy → Blue
  'linear-gradient(135deg,#065f46,#10b981)',   // Forest → Emerald
  'linear-gradient(135deg,#4c1d95,#7c3aed)',   // Deep Purple → Violet
  'linear-gradient(135deg,#92400e,#f59e0b)',   // Brown → Amber
  'linear-gradient(135deg,#7f1d1d,#ef4444)',   // Dark Red → Red
];
```

Assignment: `bannerColors[i % bannerColors.length]`

### Body Section (`.cert-body`)

| Element | Content |
|---|---|
| `.cert-title` | Course title (bold) |
| `.cert-course` | "Issued to [student name]" |
| `.cert-meta` | Left: date + certificate code; Right: action buttons |
| `.cert-date` | `Utils.formatDate(c.issued_at)` |
| `.cert-id` | Certificate code in monospace font |

### Action Buttons

| Button | Action |
|---|---|
| ⬇ Download | Calls `downloadCert(id, title)` |
| Share (share-2 icon) | Calls `copyCertLink(certificate_code)` |

---

## Download Flow

```
User clicks "Download"
    ↓
downloadCert(id, title)
    ↓
Api.certificates.download(id)  →  GET /student/certificates/:id/download
    ↓
If response.data.download_url:
    Utils.download(download_url, title + '.pdf')
    ← triggers browser file download
Else:
    showToast('error', 'Error', 'Download URL not available.')
```

`Utils.download(url, filename)` creates a temporary `<a>` element with `download` attribute and programmatically clicks it.

---

## Share / Copy Link Flow

```
User clicks share icon
    ↓
copyCertLink(certificate_code)
    ↓
Constructs URL:
  window.location.origin + '/pages/auth/verify-email.html?code=' + code
    ↓
Utils.copyToClipboard(url)  →  navigator.clipboard.writeText(url)
    ↓
Success → showToast('success', 'Link Copied!')
Failure → showToast('error', 'Failed')
```

The verification URL allows anyone with the link to validate the certificate's authenticity on the public verify page — no login required.

---

## Student Name Display

The certificate "Issued to" line uses the student name read from `localStorage`:

```js
var user;
try { user = JSON.parse(localStorage.getItem('ev_user')) || {}; } catch(e) { user = {}; }
var name = user.name || '';
```

This is used inside the card template: `'Issued to ' + _esc(name)`.

---

## Empty State

When the student has no certificates:

```html
<div class="empty-box">
  <div class="empty-box-icon">🏆</div>
  <div class="empty-box-title">No certificates yet</div>
  <p>Complete a course to earn your first certificate.</p>
</div>
```

This replaces the entire grid (`grid-column: 1 / -1` to span full width).

---

## Skeleton Loading

Three skeleton placeholders shown while data loads:

```html
<div class="skel" style="height:220px;border-radius:12px;"></div>
<div class="skel" style="height:220px;border-radius:12px;"></div>
<div class="skel" style="height:220px;border-radius:12px;"></div>
```

Replaced by real certificate cards once `loadCerts()` completes.

---

## Toast Notifications

```js
function showToast(type, title, msg) {
  // type: 'success' | 'error'
  // Displayed in fixed bottom-right corner
  // Auto-dismissed after 3000ms
}
```

---

## XSS Prevention

All dynamic content passed through `_esc()`:

```js
function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
```

Applied to: course title, certificate code, student name.

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.cert-grid` | `auto-fill minmax(320px, 1fr)` responsive grid |
| `.cert-card` | Individual certificate card |
| `.cert-banner` | Gradient header area (120px) |
| `.cert-banner-inner` | Centred content inside banner |
| `.cert-icon` | Trophy emoji (`font-size: 3rem`) |
| `.cert-body` | Card content below banner |
| `.cert-title` | Course name |
| `.cert-course` | "Issued to" line |
| `.cert-meta` | Footer row with date/code + buttons |
| `.cert-date` | Issue date text |
| `.cert-id` | Monospace certificate code |
| `.empty-box` | No-certificates placeholder |
| `.toast-container` | Fixed toast notification area |
| `.toast` / `.toast-success` | Toast card styles |

---

## Notes for Developers

- `feather.replace()` must be called **after** the certificate cards are injected into the DOM, since the download/share icons are dynamically generated. This is done inside `loadCerts()` after `grid.innerHTML` is set.
- The `copyCertLink()` function constructs the verify URL using `window.location.origin`, making it work correctly in both development (`localhost`) and production.
- Certificate codes (e.g., `EV-2025-BIO-001`) should be non-sequential and non-guessable to prevent certificate fraud via URL enumeration.
- The student name shown on the card comes from `localStorage`, not the API certificate payload. If the student changes their name after earning a certificate, the card will show the updated name but the actual PDF will reflect the name at the time of issue.
