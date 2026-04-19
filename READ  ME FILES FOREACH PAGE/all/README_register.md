# Register Page — README

**File:** `pages/auth/register.html`

**Purpose:** User registration/sign-up interface. Allows new users to create an account.

**Route Name:** `'register'`

**Role Required:** None (public page)

**Layout:** `'auth'` (centered authentication layout)

---

## Page Overview

The registration page guides new users through account creation with multi-step validation. Features include:

- **Personal Information** — Name, email, phone
- **Password Setup** — Strong password with strength indicator
- **Account Type** — Select role (student, parent, instructor)
- **Optional Institute Code** — Link to educational institution
- **Confirmation** — Verify password matches
- **Real-time Validation** — Instant feedback on field errors
- **Progress Tracking** — Step-by-step guidance
- **Dark Mode Support** — Fully responsive theme

---

## Registration Form Fields

### Step 1: Personal Info

#### Full Name
- **Type:** Text input
- **Required:** Yes
- **Validation:** Non-empty, 2-100 characters
- **Error Message:** "Full name is required."

#### Email Address
- **Type:** Email input
- **Required:** Yes
- **Validation:** Valid email format
- **Duplicate Check:** Server validates email not already registered
- **Error Messages:**
  - "Enter a valid email address."
  - "Email already registered. Sign in instead."

#### Phone Number
- **Type:** Phone input
- **Required:** No
- **Validation:** 10 digits (Indian format)
- **Format:** Accept: 9876543210, +919876543210, (987) 654-3210
- **Error Message:** "Enter a valid phone number."

### Step 2: Account Security

#### Password
- **Type:** Password input
- **Required:** Yes
- **Minimum Length:** 8 characters
- **Requirements:**
  - At least 1 uppercase letter (A-Z)
  - At least 1 digit (0-9)
  - At least 1 special character (!@#$%^&*) — recommended
- **Strength Indicator:** Visual feedback (Too weak, Fair, Good, Strong)
- **Error Messages:**
  - "Password must be at least 8 characters."
  - "Password must contain uppercase letter and digit."

#### Confirm Password
- **Type:** Password input
- **Required:** Yes
- **Validation:** Must match Password field exactly
- **Error Message:** "Passwords do not match."

### Step 3: Account Type & Institution

#### Role Selection
- **Type:** Radio buttons or dropdown
- **Required:** Yes
- **Options:**
  - `student` — Course taker (default)
  - `parent` — Student guardian
  - `instructor` — Course creator/teacher
- **Error Message:** "Please select an account type."

#### Institute Code (Optional)
- **Type:** Text input
- **Required:** No (only for students)
- **Validation:** Alphanumeric code, 6-10 characters
- **Purpose:** Links student to their school/college
- **Placeholder:** "Enter your institute code (if applicable)"
- **Help Text:** "Ask your school for the institute code"

#### Terms & Conditions
- **Type:** Checkbox
- **Required:** Yes
- **Label:** "I agree to the Terms of Service and Privacy Policy"
- **Links:** Clickable terms and privacy policy links
- **Error Message:** "You must accept the terms to continue."

---

## HTML Structure

```html
<body>
<div class="auth-shell">
  
  <!-- LEFT PANEL -->
  <div class="auth-left">
    <div class="auth-left-pattern"></div>
    
    <div class="auth-left-brand">
      <div class="auth-left-logo">E</div>
      <span class="auth-left-name">EduVerse</span>
    </div>
    
    <div class="auth-left-content">
      <h2 class="auth-left-title">Join EduVerse</h2>
      <p class="auth-left-desc">Create your account and start learning today.</p>
      
      <!-- Registration steps guide -->
      <div class="reg-step">
        <div class="reg-step-num">1</div>
        <div>
          <div class="reg-step-title">Basic Information</div>
          <div class="reg-step-desc">Name, email, phone</div>
        </div>
      </div>
      
      <div class="reg-step">
        <div class="reg-step-num">2</div>
        <div>
          <div class="reg-step-title">Create Password</div>
          <div class="reg-step-desc">Strong 8+ characters</div>
        </div>
      </div>
      
      <div class="reg-step">
        <div class="reg-step-num">3</div>
        <div>
          <div class="reg-step-title">Choose Your Role</div>
          <div class="reg-step-desc">Student, parent, or teacher</div>
        </div>
      </div>
    </div>
    
    <!-- Bottom stats -->
    <div class="auth-left-stats">
      <div class="auth-stat">
        <div class="auth-stat-value">Secure</div>
        <div class="auth-stat-label">Data Encrypted</div>
      </div>
      <div class="auth-stat">
        <div class="auth-stat-value">Free</div>
        <div class="auth-stat-label">Forever</div>
      </div>
    </div>
  </div>
  
  <!-- RIGHT PANEL -->
  <div class="auth-right">
    <div class="auth-box">
      
      <!-- Header -->
      <div class="auth-box-header">
        <h1 class="auth-box-title">Create Account</h1>
        <p class="auth-box-subtitle">It takes just 3 steps</p>
      </div>
      
      <!-- Alert -->
      <div class="auth-alert" id="auth-alert" role="alert" hidden></div>
      
      <!-- Registration Form -->
      <form class="auth-form" id="register-form" novalidate>
        
        <!-- Full Name -->
        <div class="form-group">
          <label class="form-label" for="name">Full Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            class="form-input"
            placeholder="Ravi Kumar"
            autocomplete="name"
            required
          />
          <div class="form-error" id="e-name"></div>
        </div>
        
        <!-- Email -->
        <div class="form-group">
          <label class="form-label" for="email">Email Address *</label>
          <input
            type="email"
            id="email"
            name="email"
            class="form-input"
            placeholder="ravi@example.com"
            autocomplete="email"
            required
          />
          <div class="form-error" id="e-email"></div>
        </div>
        
        <!-- Phone (optional) -->
        <div class="form-group">
          <label class="form-label" for="phone">Phone Number (Optional)</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            class="form-input"
            placeholder="9876543210"
            autocomplete="tel"
          />
          <div class="form-error" id="e-phone"></div>
        </div>
        
        <!-- Password with strength indicator -->
        <div class="form-group">
          <label class="form-label" for="password">Password *</label>
          <div class="input-wrap">
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              placeholder="Min. 8 characters"
              autocomplete="new-password"
              required
            />
            <button
              type="button"
              class="input-toggle-btn"
              id="toggle-pw"
              aria-label="Show password"
            >
              <i data-feather="eye"></i>
            </button>
          </div>
          
          <!-- Password strength bar -->
          <div class="pw-strength-bar" id="pw-bar">
            <div class="pw-strength-seg"></div>
            <div class="pw-strength-seg"></div>
            <div class="pw-strength-seg"></div>
            <div class="pw-strength-seg"></div>
          </div>
          <div class="pw-strength-label" id="pw-label"></div>
          <div class="form-error" id="e-password"></div>
        </div>
        
        <!-- Confirm Password -->
        <div class="form-group">
          <label class="form-label" for="confirm">Confirm Password *</label>
          <div class="input-wrap">
            <input
              type="password"
              id="confirm"
              name="confirm_password"
              class="form-input"
              placeholder="Re-enter password"
              autocomplete="new-password"
              required
            />
            <button
              type="button"
              class="input-toggle-btn"
              id="toggle-confirm"
              aria-label="Show password"
            >
              <i data-feather="eye"></i>
            </button>
          </div>
          <div class="form-error" id="e-confirm"></div>
        </div>
        
        <!-- Role Selection -->
        <div class="form-group">
          <label class="form-label">I am a: *</label>
          <div class="role-options">
            <label class="radio-label">
              <input type="radio" name="role" value="student" checked required />
              <span>Student</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="role" value="parent" required />
              <span>Parent/Guardian</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="role" value="instructor" required />
              <span>Instructor</span>
            </label>
          </div>
          <div class="form-error" id="e-role"></div>
        </div>
        
        <!-- Institute Code (conditional, for students) -->
        <div class="form-group" id="institute-group" style="display: none;">
          <label class="form-label" for="institute-code">
            Institute Code (Optional)
          </label>
          <input
            type="text"
            id="institute-code"
            name="institute_code"
            class="form-input"
            placeholder="e.g., INST001"
          />
          <small style="color: var(--text-muted);">
            Ask your school/college for the code
          </small>
          <div class="form-error" id="e-institute"></div>
        </div>
        
        <!-- Terms checkbox -->
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="terms" id="terms" required />
            <span>
              I agree to the
              <a href="/pages/terms.html" target="_blank">Terms of Service</a>
              and
              <a href="/pages/privacy.html" target="_blank">Privacy Policy</a>
            </span>
          </label>
          <div class="form-error" id="e-terms"></div>
        </div>
        
        <!-- Submit -->
        <button type="submit" id="register-btn" class="btn btn-primary btn-lg" style="width:100%;">
          Create Account
        </button>
        
      </form>
      
      <!-- Footer -->
      <p class="auth-footer-text" style="margin-top:var(--space-5);">
        Already have an account? <a href="login.html">Sign in</a>
      </p>
      
    </div>
  </div>
  
</div>
</body>
```

---

## JavaScript Functionality

### Form Submission

```javascript
document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm').value;
  const role = document.querySelector('input[name="role"]:checked').value;
  const instituteCode = document.getElementById('institute-code').value;
  const termsAccepted = document.getElementById('terms').checked;
  
  // Clear previous errors
  Auth.clearErrors(this);
  
  // Client validation
  const errors = [];
  if (!name) errors.push({ field: 'name', message: 'Full name is required.' });
  if (!Utils.isValidEmail(email)) errors.push({ field: 'email', message: 'Invalid email.' });
  
  const pwResult = Utils.validatePassword(password);
  if (!pwResult.valid) errors.push({ field: 'password', message: pwResult.message });
  
  if (password !== confirmPassword) {
    errors.push({ field: 'confirm', message: 'Passwords do not match.' });
  }
  
  if (!termsAccepted) errors.push({ field: 'terms', message: 'Accept terms to continue.' });
  
  if (errors.length > 0) {
    Auth.renderErrors(errors, this);
    return;
  }
  
  // Submit to backend
  try {
    Utils.setButtonLoading(document.getElementById('register-btn'), 'Creating account…');
    
    const result = await Auth.register({
      name: name,
      email: email,
      password: password,
      phone: phone,
      role: role,
      institute_code: instituteCode || undefined,
    });
    
    // Success: show verification message
    document.getElementById('register-form').style.display = 'none';
    document.querySelector('.auth-box-header').innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📧</div>
        <h2 style="color: var(--text-primary); margin-bottom: 8px;">Check Your Email</h2>
        <p style="color: var(--text-muted); line-height: 1.6;">
          We've sent a verification link to <strong>${Utils.escapeHtml(email)}</strong>.
          <br />Click the link to confirm your email and complete signup.
        </p>
      </div>
    `;
    
  } catch (err) {
    Utils.clearButtonLoading(document.getElementById('register-btn'));
    
    if (err.clientError) {
      Auth.renderErrors(err.errors, this);
    } else {
      Auth.showAlert(err.message || 'Registration failed. Please try again.', 'error', this);
    }
  }
});
```

### Password Strength Indicator

```javascript
const passwordInput = document.getElementById('password');
const pwBar = document.getElementById('pw-bar');
const pwLabel = document.getElementById('pw-label');

const strengthTexts = ['', 'Too weak', 'Fair', 'Good', 'Strong'];
const strengthColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

passwordInput.addEventListener('input', function() {
  const pw = this.value;
  let score = 0;
  
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  
  pwBar.className = 'pw-strength-bar' + (pw ? ' str-' + score : '');
  pwLabel.textContent = pw ? strengthTexts[score] : '';
  pwLabel.style.color = strengthColors[score];
});
```

### Institute Code Visibility

```javascript
const roleInputs = document.querySelectorAll('input[name="role"]');
const instituteGroup = document.getElementById('institute-group');

roleInputs.forEach(input => {
  input.addEventListener('change', function() {
    // Show institute code only for students
    instituteGroup.style.display = this.value === 'student' ? 'block' : 'none';
  });
});
```

### Password Toggle

```javascript
function wireToggle(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  let visible = false;
  
  btn.addEventListener('click', function() {
    visible = !visible;
    input.type = visible ? 'text' : 'password';
    btn.innerHTML = '<i data-feather="' + (visible ? 'eye-off' : 'eye') + '"></i>';
    feather.replace({ 'stroke-width': 1.75 });
  });
}

wireToggle('password', 'toggle-pw');
wireToggle('confirm', 'toggle-confirm');
```

---

## Validation Rules

### Name
- ✅ Required
- ✅ 2-100 characters
- ✅ Alphanumeric with spaces
- ❌ Empty
- ❌ Too short (<2 chars)
- ❌ Too long (>100 chars)

### Email
- ✅ Valid email format
- ✅ Not already registered
- ❌ Invalid format
- ❌ Already registered

### Phone (Optional)
- ✅ 10 digits
- ✅ Can include country code
- ❌ Less than 10 digits

### Password
- ✅ Minimum 8 characters
- ✅ At least 1 uppercase letter
- ✅ At least 1 digit
- ✅ At least 1 special character (recommended)
- ❌ Less than 8 characters
- ❌ No uppercase
- ❌ No digit

### Confirm Password
- ✅ Matches password field
- ❌ Doesn't match
- ❌ Empty if password is set

### Role
- ✅ One of: student, parent, instructor
- ❌ Not selected
- ❌ Invalid value

### Institute Code (Optional)
- ✅ 6-10 alphanumeric characters
- ✅ Empty (optional)
- ❌ Invalid format
- ❌ Code doesn't exist (server checks)

### Terms & Conditions
- ✅ Checkbox checked
- ❌ Unchecked

---

## API Endpoint

### POST /api/v1/auth/register

**Request:**
```json
{
  "name": "Ravi Kumar",
  "email": "ravi@example.com",
  "password": "Secret123!",
  "phone": "9876543210",
  "role": "student",
  "institute_code": "INST001"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "role": "student",
    "message": "Account created. Check your email for verification link."
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Email already registered" },
      { "field": "password", "message": "Password too weak" }
    ]
  }
}
```

---

## Data Flow

```
User visits /pages/auth/register.html
           ↓
If already logged in → Redirect to dashboard
           ↓
Show registration form
           ↓
User fills: name, email, phone, password, role, institute_code, terms
           ↓
User clicks "Create Account"
           ↓
Client-side validation via Utils
           ↓
If validation fails → Show field errors, return
           ↓
Call Auth.register({...data...})
           ↓
Auth.js validates again
           ↓
POST /api/v1/auth/register with form data
           ↓
Backend:
  1. Validates all fields
  2. Checks email not duplicate
  3. Hashes password
  4. Creates user account
  5. Generates email verification token
  6. Sends email with verification link
  7. Returns success
           ↓
Frontend:
  1. Shows "Check your email" message
  2. User clicks email link
  3. Redirects to /pages/auth/verify-email.html?token=...
  4. Email verified
  5. User logs in normally
```

---

## State Management

**Store Keys Used:**
- `auth.isLoggedIn` — Check if already logged in

**Store Updates:** None until email verified and user logs in

---

## Theme Support

Full light/dark mode support:
- Color scheme adapts to user preference
- Theme persists across page reloads
- Smooth transition when toggled

---

## Responsive Design

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1024px) | Two-column (left panel + form) |
| Tablet (641-1023px) | Single column, full-width form |
| Mobile (≤640px) | Single column, mobile-optimized |

---

## Accessibility

- ✅ Form labels associated with inputs
- ✅ Error messages in alert role
- ✅ Password strength feedback
- ✅ All buttons and links keyboard accessible
- ✅ Color not sole indicator of password strength

---

## Security

✅ **HTTPS Only**
✅ **Password Strength Enforced** (8+ chars, uppercase, digit)
✅ **Email Verification Required** (before can login)
✅ **No Password Logging**
✅ **CSRF Protection** (backend)
✅ **Rate Limiting** (backend)
✅ **XSS Prevention** (input escaping)

---

## Testing Scenarios

| Scenario | Input | Result |
|----------|-------|--------|
| Valid registration | All fields correct | Account created, verification email sent |
| Duplicate email | Email already exists | Shows "Email already registered" error |
| Weak password | "password" (no uppercase) | Shows password strength error |
| Password mismatch | Different confirm password | Shows "Passwords do not match" |
| Missing required field | Leave name blank | Shows "Full name is required" |
| Invalid email | "invalid-email" | Shows "Invalid email address" |
| Terms not accepted | Checkbox unchecked | Shows "Accept terms to continue" |

---

## Summary

The register page provides a **smooth, guided onboarding experience** with:

✅ Multi-step validation guidance
✅ Real-time password strength feedback
✅ Role-based conditional fields
✅ Comprehensive error handling
✅ Email verification requirement
✅ Mobile-optimized design
✅ Accessible form inputs
✅ Security best practices

