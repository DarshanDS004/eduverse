# `profile.html` — Student Profile

## Overview

`profile.html` is the **profile management page** of the EduVerse Student Portal. It lets students view and edit their personal information (name, phone, date of birth, grade level, institute code, bio), upload a profile avatar, and change their password. The email address field is read-only to prevent unauthorized changes without email verification.

---

## File Location

```
pages/student/profile.html
```

---

## Authentication & Access Control

Standard synchronous student guard before render.

---

## Dependencies

### External (CDN)

| Library | Version | Purpose |
|---|---|---|
| Feather Icons | 4.29.1 | Icons (user, camera, lock) |
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
            └── .profile-layout      ← CSS grid (left sidebar + right form)
                ├── .profile-left
                │   ├── .avatar-card ← avatar display + upload button
                │   └── .profile-card ← Change Password card
                └── .profile-right
                    └── .profile-card ← Personal Information edit form
```

---

## API Calls

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `loadProfile()` | `GET` | `/student/profile` | Fetch current profile data |
| Save profile button | `PATCH` | `/student/profile` | Update personal information |
| `#change-pw-btn` click | `PATCH` | `/student/profile/password` | Change password |
| `#avatar-input` change | (inferred) `POST` | `/student/profile/avatar` | Upload new avatar image |

### Response Shape (`GET /student/profile`)

```json
{
  "data": {
    "name": "Priya Sharma",
    "email": "priya@example.com",
    "phone": "9876543210",
    "dob": "2004-03-15",
    "grade": "ug",
    "institute_code": "INST001",
    "bio": "Passionate about learning...",
    "avatar": "https://cdn.eduverse.com/avatars/priya.jpg"
  }
}
```

---

## Profile Load Flow

```
DOMContentLoaded
    ↓
loadProfile()
    ↓
Api.student.profile()  →  GET /student/profile
    ↓
Populate form fields:
  f-name     ← p.name
  f-email    ← p.email  (readonly)
  f-phone    ← p.phone
  f-dob      ← Utils.formatDate(p.dob, 'input')  →  YYYY-MM-DD
  f-grade    ← p.grade  (select value)
  f-inst-code ← p.institute_code
  f-bio      ← p.bio
    ↓
Render avatar:
  If p.avatar → <img src="..."> inside avatar circle
  Else → initials text
```

---

## Personal Information Form

### Form Fields

| Field ID | Type | Description | Editable |
|---|---|---|---|
| `f-name` | `text` | Full name (required) | ✅ Yes |
| `f-email` | `email` | Email address | ❌ Read-only |
| `f-phone` | `tel` | 10-digit phone number | ✅ Yes |
| `f-dob` | `date` | Date of birth | ✅ Yes |
| `f-grade` | `select` | Education level | ✅ Yes |
| `f-inst-code` | `text` | Institute code (optional) | ✅ Yes |
| `f-bio` | `textarea` | About / bio (resizable) | ✅ Yes |

### Grade/Level Options

| Value | Display Label |
|---|---|
| `preschool` | Pre-School |
| `primary` | Primary (1–5) |
| `middle` | Middle (6–8) |
| `high` | High School (9–12) |
| `ug` | Undergraduate |
| `pg` | Postgraduate |

### Save Flow

```
User clicks "Save Changes"
    ↓
Collect form values:
  { name, phone, dob, grade, bio, institute_code }
    ↓
Api.patch('/student/profile', data)  (inferred)
    ↓
Success → showToast('success', 'Profile Updated!')
Failure → showToast('error', err.message)
```

> Email is excluded from the PATCH payload because the field is read-only.

---

## Avatar Upload

```html
<div class="avatar-circle" id="avatar-display">
  <!-- img or initials -->
</div>
<button onclick="document.getElementById('avatar-input').click()">
  Change Photo
</button>
<input type="file" id="avatar-input" accept="image/*" style="display:none;" />
```

On file selection:
```js
document.getElementById('avatar-input').addEventListener('change', async function() {
  // Upload file, update avatar display
  // POST /student/profile/avatar (inferred)
});
```

---

## Password Change Card

### Fields

| Field ID | Type | Description |
|---|---|---|
| `pw-current` | `password` | Current password |
| `pw-new` | `password` | New password (min 8 chars) |
| `pw-confirm` | `password` | Confirm new password |

### Validation

```js
var valid = Utils.validatePassword(newPw);    // min 8 characters
if (newPw !== confirmPw) { /* mismatch error */ }
if (current === '') { /* empty current password error */ }
```

### Change Password Flow

```
User clicks "Update Password"
    ↓
Client-side validation:
  - current_password non-empty
  - new_password min 8 chars
  - new_password === confirm_password
    ↓
Api.patch('/student/profile/password', {
  current_password: current,
  new_password: newPw
})
    ↓
Success → showToast('success', 'Password Changed!')
         → clear all password fields
Failure → showToast('error', err.message)
```

---

## Toast Notifications

```js
function showToast(type, title, msg) {
  // Creates .toast.toast-{success|error} element
  // Auto-removed after 3–4 seconds
}
```

---

## CSS Classes (Page-Specific)

| Class | Purpose |
|---|---|
| `.profile-layout` | Two-column page grid |
| `.profile-left` | Left sidebar (avatar + password) |
| `.profile-right` | Right main edit form |
| `.profile-card` | Section card with header + body |
| `.profile-card-header` | Card title + optional action button |
| `.avatar-card` | Card containing avatar display |
| `.avatar-circle` | Circular avatar container |
| `.form-grid` | Two-column form field grid |
| `.form-grid-full` | Full-width field spanning both columns |
| `.form-group` | Label + input wrapper |
| `.form-label` | Input label |
| `.form-input` | Styled text input / select / textarea |

---

## Security

- **Email is read-only** — preventing silent email hijacking without verification
- **Password change requires current password** — protecting against session hijacking
- **`Utils.validatePassword()`** enforces minimum 8-character length before API call
- All toast messages are escaped via `_esc()` before DOM insertion

---

## Notes for Developers

- `Utils.formatDate(p.dob, 'input')` should return the date in `YYYY-MM-DD` format for the `<input type="date">` value attribute.
- The email field has `readonly` attribute and `cursor: not-allowed` styling — it is intentionally excluded from the PATCH payload.
- The PATCH endpoint for profile and the avatar upload endpoint are inferred from code patterns — verify with the backend spec.
- Password fields are cleared after a successful change for security — do not remove this behaviour.
- The `form-grid` layout uses CSS grid with two columns; `.form-grid-full` spans `grid-column: 1 / -1`.
