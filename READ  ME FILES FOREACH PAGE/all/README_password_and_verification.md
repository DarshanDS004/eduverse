# Forgot Password, Reset Password & Email Verification Pages — README

---

## 1. Forgot Password Page

**File:** `pages/auth/forgot-password.html`

**Purpose:** Allow users who forgot their password to request a password reset email.

**Route Name:** `'forgot-password'`

**Role Required:** None (public page)

---

### Overview

Simple, single-step form where user enters their email address. The backend sends a password reset link to that email.

### Form Fields

#### Email Address
- **Type:** Email input
- **Required:** Yes
- **Validation:** Valid email format
- **Placeholder:** "you@example.com"
- **Validation Message:** "Enter a valid email address."

### HTML Structure

```html
<form class="auth-form" id="forgot-form" novalidate>
  
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
  
  <button type="submit" id="reset-btn" class="btn btn-primary btn-lg" style="width:100%;">
    Send Reset Link
  </button>
  
</form>

<p class="auth-footer-text" style="margin-top:var(--space-5);">
  Remember your password? <a href="login.html">Sign in</a>
</p>
```

### JavaScript

```javascript
document.getElementById('forgot-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  
  // Validate
  if (!Utils.isValidEmail(email)) {
    Utils.showFieldError(
      document.getElementById('email'),
      'Enter a valid email address.'
    );
    return;
  }
  
  // Submit
  try {
    Utils.setButtonLoading(document.getElementById('reset-btn'), 'Sending…');
    
    await Auth.forgotPassword({ email: email });
    
    // Show success message
    document.getElementById('forgot-form').style.display = 'none';
    document.querySelector('.auth-box-header').innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📧</div>
        <h2>Check Your Email</h2>
        <p style="color: var(--text-muted);">
          We've sent a password reset link to<br />
          <strong>${Utils.escapeHtml(email)}</strong>
        </p>
      </div>
    `;
    
  } catch (err) {
    Utils.clearButtonLoading(document.getElementById('reset-btn'));
    Auth.showAlert(err.message || 'Request failed', 'error', this);
  }
});
```

### API Endpoint

**POST /api/v1/auth/forgot-password**

**Request:**
```json
{ "email": "user@example.com" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset link sent to email"
  }
}
```

### User Experience

```
User enters email
           ↓
Clicks "Send Reset Link"
           ↓
Backend generates token (expires in 1 hour)
           ↓
Backend sends email with reset link:
  https://eduverse.com/pages/auth/reset-password.html?token=abc123xyz
           ↓
Page shows "Check your email" message
           ↓
User receives email
           ↓
User clicks link in email
           ↓
Redirected to /pages/auth/reset-password.html?token=...
```

---

## 2. Reset Password Page

**File:** `pages/auth/reset-password.html`

**Purpose:** Allow user to set a new password after clicking the reset link from their email.

**Route Name:** `'reset-password'`

**Role Required:** None (public, but requires valid token in URL)

---

### Overview

Accessed via email link with token in URL. User enters new password and confirms it. Once submitted, password is updated and user is directed to login.

### Form Fields

#### New Password
- **Type:** Password input with toggle
- **Required:** Yes
- **Validation:** Same as registration (8+ chars, uppercase, digit)
- **Strength Indicator:** Visual feedback bar
- **Error Message:** "Password too weak"

#### Confirm Password
- **Type:** Password input with toggle
- **Required:** Yes
- **Validation:** Must match New Password
- **Error Message:** "Passwords do not match"

### HTML Structure

```html
<form class="auth-form" id="reset-form" novalidate>
  
  <div class="form-group">
    <label class="form-label" for="new-password">New Password *</label>
    <div class="input-wrap">
      <input
        type="password"
        id="new-password"
        name="password"
        class="form-input"
        placeholder="Min. 8 characters"
        autocomplete="new-password"
        required
      />
      <button type="button" class="input-toggle-btn" id="toggle-pw">
        <i data-feather="eye"></i>
      </button>
    </div>
    
    <!-- Password strength indicator -->
    <div class="pw-strength-bar" id="pw-bar">
      <div class="pw-strength-seg"></div>
      <div class="pw-strength-seg"></div>
      <div class="pw-strength-seg"></div>
      <div class="pw-strength-seg"></div>
    </div>
    <div class="pw-strength-label" id="pw-label"></div>
    <div class="form-error" id="e-password"></div>
  </div>
  
  <div class="form-group">
    <label class="form-label" for="confirm-password">Confirm Password *</label>
    <div class="input-wrap">
      <input
        type="password"
        id="confirm-password"
        name="confirm_password"
        class="form-input"
        placeholder="Re-enter your password"
        autocomplete="new-password"
        required
      />
      <button type="button" class="input-toggle-btn" id="toggle-confirm">
        <i data-feather="eye"></i>
      </button>
    </div>
    <div class="form-error" id="e-confirm"></div>
  </div>
  
  <button type="submit" id="reset-btn" class="btn btn-primary btn-lg" style="width:100%;">
    Reset Password
  </button>
  
</form>

<p class="auth-footer-text">
  Remember your password? <a href="login.html">Sign in</a>
</p>
```

### JavaScript

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  
  // Get token from URL
  const token = Utils.getParam('token');
  const alertEl = document.getElementById('auth-alert');
  
  // Validate token exists
  if (!token) {
    alertEl.className = 'auth-alert alert alert-danger';
    alertEl.textContent = 'Invalid reset link. Request a new one.';
    alertEl.style.display = 'block';
    document.getElementById('reset-btn').disabled = true;
    return;
  }
  
  // Password toggle handlers
  wireToggle('new-password', 'toggle-pw');
  wireToggle('confirm-password', 'toggle-confirm');
  
  // Password strength indicator
  document.getElementById('new-password').addEventListener('input', function() {
    const pw = this.value;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    
    const bar = document.getElementById('pw-bar');
    bar.className = 'pw-strength-bar' + (pw ? ' str-' + score : '');
    
    const label = document.getElementById('pw-label');
    const texts = ['', 'Too weak', 'Fair', 'Good', 'Strong'];
    label.textContent = pw ? texts[score] : '';
  });
  
  // Form submission
  document.getElementById('reset-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    
    // Clear errors
    document.getElementById('e-password').textContent = '';
    document.getElementById('e-confirm').textContent = '';
    alertEl.style.display = 'none';
    
    // Validate
    const pwResult = Utils.validatePassword(password);
    if (!pwResult.valid) {
      document.getElementById('e-password').textContent = pwResult.message;
      return;
    }
    
    if (password !== confirm) {
      document.getElementById('e-confirm').textContent = 'Passwords do not match.';
      return;
    }
    
    // Submit
    try {
      Utils.setButtonLoading(document.getElementById('reset-btn'), 'Resetting…');
      
      await Auth.resetPassword({
        token: token,
        password: password,
        confirm_password: confirm
      });
      
      // Show success
      document.getElementById('reset-form').style.display = 'none';
      document.querySelector('.auth-box-header').innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h2>Password Reset!</h2>
          <p style="color: var(--text-muted);">
            Your password has been updated successfully.<br />
            You can now sign in with your new password.
          </p>
        </div>
      `;
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
      
    } catch (err) {
      Utils.clearButtonLoading(document.getElementById('reset-btn'));
      alertEl.className = 'auth-alert alert alert-danger';
      alertEl.textContent = err.message || 'Reset failed. Try again.';
      alertEl.style.display = 'block';
    }
  });
  
});
```

### API Endpoint

**POST /api/v1/auth/reset-password**

**Request:**
```json
{
  "token": "eyJhbGc...",
  "password": "NewSecret123",
  "confirm_password": "NewSecret123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully"
  }
}
```

### User Experience

```
User clicks email link with token
           ↓
Page loads, validates token
           ↓
If token invalid/expired → Show error, disable form
           ↓
If token valid → Show password form
           ↓
User enters new password + confirmation
           ↓
Password strength indicator shows feedback
           ↓
User clicks "Reset Password"
           ↓
Backend:
  1. Validates token (not expired, valid format)
  2. Updates password in database
  3. Invalidates all old refresh tokens (force re-login)
           ↓
Frontend:
  1. Shows "Password Reset!" success message
  2. Auto-redirects to login after 2 seconds
           ↓
User logs in with new password
```

---

## 3. Email Verification Page

**File:** `pages/auth/verify-email.html`

**Purpose:** Verify user's email address after signup.

**Route Name:** `'verify-email'`

**Role Required:** None (public, but requires valid token in URL)

---

### Overview

Auto-verifying page. Shows loading spinner while verifying. Upon success, shows confirmation. On failure, shows error with options.

### HTML Structure

```html
<div class="verify-box">
  
  <!-- Brand -->
  <div class="brand">
    <div class="brand-logo">E</div>
    <span class="brand-name">EduVerse</span>
  </div>
  
  <!-- Loading State -->
  <div id="state-loading">
    <div class="verify-icon verify-icon-loading">
      <div class="spinner"></div>
    </div>
    <div class="verify-title">Verifying your email…</div>
    <div class="verify-message">Please wait while we verify your email address.</div>
  </div>
  
  <!-- Success State -->
  <div id="state-success" style="display:none;">
    <div class="verify-icon verify-icon-success">✅</div>
    <div class="verify-title">Email Verified!</div>
    <div class="verify-message">
      Your email has been verified successfully.<br />
      You can now sign in to your account.
    </div>
    <a href="login.html" class="btn btn-primary btn-lg" style="width:100%;display:flex;align-items:center;justify-content:center;">
      Go to Sign In
    </a>
  </div>
  
  <!-- Error State -->
  <div id="state-error" style="display:none;">
    <div class="verify-icon verify-icon-error">❌</div>
    <div class="verify-title">Verification Failed</div>
    <div class="verify-message" id="error-message">
      This verification link is invalid or has expired.
    </div>
    <a href="register.html" class="btn btn-primary btn-lg" style="width:100%;display:flex;align-items:center;justify-content:center;margin-bottom:var(--space-3);">
      Register Again
    </a>
    <a href="login.html" class="btn btn-outline btn-lg" style="width:100%;display:flex;align-items:center;justify-content:center;">
      Back to Sign In
    </a>
  </div>
  
</div>
```

### JavaScript

```javascript
document.addEventListener('DOMContentLoaded', async function() {
  
  // Get token from URL
  const token = Utils.getParam('token');
  
  if (!token) {
    showError('No verification token found in the URL.');
    return;
  }
  
  try {
    // Call API to verify email
    await Api.auth.verifyEmail(token);
    showSuccess();
  } catch (err) {
    const message = (err && err.message) || 'Verification failed. Please try again.';
    showError(message);
  }
});

function showSuccess() {
  document.getElementById('state-loading').style.display = 'none';
  document.getElementById('state-success').style.display = 'block';
}

function showError(message) {
  document.getElementById('state-loading').style.display = 'none';
  document.getElementById('state-error').style.display = 'block';
  document.getElementById('error-message').textContent = message;
}
```

### API Endpoint

**POST /api/v1/auth/verify-email**

**Request:**
```json
{ "token": "eyJhbGc..." }
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired verification token"
  }
}
```

### User Experience

```
User registers → "Check your email" message shown
           ↓
User receives email with verification link:
  https://eduverse.com/pages/auth/verify-email.html?token=xyz789abc
           ↓
User clicks link
           ↓
Page loads with loading spinner
           ↓
Automatically calls POST /api/v1/auth/verify-email with token
           ↓
Backend:
  1. Validates token (not expired, format valid)
  2. Marks user.email_verified = true
  3. Returns success
           ↓
Frontend shows "Email Verified!" success message
           ↓
User clicks "Go to Sign In"
           ↓
Redirected to login page
           ↓
User can now login
```

---

## Common Issues & Solutions

### Forgot Password

| Issue | Cause | Solution |
|-------|-------|----------|
| Email not found | User not registered | Show error: "No account with this email" |
| Spam folder | Email blocked | Suggest check spam/promotions folder |
| Token expired | User took >1 hour | Send new reset link via "Resend email" button |

### Reset Password

| Issue | Cause | Solution |
|-------|-------|----------|
| Invalid token | Tampered URL | Show error: "Invalid reset link" |
| Token expired | Waited >1 hour | Direct to forgot password page |
| All devices logged out | Refresh tokens revoked | Expected behavior after reset |

### Email Verification

| Issue | Cause | Solution |
|-------|-------|----------|
| Token already used | Clicked twice | Show: "Email already verified" |
| Token expired | Waited >24 hours | Direct to resend verification email |
| Never received email | Spam filter | Suggest whitelist EduVerse email |

---

## Security Notes

✅ **Tokens Expire** — Reset tokens: 1 hour, Verification tokens: 24 hours

✅ **Token Invalidation** — Tokens can only be used once

✅ **HTTPS Only** — All links must be served over HTTPS

✅ **Rate Limiting** — Backend rate-limits requests per email/IP

✅ **No Password in URL** — Only token in URL, never password

✅ **Token Format** — Should be cryptographically secure, not guessable

---

## Summary

These three pages complete the authentication flow:

✅ **Forgot Password** → Request reset link
✅ **Reset Password** → Set new password via email link
✅ **Email Verification** → Confirm email ownership

Together they provide a secure, user-friendly password recovery and account verification system.

