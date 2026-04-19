# `profile.html` — File Documentation

## 1. File Overview

| Property | Value |
|---|---|
| **File Name** | `profile.html` |
| **File Type** | Frontend Page — Instructor Portal |
| **Location** | `pages/instructor/profile.html` |
| **Page Title** | My Profile — EduVerse |
| **Access Control** | Instructor-only (role-guarded) |

### Purpose
This page allows instructors to **view and update their public profile** on EduVerse. It handles:
- Displaying and editing personal and professional information
- Uploading/changing the profile avatar image
- Changing the account password
- Viewing a small stat summary (total courses, students, average rating)
- Persisting name changes to `localStorage` so other pages reflect updated user info immediately

---

## 2. Responsibility

- Load instructor profile from `GET /instructor/profile`
- Populate all form fields with existing profile data
- Save updated profile data via `PATCH /instructor/profile`
- Upload a new avatar image via `Auth.uploadAvatar(file)`
- Update the account password via `PATCH /instructor/profile/password`
- Reflect name changes immediately in sidebar, navbar, and dropdown without requiring a re-login
- Enforce instructor-only access

---

## 3. Imports / Dependencies

### External CDN

| Resource | Purpose |
|---|---|
| `Google Fonts — Inter` | Typography |
| `Feather Icons 4.29.1` | SVG icons |
| `Chart.js 4.4.1` | Loaded but **not used** on this page |

### Local CSS / JS
Same standard set: `variables.css`, `reset.css`, `global.css`, `components.css`, `layout.css`, `utils.js`, `store.js`, `api.js`, `auth.js`, `init.js`.

---

## 4. Core Logic Breakdown

### Step 1 — Theme Bootstrap
Synchronous dark mode check from `localStorage`.

### Step 2 — Auth Guard (IIFE)
Standard instructor token + role check; redirect to login or 403 if invalid.

### Step 3 — DOMContentLoaded Setup
Standard wiring: feather icons, user info from localStorage, sidebar, theme toggle, dropdown, logout.

### Step 4 — `loadProfile()` — Fetch & Populate Form
```js
async function loadProfile() {
  var res = await Api.get('/instructor/profile');
  var p = (res && res.data) || {};
  document.getElementById('f-name').value = p.name || '';
  document.getElementById('f-email').value = p.email || '';
  // ... all other fields ...
  document.getElementById('profile-name-display').textContent = p.name || '—';
  // Stats: total_courses, total_students, avg_rating
  // Avatar: if p.avatar → <img>, else → initials
}
```

### Step 5 — Profile Save Handler (`#save-profile-btn` click)
Validates name is not empty, then:
```js
await Api.patch('/instructor/profile', {
  name, phone, specialization, qualification,
  experience_years, bio, linkedin_url, website
});
```
On success:
1. Shows success toast
2. Updates `#profile-name-display` in DOM
3. Updates sidebar, navbar, dropdown name elements immediately
4. Updates `localStorage` `ev_user.name` so other pages see the new name

### Step 6 — Avatar Upload (`#avatar-input` change)
```js
document.getElementById('avatar-input').addEventListener('change', async function() {
  if (!this.files[0]) return;
  await Auth.uploadAvatar(this.files[0]);
  var url = URL.createObjectURL(this.files[0]);
  document.getElementById('profile-avatar-lg').innerHTML = '<img src="' + url + '" ...>';
  showToast('success', 'Avatar updated!', '');
});
```
Uses `Auth.uploadAvatar()` (from `auth.js`) for the upload. Immediately previews the new avatar using a local object URL.

### Step 7 — Password Change (`#change-pw-btn` click)
```js
await Api.patch('/instructor/profile/password', {
  current_password: cur,
  new_password: nw
});
```
**Client-side validations before API call:**
1. All three fields (current, new, confirm) must be filled
2. New password must match confirm password
3. New password must be at least 8 characters

On success: fields cleared + success toast advising to sign in again.

---

## 5. Functions / Methods

### `loadProfile()` — `async function`

| Property | Detail |
|---|---|
| **Purpose** | Fetch instructor profile and populate all form fields |
| **API Call** | `GET /instructor/profile` |
| **Returns** | `Promise<void>` |
| **On Error** | `catch(e)` → `console.error(e)` only — no user-facing error |

**Fields populated:**

| Field ID | Profile Field |
|---|---|
| `#f-name` | `p.name` |
| `#f-email` | `p.email` (read-only display) |
| `#f-phone` | `p.phone` |
| `#f-specialization` | `p.specialization` |
| `#f-qualification` | `p.qualification` |
| `#f-experience` | `p.experience_years` |
| `#f-bio` | `p.bio` |
| `#f-linkedin` | `p.linkedin_url` |
| `#f-website` | `p.website` |
| `#profile-name-display` | `p.name` |
| `#ps-courses` | `p.total_courses` |
| `#ps-students` | `p.total_students` |
| `#ps-rating` | `p.avg_rating` (toFixed(1)) |
| `#profile-avatar-lg` | `<img>` if avatar URL, else initials via `_initials()` |

---

### Profile Save Handler (anonymous, `#save-profile-btn` click) — async

| Property | Detail |
|---|---|
| **Purpose** | Save updated profile fields to backend |
| **Validation** | Name must not be empty |
| **API Call** | `PATCH /instructor/profile` |
| **Post-success** | Updates DOM name in 3 locations + updates `ev_user` in localStorage |
| **On Error** | `showToast('error', ...)` |

**Note on localStorage update:**
```js
try {
  var u = JSON.parse(localStorage.getItem('ev_user') || '{}');
  u.name = name;
  localStorage.setItem('ev_user', JSON.stringify(u));
} catch(e) {}
```
This keeps the `ev_user` cache fresh, so sidebar/navbar on other pages reflect the new name immediately.

---

### Avatar Upload Handler (anonymous, `#avatar-input` change) — async

| Property | Detail |
|---|---|
| **Purpose** | Upload a new profile photo |
| **Method** | `Auth.uploadAvatar(file)` from `auth.js` |
| **Preview** | `URL.createObjectURL(file)` — instant local preview before server response |
| **On Error** | `showToast('error', err.message \|\| 'Upload failed.')` |

---

### Password Change Handler (anonymous, `#change-pw-btn` click) — async

| Property | Detail |
|---|---|
| **Purpose** | Change the instructor's account password |
| **API Call** | `PATCH /instructor/profile/password` |
| **Validations** | All fields present; passwords match; min 8 chars |
| **On Success** | Fields cleared + toast: "Please sign in again." |
| **On Error** | `showToast('error', ...)` |

---

### `_initials(n)` — private helper

| Property | Detail |
|---|---|
| **Purpose** | Generate 1–2 letter initials from a full name |
| **Parameters** | `n` — full name string |
| **Returns** | String: 2-char uppercase initials, `'?'` if falsy |
| **Logic** | Single word → first 2 chars; multiple words → first char of first + last word |

---

## 6. API Role

| Method | Endpoint | Description | Body |
|---|---|---|---|
| `GET` | `/instructor/profile` | Fetch full instructor profile | — |
| `PATCH` | `/instructor/profile` | Update profile fields | `{ name, phone, specialization, qualification, experience_years, bio, linkedin_url, website }` |
| `PATCH` | `/instructor/profile/password` | Change password | `{ current_password, new_password }` |
| (via `auth.js`) | Avatar upload endpoint | Upload avatar image | `multipart/form-data` |

---

## 7. UI Structure

```
.app-shell
└── .app-main
    └── .page-content
        └── 2-col layout: form (left) | sidebar stats (right)
            ├── Left — Profile form
            │   ├── Avatar section
            │   │   ├── #profile-avatar-lg     ← Large avatar (img or initials)
            │   │   └── "Change Photo" button → hidden #avatar-input file input
            │   ├── Profile info form
            │   │   ├── Full Name* (#f-name)
            │   │   ├── Email (#f-email) — read-only
            │   │   ├── Phone (#f-phone)
            │   │   ├── Specialization (#f-specialization)
            │   │   ├── Qualification (#f-qualification)
            │   │   ├── Experience (years) (#f-experience)
            │   │   ├── Bio textarea (#f-bio)
            │   │   ├── LinkedIn URL (#f-linkedin)
            │   │   └── Website (#f-website)
            │   └── "Save Changes" button (#save-profile-btn)
            └── Right — Stats + Password
                ├── Profile stats card
                │   ├── #profile-name-display
                │   ├── #ps-courses    — Total courses
                │   ├── #ps-students   — Total students
                │   └── #ps-rating     — Average rating
                └── Change Password card
                    ├── #pw-current   — Current password
                    ├── #pw-new       — New password
                    ├── #pw-confirm   — Confirm new password
                    └── #change-pw-btn
```

---

## 8. Data Flow

```
Page Load
    → Auth guard
    → DOMContentLoaded
    → loadProfile()
        → GET /instructor/profile
        → Populate all form fields
        → Update stats display
        → Render avatar (img or initials)

User edits profile + clicks "Save Changes"
    → Validate name
    → PATCH /instructor/profile
    → Update DOM: name display, sidebar, navbar, dropdown
    → Update ev_user.name in localStorage
    → showToast success

User clicks "Change Photo"
    → Hidden file input triggered
    → User selects image
    → Auth.uploadAvatar(file)
    → Instant preview: URL.createObjectURL(file)
    → showToast success / error

User fills password fields + clicks "Update Password"
    → Validate: all filled, match, min 8 chars
    → PATCH /instructor/profile/password
    → Clear fields
    → showToast: "Please sign in again"
```

---

## 9. Connections

| Dependency | Usage |
|---|---|
| `api.js` | `Api.get()`, `Api.patch()` |
| `auth.js` | `Auth.uploadAvatar(file)` |
| `localStorage` | `ev_user` — read for init, updated after name save |
| Sidebar/navbar elements | Updated immediately on name save |

---

## 10. Error Handling

| Scenario | Handling |
|---|---|
| `loadProfile()` fails | `catch(e)` → `console.error()` only — form remains empty |
| Name field empty | Client-side validate → `showToast('error', 'Full name is required.')` |
| Profile save fails | `showToast('error', err.message \|\| 'Failed to save.')` |
| Avatar upload fails | `showToast('error', err.message \|\| 'Upload failed.')` |
| Password fields empty | Client-side validate → `showToast('error', 'All password fields are required.')` |
| Password mismatch | Client-side validate → `showToast('error', 'New passwords do not match.')` |
| Password too short | Client-side validate → `showToast('error', 'Password must be at least 8 characters.')` |
| Password update fails | `showToast('error', err.message \|\| 'Failed to update password.')` |
| localStorage inaccessible | All `try/catch` wrapped |

---

## 11. Edge Cases / Notes

- **Email is read-only**: `#f-email` is populated but not included in the PATCH payload — email changes are not supported via this form.
- **Immediate UI sync**: After a name save, the code explicitly updates `#sidebar-user-name`, `#navbar-user-name`, and `#dd-user-name` IDs alongside `localStorage`. This avoids a page reload to reflect the name change.
- **Password advice**: The success toast says "Please sign in again." — this is advisory, not enforced. The page does not force a logout after a password change.
- **Avatar preview uses object URL**: The local file is previewed immediately with `URL.createObjectURL()`. The actual server-side URL is not rendered — if the user refreshes, the `loadProfile()` call will fetch the real URL.
- **`_initials(n)` edge case**: If only one word is in the name, `slice(0, 2).toUpperCase()` gives 2-character initials. If multiple words, it takes first char of first and last word.
- **Profile strength on dashboard**: The `_renderProfileStrength()` function on `dashboard.html` uses `ev_user` from localStorage — since `profile.html` only updates `name` in localStorage (not `bio` or `avatar`), the dashboard strength meter may lag behind until re-login.
- **`avg_rating` formatting**: `parseFloat(p.avg_rating).toFixed(1)` — if `avg_rating` is 0, it shows `'0.0'`. If falsy, shows `'—'`.
- **`Chart.js` unused**: Loaded but no charts rendered.

---

## 12. Summary

`profile.html` is the **Instructor Profile Management page** of the EduVerse Portal. It loads the instructor's complete profile from the API, allows editing personal and professional information, supports avatar upload with instant preview, and provides a password change form with full client-side validation. A key behavior is the immediate propagation of name changes to all visible UI elements (sidebar, navbar, dropdown) and `localStorage` — ensuring a seamless experience without page reload.
