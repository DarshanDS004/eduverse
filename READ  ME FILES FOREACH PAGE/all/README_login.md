# Login Page — README

**File:** `pages/auth/login.html`

**Purpose:** User login interface. Allows registered users to sign in with email and password.

**Route Name:** `'login'`

**Role Required:** None (public page)

**Layout:** `'auth'` (centered authentication layout)

---

## Page Overview

The login page is the gateway to EduVerse. It provides a clean, dual-panel interface with:
- **Left Panel** — Gradient background with trust badges (live stats, security info)
- **Right Panel** — Centered login form with email/password inputs
- **Dark Mode Support** — Fully responsive to light/dark theme
- **Form Validation** — Client-side and server-side error handling

### Key Features

✅ Email & password authentication
✅ Remember-me checkbox (extends session duration)
✅ Show/hide password toggle
✅ Real-time validation feedback
✅ Trust indicators (user count, uptime badge)
✅ Links to forgot password and sign up
✅ OAuth login (Google sign-in)
✅ Loading state management
✅ Responsive design (mobile, tablet, desktop)
✅ Dark/light theme toggle

---

## HTML Structure

```html
<body>
  <div class="auth-shell">
    <!-- LEFT PANEL: Gradient background with trust badges -->
    <div class="auth-left">
      <div class="auth-left-pattern"></div>  <!-- Dot pattern -->
      
      <!-- Brand -->
      <div class="auth-left-brand">
        <div class="auth-left-logo">E</div>
        <span class="auth-left-name">EduVerse</span>
      </div>
      
      <!-- Trust message -->
      <div class="auth-left-content">
        <h2 class="auth-left-title">Welcome back!</h2>
        <p class="auth-left-desc">Sign in to your account and continue learning.</p>
      </div>
      
      <!-- Live statistics badges -->
      <div class="auth-live-badges">
        <div class="auth-live-badge">
          <div class="alb-icon alb-icon-green">
            <i data-feather="users"></i>
          </div>
          <div>
            <div class="alb-label">Active Learners</div>
            <div class="alb-value">5,000+</div>
          </div>
        </div>
        <div class="auth-live-badge">
          <div class="alb-icon alb-icon-amber">
            <i data-feather="trending-up"></i>
          </div>
          <div>
            <div class="alb-label">Courses Available</div>
            <div class="alb-value">500+</div>
          </div>
        </div>
      </div>
      
      <!-- Stats footer -->
      <div class="auth-left-stats">
        <div class="auth-stat">
          <div class="auth-stat-value">99.9%</div>
          <div class="auth-stat-label">Uptime SLA</div>
        </div>
        <div class="auth-stat">
          <div class="auth-stat-value">24/7</div>
          <div class="auth-stat-label">Support</div>
        </div>
      </div>
    </div>
    
    <!-- RIGHT PANEL: Login form -->
    <div class="auth-right">
      <div class="auth-box">
        <!-- Header -->
        <div class="auth-box-header">
          <h1 class="auth-box-title">Sign In</h1>
          <p class="auth-box-subtitle">Access your EduVerse account</p>
        </div>
        
        <!-- Alert area (hidden by default) -->
        <div class="auth-alert" id="auth-alert" role="alert" hidden></div>
        
        <!-- Login Form -->
        <form class="auth-form" id="login-form" novalidate>
          
          <!-- Email field -->
          <div class="form-group">
            <label class="form-label" for="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
            <div class="form-error" id="e-email"></div>
          </div>
          
          <!-- Password field with toggle -->
          <div class="form-group">
            <label class="form-label" for="password">Password *</label>
            <div class="input-wrap">
              <input
                type="password"
                id="password"
                name="password"
                class="form-input"
                placeholder="Enter your password"
                autocomplete="current-password"
                required
              />
              <button
                type="button"
                class="input-toggle-btn"
                id="toggle-password"
                aria-label="Show password"
              >
                <i data-feather="eye" style="width:16px;height:16px;"></i>
              </button>
            </div>
            <div class="form-error" id="e-password"></div>
          </div>
          
          <!-- Remember me checkbox -->
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="remember" id="remember" />
              <span>Remember me</span>
            </label>
          </div>
          
          <!-- Submit button -->
          <button type="submit" id="login-btn" class="btn btn-primary btn-lg" style="width:100%;">
            Sign In
          </button>
          
        </form>
        
        <!-- Divider -->
        <div class="auth-divider">or</div>
        
        <!-- OAuth buttons -->
        <button type="button" id="google-login-btn" class="btn btn-outline btn-lg" style="width:100%;">
          <i data-feather="mail" style="width:18px;height:18px;"></i>
          Continue with Google
        </button>
        
        <!-- Footer links -->
        <div class="auth-footer">
          <p class="auth-footer-text">
            <a href="forgot-password.html">Forgot password?</a>
          </p>
          <p class="auth-footer-text">
            Don't have an account? <a href="register.html">Create one</a>
          </p>
        </div>
        
      </div>
    </div>
  </div>
</body>
```

---

## CSS Classes

### Layout Classes

| Class | Purpose |
|-------|---------|
| `.auth-shell` | Root container, flex layout |
| `.auth-left` | Left gradient panel (hidden on mobile) |
| `.auth-right` | Right form panel |
| `.auth-box` | Centered white card |
| `.auth-box-header` | Title + subtitle area |

### Form Classes

| Class | Purpose |
|-------|---------|
| `.auth-form` | Form container |
| `.form-group` | Input wrapper with label |
| `.form-label` | Label styling |
| `.form-input` | Input field styling |
| `.input-wrap` | Password toggle wrapper |
| `.input-toggle-btn` | Eye icon button |
| `.form-error` | Error message styling |
| `.checkbox-label` | Remember me checkbox |

### Component Classes

| Class | Purpose |
|-------|---------|
| `.auth-alert` | Alert message box |
| `.auth-divider` | Horizontal divider |
| `.auth-footer` | Footer links area |
| `.auth-live-badges` | Trust badges container |
| `.auth-live-badge` | Individual badge |

### Utility Classes

| Class | Purpose |
|-------|---------|
| `.btn` | Button base |
| `.btn-primary` | Primary button (blue) |
| `.btn-outline` | Outline button |
| `.btn-lg` | Large button |

---

## JavaScript Functionality

### Form Submission

```javascript
document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  
  // 1. Get form values
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember').checked;
  
  // 2. Clear previous errors
  clearErrors();
  
  // 3. Call Auth.login()
  try {
    const user = await Auth.login({ email, password, remember });
    
    // 4. Redirect to dashboard (based on role)
    switch(user.role) {
      case 'student':
        Router.navigate('student.dashboard');
        break;
      case 'instructor':
        Router.navigate('instructor.dashboard');
        break;
      case 'parent':
        Router.navigate('parent.dashboard');
        break;
      case 'institute':
        Router.navigate('institute.dashboard');
        break;
      case 'superadmin':
        Router.navigate('superadmin.dashboard');
        break;
    }
  } catch (err) {
    if (err.clientError) {
      // Show validation errors
      Auth.renderErrors(err.errors, document.getElementById('login-form'));
    } else {
      // Show alert error
      Auth.showAlert(err.message, 'error', document.getElementById('login-form'));
    }
  }
});
```

### Password Toggle

```javascript
const toggleBtn = document.getElementById('toggle-password');
const passwordInput = document.getElementById('password');
let isVisible = false;

toggleBtn.addEventListener('click', function () {
  isVisible = !isVisible;
  passwordInput.type = isVisible ? 'text' : 'password';
  
  // Update icon
  const icon = toggleBtn.querySelector('i');
  icon.setAttribute('data-feather', isVisible ? 'eye-off' : 'eye');
  feather.replace({ 'stroke-width': 1.75 });
});
```

### OAuth Login

```javascript
document.getElementById('google-login-btn').addEventListener('click', function () {
  Auth.loginWithGoogle();
  // Redirects to /api/v1/auth/oauth/google
});
```

---

## Validation Rules

### Email
- ✅ Required
- ✅ Valid email format (user@domain.com)
- ❌ Empty string
- ❌ Invalid format (missing @, domain, etc.)

**Error Message:** "Enter a valid email address."

### Password
- ✅ Required
- ✅ Any length (server enforces minimum)
- ❌ Empty string

**Error Message:** "Password is required."

---

## Form Error Handling

### Client-Side Errors (Before Submission)

```javascript
function clearErrors() {
  const form = document.getElementById('login-form');
  const errorDivs = form.querySelectorAll('.form-error');
  errorDivs.forEach(el => el.textContent = '');
  
  const inputs = form.querySelectorAll('.input-error');
  inputs.forEach(el => el.classList.remove('input-error'));
}
```

### Server-Side Errors (After Submission)

Error response from backend:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "details": [
      { "field": "email", "message": "User not found" }
    ]
  }
}
```

### Display Errors

```javascript
// For field-level errors (email, password)
Auth.renderErrors(errors, form);
// Each error has { field, message }
// Finds input[name="field"] and shows message below

// For form-level errors
Auth.showAlert('Login failed. Check your credentials.', 'error', form);
// Shows at top of form, auto-hides after 6 seconds
```

---

## Theme Support

The page supports light and dark themes:

```css
/* Light Mode (default) */
body {
  background: var(--bg-page);  /* #f4f6fb */
  color: var(--text-primary); /* #111827 */
}

.auth-box {
  background: var(--bg-surface);  /* #ffffff */
  border: var(--card-border);     /* #e5e7eb */
}

/* Dark Mode */
[data-theme="dark"] body {
  background: var(--bg-page);  /* #0f1117 */
  color: var(--text-primary); /* #f3f4f6 */
}

[data-theme="dark"] .auth-box {
  background: var(--bg-surface);  /* #1a1d27 */
  border: var(--card-border);     /* #2a2d3e */
}
```

Theme persistence: User's theme preference is saved in localStorage and restored on every page load.

---

## Responsive Breakpoints

### Desktop (≥1024px)
- Two-column layout (left panel + form)
- Left panel visible with gradient background
- Form centered on right side
- Wide buttons and inputs

### Tablet (641px - 1023px)
- Single column (form only)
- Left panel hidden
- Full-width form
- Touch-friendly buttons

### Mobile (≤640px)
- Single column
- Left panel completely hidden
- Full-width form, adjusted padding
- Smaller font sizes
- Touch-optimized input sizes

---

## Data Flow

```
User visits /pages/auth/login.html
           ↓
init.js runs → Auth.init() → Check if already logged in
           ↓
If logged in → Redirect to dashboard
           ↓
If not logged in → Show login form
           ↓
User enters email + password + checks remember-me
           ↓
User clicks "Sign In"
           ↓
Form submit event
           ↓
Client-side validation via Utils.isValidEmail()
           ↓
If validation fails → Show field errors, return
           ↓
Call Auth.login({ email, password, remember })
           ↓
Auth.js validates input again
           ↓
POST /api/v1/auth/login { email, password }
           ↓
Backend validates credentials
           ↓
If invalid → Return 401 { error, details }
             → Show Auth.showAlert()
             → Highlight error fields
           ↓
If valid → Return { token, refresh_token, user, expires_at }
         → Store.set('auth', ...)
         → localStorage stores token + user
         → Router navigates to user's dashboard (by role)
           ↓
Dashboard page loads with user data
```

---

## Dependencies

### CSS Files
- `variables.css` — Design tokens
- `reset.css` — CSS reset
- `global.css` — Global styles
- `components.css` — Component styles
- `layout.css` — Layout system

### JavaScript Files
- `utils.js` — Validators, storage helpers
- `store.js` — Global state
- `auth.js` — Authentication logic
- `router.js` — Routing (auto-redirect if already logged in)

### External Libraries
- Feather Icons (CDN)
- Google Fonts Inter (CDN)

### Browser APIs
- localStorage — Session persistence
- fetch — HTTP requests
- DOM APIs — Form manipulation

---

## API Endpoints Called

### POST /api/v1/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Secret123",
  "remember": true
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "user": {
      "id": 123,
      "name": "Ravi Kumar",
      "email": "ravi@example.com",
      "role": "student",
      "avatar": "https://...",
      "phone": "9876543210"
    },
    "expires_at": "2025-04-18T18:30:00Z"
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
}
```

---

## State Management

**Store Keys Used:**
- `auth.isLoggedIn` — Read on init to check if already logged in
- `auth.token` — Set after successful login
- `auth.user` — Set after successful login
- `auth.role` — Set after successful login
- `ui.theme` — Read to apply theme

**Store Updates:**
```javascript
Store.set('auth', {
  isLoggedIn: true,
  token: token,
  refreshToken: refresh_token,
  expiresAt: expires_at,
  user: user,
  role: user.role,
});
```

---

## User Experience Details

### Loading State
When user clicks "Sign In":
```javascript
Utils.setButtonLoading(btn, 'Signing in…');
// Button disabled, shows spinner, text changes
// After response (success or error), text/state restored
Utils.clearButtonLoading(btn);
```

### Auto-Hide Alert
When showing error alert:
```javascript
Auth.showAlert(message, 'error', form);
// Alert shows for 6 seconds, then auto-hides
// User can manually close by clicking X
```

### Form Focus
After error, focus returns to first invalid field:
```javascript
const firstError = form.querySelector('.form-error:not(:empty)');
if (firstError) {
  firstError.closest('.form-group').querySelector('input').focus();
}
```

---

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome (latest) | ✅ Full |
| Firefox (latest) | ✅ Full |
| Safari (latest) | ✅ Full |
| Edge (latest) | ✅ Full |
| IE 11 | ⚠️ Partial (no async/await) |

---

## Accessibility

### ARIA Labels
```html
<button aria-label="Show password"></button>
<div role="alert" class="auth-alert"></div>
```

### Keyboard Navigation
- ✅ Tab through inputs
- ✅ Enter to submit form
- ✅ Focus visible on all interactive elements

### Screen Reader Support
- ✅ Form labels associated with inputs
- ✅ Error messages announced
- ✅ Button states announced

---

## Security Considerations

✅ **HTTPS Only** — Page must be served over HTTPS

✅ **No Password Logging** — Password never logged to console

✅ **CSRF Protection** — Backend should validate CSRF token (if used)

✅ **Rate Limiting** — Backend should rate-limit login attempts

✅ **Token Storage** — Token in localStorage, not in DOM

✅ **XSS Prevention** — All user input escaped before display

✅ **Input Validation** — Both client-side (UX) and server-side (security)

---

## Testing Scenarios

### Valid Login
```javascript
Email: "student@example.com"
Password: "ValidPassword123"
Remember: true
Result: Redirects to student dashboard, token stored
```

### Invalid Email Format
```javascript
Email: "invalid-email"
Password: "SomePassword"
Result: Shows "Enter a valid email address."
Form doesn't submit
```

### Invalid Credentials
```javascript
Email: "student@example.com"
Password: "WrongPassword"
Result: Shows "Email or password is incorrect"
Form shows error alert
```

### Network Timeout
```javascript
User submits form
Backend doesn't respond within 30 seconds
Result: Shows "Connection timeout. Please try again."
Button re-enabled
```

### Already Logged In
```javascript
User visits /pages/auth/login.html
Token exists in localStorage
Auth.init() detects isLoggedIn = true
Result: Automatically redirects to dashboard
Login form never shown
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Login button disabled | Already loading | Check button state, don't double-click |
| Form data disappears | Page refresh | Auto-save form to localStorage before submit |
| Error messages not showing | Form not found | Check element IDs match |
| Password toggle not working | Feather not initialized | Call `feather.replace()` after DOM update |
| Theme not persisting | localStorage disabled | Check browser permissions |
| Can't login with email | Email not in system | Suggest sign up instead |
| "Remember me" not working | Backend not handling it | Check token refresh duration logic |

---

## Links to Related Pages

- **Sign Up:** `register.html` — Create new account
- **Forgot Password:** `forgot-password.html` — Request password reset
- **Email Verification:** `verify-email.html` — Confirm email address
- **Student Dashboard:** `student/dashboard.html` — Main student page (after login)
- **Instructor Dashboard:** `instructor/dashboard.html` — Main instructor page (after login)

---

## Environment Variables

None required for this page. Uses shared config:

```javascript
// From Auth.js or config
const API_URL = 'https://api.eduverse.com/api/v1';
// Login endpoint: API_URL + '/auth/login'
```

---

## Performance Notes

**Page Load Time:** ~200-400ms (optimized)
- CSS is inline (no HTTP request delay)
- JS files are small and cached
- No images to load on initial page

**Largest assets:**
- `login.html` — ~20 KB
- `utils.js` — ~31 KB (cached)
- `auth.js` — ~22 KB (cached)

**Optimization tips:**
- Use service worker to cache assets
- Minify CSS/JS in production
- Compress assets with gzip

---

## Summary

The login page is a **critical entry point** to EduVerse. It handles user authentication securely with:

✅ Clean, professional UI
✅ Responsive design (mobile to desktop)
✅ Comprehensive form validation
✅ Friendly error messages
✅ Theme support (light/dark)
✅ OAuth integration option
✅ Secure token handling
✅ Accessible form design

