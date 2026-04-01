/**
 * EduVerse — Authentication Module
 * auth.js
 *
 * Purpose: Handles every auth flow in the platform — login, register,
 * logout, forgot password, reset password, email verification, token
 * management, and session persistence.
 *
 * How it works:
 *   - Auth.init() is called on every page load (via Router.init).
 *   - Auth form pages call Auth.login(), Auth.register() etc.
 *   - Token refresh is handled silently by api.js.
 *   - Auth state lives in Store under the 'auth' key.
 *   - Auth.init() restores session from localStorage on every page load.
 *
 * Depends on: utils.js, store.js, api.js, router.js
 * Exposed as: window.Auth
 *
 * Author: EduVerse Engineering
 * Last updated: 2025
 */

(function (global) {
  'use strict';

  const Auth = {};


  /* ============================================================
     CONSTANTS
  ============================================================ */

  const TOKEN_KEY         = 'ev_token';
  const REFRESH_TOKEN_KEY = 'ev_refresh_token';
  const USER_KEY          = 'ev_user';
  const REMEMBER_KEY      = 'ev_remember';

  // How many ms before token expiry to proactively refresh (5 minutes)
  const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

  // Token refresh interval check — every 2 minutes
  const REFRESH_CHECK_INTERVAL_MS = 2 * 60 * 1000;

  let _refreshTimer = null;


  /* ============================================================
     SESSION MANAGEMENT
  ============================================================ */

  /**
   * Initialize auth on page load.
   * Restores session from storage, sets up proactive token refresh,
   * sets up logout on storage clear (multi-tab sync).
   *
   * Called once per page by Router.init().
   * Returns: { isLoggedIn, user, role } or null.
   */
  Auth.init = function () {
    const restored = _restoreSession();

    if (restored) {
      _scheduleTokenRefresh();
      _listenForSessionEvents();
    }

    return restored;
  };

  /**
   * Restore session from localStorage into Store.
   * Returns user object if found, null otherwise.
   */
  function _restoreSession() {
    const S = global.Utils ? global.Utils.storage : null;
    if (!S) return null;

    const token   = S.get(TOKEN_KEY);
    const refresh = S.get(REFRESH_TOKEN_KEY);
    const user    = S.get(USER_KEY);

    if (!token || !user) return null;

    if (global.Store) {
      global.Store.set('auth', {
        isLoggedIn:   true,
        token:        token,
        refreshToken: refresh || null,
        expiresAt:    null,
        user:         user,
        role:         user.role,
      });
    }

    return user;
  }

  /**
   * Persist session to localStorage.
   */
  function _persistSession(token, refreshToken, user, remember) {
    const S = global.Utils ? global.Utils.storage : null;
    if (!S) return;
    // Always save token — remember only controls refresh token duration
    S.set(TOKEN_KEY, token);
    S.set(USER_KEY, user);
    if (refreshToken) S.set(REFRESH_TOKEN_KEY, refreshToken);
}

  /**
   * Clear all session data from storage.
   */
  function _clearSession() {
    const S = global.Utils ? global.Utils.storage : null;
    if (!S) return;
    S.remove(TOKEN_KEY);
    S.remove(REFRESH_TOKEN_KEY);
    S.remove(USER_KEY);
  }

  /**
   * Schedule proactive token refresh before expiry.
   * Checks every REFRESH_CHECK_INTERVAL_MS.
   */
  function _scheduleTokenRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);

    _refreshTimer = setInterval(async function () {
      const expiresAt = global.Store ? global.Store.get('auth.expiresAt') : null;
      if (!expiresAt) return;

      const timeLeft = new Date(expiresAt).getTime() - Date.now();
      if (timeLeft < REFRESH_THRESHOLD_MS && timeLeft > 0) {
        try {
          await Auth.refreshToken();
        } catch (e) {
          // Silent fail — api.js will handle it on the next request
        }
      }
    }, REFRESH_CHECK_INTERVAL_MS);
  }

  /**
   * Listen for cross-tab session events.
   * If another tab logs out, this tab logs out too.
   */
  function _listenForSessionEvents() {
    window.addEventListener('storage', function (e) {
      if (e.key === TOKEN_KEY && e.newValue === null) {
        // Another tab cleared the token — log out here too
        Auth.logout(false);  // silent, no API call
      }
    });
  }


  /* ============================================================
     LOGIN
  ============================================================ */

  /**
   * Log in with email and password.
   *
   * Auth.login({
   *   email: 'user@example.com',
   *   password: 'Secret123',
   *   remember: true
   * })
   *
   * Returns the user object on success.
   * Throws ApiError on failure.
   */
  Auth.login = async function (credentials) {
    const { email, password, remember } = credentials;

    // Client-side validation before hitting the server
    const errors = _validateLoginInput(email, password);
    if (errors.length > 0) throw { clientError: true, errors: errors };

    const response = await global.Api.auth.login({ email, password });

    if (!response || !response.data) {
      throw { clientError: false, message: 'Invalid response from server.' };
    }

    const { token, refresh_token, user, expires_at } = response.data;

    // Update store
    if (global.Store) {
      global.Store.set('auth', {
        isLoggedIn:   true,
        token:        token,
        refreshToken: refresh_token || null,
        expiresAt:    expires_at || null,
        user:         user,
        role:         user.role,
      });
    }

    // Persist to storage
    _persistSession(token, refresh_token, user, remember);

    // Start proactive refresh
    _scheduleTokenRefresh();

    return user;
  };

  function _validateLoginInput(email, password) {
    const errors = [];
    if (!email || !global.Utils.isValidEmail(email)) {
      errors.push({ field: 'email', message: 'Enter a valid email address.' });
    }
    if (!password || password.length < 1) {
      errors.push({ field: 'password', message: 'Password is required.' });
    }
    return errors;
  }


  /* ============================================================
     REGISTER
  ============================================================ */

  /**
   * Register a new user account.
   *
   * Auth.register({
   *   name: 'Ravi Kumar',
   *   email: 'ravi@example.com',
   *   password: 'Secret123',
   *   role: 'student',               // 'student' | 'parent' | 'instructor'
   *   phone: '9876543210',           // optional
   *   institute_code: 'INST001',     // optional — links student to institute
   * })
   *
   * Returns user object. On most setups, email verification is required
   * before login is allowed — handle in the page after this resolves.
   */
  Auth.register = async function (data) {
    const errors = _validateRegisterInput(data);
    if (errors.length > 0) throw { clientError: true, errors: errors };

    const response = await global.Api.auth.register(data);

    if (!response || !response.data) {
      throw { clientError: false, message: 'Registration failed. Please try again.' };
    }

    return response.data;
  };

  function _validateRegisterInput(data) {
    const errors = [];
    const U = global.Utils;

    if (!data.name || U.isEmpty(data.name)) {
      errors.push({ field: 'name', message: 'Full name is required.' });
    }
    if (!data.email || !U.isValidEmail(data.email)) {
      errors.push({ field: 'email', message: 'Enter a valid email address.' });
    }
    if (!data.password) {
      errors.push({ field: 'password', message: 'Password is required.' });
    } else {
      const pw = U.validatePassword(data.password);
      if (!pw.valid) errors.push({ field: 'password', message: pw.message });
    }
    if (data.confirm_password !== undefined && data.password !== data.confirm_password) {
      errors.push({ field: 'confirm_password', message: 'Passwords do not match.' });
    }
    if (!data.role) {
      errors.push({ field: 'role', message: 'Please select a role.' });
    }
    if (data.phone && !U.isValidPhone(data.phone)) {
      errors.push({ field: 'phone', message: 'Enter a valid phone number.' });
    }
    return errors;
  }


  /* ============================================================
     LOGOUT
  ============================================================ */

  /**
   * Log out the current user.
   *
   * Auth.logout()         — calls API + clears session, redirects to login
   * Auth.logout(false)    — silent (no API call, no redirect) — used for cross-tab sync
   */
  Auth.logout = async function (callApi) {
    callApi = callApi !== false;  // default true

    if (_refreshTimer) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }

    if (callApi) {
      try {
        await global.Api.auth.logout();
      } catch (e) {
        // Ignore API errors on logout — still clear locally
      }
    }

    _clearSession();

    if (global.Store) global.Store.clearAuth();

    // Redirect to login
    window.location.replace('/pages/auth/login.html');
  };


  /* ============================================================
     FORGOT PASSWORD
  ============================================================ */

  /**
   * Send a password reset email.
   * Returns response data on success.
   */
  Auth.forgotPassword = async function (email) {
    const U = global.Utils;
    if (!email || !U.isValidEmail(email)) {
      throw { clientError: true, errors: [{ field: 'email', message: 'Enter a valid email address.' }] };
    }
    const response = await global.Api.auth.forgotPassword(email);
    return response && response.data;
  };


  /* ============================================================
     RESET PASSWORD
  ============================================================ */

  /**
   * Reset password using a token from the reset email.
   *
   * Auth.resetPassword({
   *   token: 'abc123...',
   *   password: 'NewSecret123',
   *   confirm_password: 'NewSecret123'
   * })
   */
  Auth.resetPassword = async function (data) {
    const errors = [];
    const U = global.Utils;

    if (!data.token) {
      errors.push({ field: 'token', message: 'Reset token is missing.' });
    }
    if (!data.password) {
      errors.push({ field: 'password', message: 'New password is required.' });
    } else {
      const pw = U.validatePassword(data.password);
      if (!pw.valid) errors.push({ field: 'password', message: pw.message });
    }
    if (data.password !== data.confirm_password) {
      errors.push({ field: 'confirm_password', message: 'Passwords do not match.' });
    }

    if (errors.length > 0) throw { clientError: true, errors: errors };

    const response = await global.Api.auth.resetPassword(data);
    return response && response.data;
  };


  /* ============================================================
     EMAIL VERIFICATION
  ============================================================ */

  /**
   * Verify an email address using a token from the verification email.
   * Token is usually in ?token= query param.
   */
  Auth.verifyEmail = async function (token) {
    if (!token) {
      throw { clientError: true, errors: [{ field: 'token', message: 'Verification token is missing.' }] };
    }
    const response = await global.Api.auth.verifyEmail(token);
    return response && response.data;
  };


  /* ============================================================
     CHANGE PASSWORD (authenticated)
  ============================================================ */

  /**
   * Change password for a logged-in user.
   *
   * Auth.changePassword({
   *   current_password: 'OldPass123',
   *   new_password: 'NewPass456',
   *   confirm_password: 'NewPass456'
   * })
   */
  Auth.changePassword = async function (data) {
    const errors = [];
    const U = global.Utils;

    if (!data.current_password) {
      errors.push({ field: 'current_password', message: 'Current password is required.' });
    }
    if (!data.new_password) {
      errors.push({ field: 'new_password', message: 'New password is required.' });
    } else {
      const pw = U.validatePassword(data.new_password);
      if (!pw.valid) errors.push({ field: 'new_password', message: pw.message });
    }
    if (data.new_password === data.current_password) {
      errors.push({ field: 'new_password', message: 'New password must be different from current password.' });
    }
    if (data.new_password !== data.confirm_password) {
      errors.push({ field: 'confirm_password', message: 'Passwords do not match.' });
    }

    if (errors.length > 0) throw { clientError: true, errors: errors };

    const response = await global.Api.auth.changePassword({
      current_password: data.current_password,
      new_password:     data.new_password,
    });
    return response && response.data;
  };


  /* ============================================================
     PROFILE UPDATE
  ============================================================ */

  /**
   * Update the logged-in user's profile.
   * Also updates the user object in Store and storage.
   */
  Auth.updateProfile = async function (data) {
    const response = await global.Api.auth.updateProfile(data);

    if (response && response.data && response.data.user) {
      const updatedUser = response.data.user;
      if (global.Store) {
        global.Store.set('auth.user', updatedUser);
      }
      if (global.Utils) {
        global.Utils.storage.set(USER_KEY, updatedUser);
      }
    }

    return response && response.data;
  };

  /**
   * Upload a new avatar for the logged-in user.
   * onProgress(percent) is called during upload.
   */
  Auth.uploadAvatar = async function (file, onProgress) {
    if (!file) throw { clientError: true, errors: [{ field: 'avatar', message: 'No file selected.' }] };

    const U = global.Utils;
    if (!U.isAllowedFileType(file, ['jpg', 'jpeg', 'png', 'webp'])) {
      throw { clientError: true, errors: [{ field: 'avatar', message: 'Only JPG, PNG, or WEBP images are allowed.' }] };
    }
    if (!U.isFileSizeOk(file, 5)) {
      throw { clientError: true, errors: [{ field: 'avatar', message: 'Image must be under 5 MB.' }] };
    }

    const response = await global.Api.auth.uploadAvatar(file, onProgress);

    if (response && response.data && response.data.avatar_url) {
      const currentUser = global.Store ? global.Store.get('auth.user') : null;
      if (currentUser) {
        const updatedUser = Object.assign({}, currentUser, { avatar: response.data.avatar_url });
        if (global.Store) global.Store.set('auth.user', updatedUser);
        if (global.Utils) global.Utils.storage.set(USER_KEY, updatedUser);
      }
    }

    return response && response.data;
  };


  /* ============================================================
     TOKEN MANAGEMENT
  ============================================================ */

  /**
   * Manually trigger a token refresh.
   * Normally handled silently by api.js, but pages can call this too.
   */
  Auth.refreshToken = async function () {
    const refreshToken = global.Store
      ? global.Store.get('auth.refreshToken')
      : (global.Utils ? global.Utils.storage.get(REFRESH_TOKEN_KEY) : null);

    if (!refreshToken) throw new Error('No refresh token available.');

    const response = await global.Api.post('/auth/refresh', { refresh_token: refreshToken });

    if (!response || !response.data || !response.data.token) {
      throw new Error('Token refresh failed.');
    }

    const { token, refresh_token, expires_at } = response.data;

    if (global.Store) {
      global.Store.set('auth.token', token);
      if (refresh_token) global.Store.set('auth.refreshToken', refresh_token);
      if (expires_at) global.Store.set('auth.expiresAt', expires_at);
    }
    if (global.Utils) {
      global.Utils.storage.set(TOKEN_KEY, token);
      if (refresh_token) global.Utils.storage.set(REFRESH_TOKEN_KEY, refresh_token);
    }

    return token;
  };

  /**
   * Check if the current token is likely expired.
   * Uses stored expiresAt if available.
   */
  Auth.isTokenExpired = function () {
    const expiresAt = global.Store ? global.Store.get('auth.expiresAt') : null;
    if (!expiresAt) return false;  // Don't know — assume valid
    return new Date(expiresAt).getTime() < Date.now();
  };


  /* ============================================================
     CONVENIENCE GETTERS
  ============================================================ */

  /**
   * Get the currently logged-in user object.
   * Returns null if not logged in.
   */
  Auth.getUser = function () {
    return global.Store ? global.Store.get('auth.user') : null;
  };

  /**
   * Get the current user's role.
   */
  Auth.getRole = function () {
    return global.Store ? global.Store.get('auth.role') : null;
  };

  /**
   * Check if the user is currently logged in.
   */
  Auth.isLoggedIn = function () {
    return global.Store ? global.Store.get('auth.isLoggedIn') : false;
  };

  /**
   * Check if the current user has a specific role.
   * Auth.hasRole('student')
   * Auth.hasRole(['student', 'instructor'])
   */
  Auth.hasRole = function (role) {
    const userRole = Auth.getRole();
    if (!userRole) return false;
    if (Array.isArray(role)) return role.includes(userRole);
    return userRole === role;
  };

  /**
   * Get the current auth token.
   */
  Auth.getToken = function () {
    return global.Store ? global.Store.get('auth.token') : null;
  };


  /* ============================================================
     FORM ERROR RENDERING
     Shared helpers for auth pages to display field errors cleanly.
  ============================================================ */

  /**
   * Render client-side or server-side validation errors onto form fields.
   * errors: [{ field: 'email', message: '...' }]
   *
   * Each input must have name="fieldname" matching error.field.
   * Looks for sibling .form-error element or creates one.
   */
  Auth.renderErrors = function (errors, formEl) {
    if (!errors || !formEl) return;
    errors.forEach(function (err) {
      const input = formEl.querySelector('[name="' + err.field + '"]');
      if (input && global.Utils) {
        global.Utils.showFieldError(input, err.message);
      }
    });
  };

  /**
   * Clear all errors from a form.
   */
  Auth.clearErrors = function (formEl) {
    if (!formEl) return;
    const inputs = formEl.querySelectorAll('.input-error');
    inputs.forEach(function (input) {
      if (global.Utils) global.Utils.clearFieldError(input);
    });
  };

  /**
   * Show a top-level form alert (e.g. "Invalid credentials").
   * Looks for .auth-alert element inside formEl.
   */
  Auth.showAlert = function (message, type, formEl) {
    const alertEl = formEl
      ? formEl.querySelector('.auth-alert')
      : document.querySelector('.auth-alert');
    if (!alertEl) return;

    alertEl.className = 'auth-alert alert alert-' + (type || 'error');
    alertEl.textContent = message;
    if (global.Utils) global.Utils.show(alertEl);

    // Auto-hide after 6 seconds
    setTimeout(function () {
      if (global.Utils) global.Utils.hide(alertEl);
    }, 6000);
  };

  /**
   * Hide the top-level form alert.
   */
  Auth.hideAlert = function (formEl) {
    const alertEl = formEl
      ? formEl.querySelector('.auth-alert')
      : document.querySelector('.auth-alert');
    if (alertEl && global.Utils) global.Utils.hide(alertEl);
  };


  /* ============================================================
     OAUTH HELPERS
     Redirect-based OAuth — no popup windows.
  ============================================================ */

  /**
   * Initiate Google OAuth login.
   * Redirects to backend OAuth endpoint which handles the Google flow.
   */
  Auth.loginWithGoogle = function () {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = '/api/v1/auth/oauth/google?redirect=' + redirect;
  };

  /**
   * Handle OAuth callback — called on the redirect-back page.
   * Reads token from URL query params, stores it, and routes to dashboard.
   */
  Auth.handleOAuthCallback = async function () {
    const U = global.Utils;
    if (!U) return;

    const token        = U.getParam('token');
    const refreshToken = U.getParam('refresh_token');
    const error        = U.getParam('error');

    if (error) {
      return { success: false, error: decodeURIComponent(error) };
    }

    if (!token) {
      return { success: false, error: 'No token received.' };
    }

    // Fetch user details with the new token
    if (global.Store) global.Store.set('auth.token', token);
    if (global.Utils) global.Utils.storage.set(TOKEN_KEY, token);

    try {
      const response = await global.Api.auth.me();
      const user = response && response.data;

      if (user) {
        if (global.Store) {
          global.Store.set('auth', {
            isLoggedIn:   true,
            token:        token,
            refreshToken: refreshToken || null,
            user:         user,
            role:         user.role,
          });
        }
        _persistSession(token, refreshToken, user);
        _scheduleTokenRefresh();
        return { success: true, user: user };
      }
    } catch (e) {
      return { success: false, error: 'Failed to load user profile.' };
    }

    return { success: false, error: 'Authentication failed.' };
  };


  /* ============================================================
     EXPOSE
  ============================================================ */

  global.Auth = Auth;

})(window);
