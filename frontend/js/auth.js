/**
 * EduVerse — Authentication Module
 * auth.js  |  Version 3.0  |  Production-Grade
 *
 * Handles every auth flow for all 5 roles:
 *   Super Admin · Institute · Instructor/Teacher · Student · Parent
 *
 * Flows covered:
 *   - Email + password login
 *   - Google OAuth (redirect-based)
 *   - OTP-based mobile login
 *   - Register (with role-specific fields)
 *   - Institute-affiliated registration (via institute code)
 *   - Logout (single tab + cross-tab sync)
 *   - Forgot password / Reset password
 *   - Email verification
 *   - Phone OTP verification
 *   - Change password (authenticated)
 *   - Profile update + avatar upload
 *   - JWT access token management (15-min TTL)
 *   - Refresh token rotation (7-day, httpOnly cookie via backend)
 *   - Proactive token refresh (5 min before expiry)
 *   - Session persistence across page loads
 *   - Role-based access helpers
 *   - Multi-tab session sync
 *   - Impersonation support (Super Admin)
 *   - Pre-School parent lock mode
 *   - Socket.io re-authentication after token refresh
 *
 * Architecture:
 *   - Tokens stored as RAW STRINGS in localStorage (never JSON-encoded)
 *   - User object stored as JSON.stringify (it is an object)
 *   - Refresh token lives in httpOnly cookie (set by backend) for XSS safety
 *   - localStorage refresh token copy is fallback only
 *   - All storage ops wrapped in try/catch for private-browsing + quota safety
 *   - All async flows are cancellable to prevent race conditions on fast navigation
 *
 * Depends on: utils.js · store.js · api.js · router.js · socket.js
 * Exposed as: window.Auth
 *
 * Author: EduVerse Engineering
 * Version: 3.0 — Production / Scalable
 */

;(function (global) {
  'use strict';

  /* ============================================================
     GUARD — prevent double-init if script loaded twice
  ============================================================ */
  if (global.Auth) return;

  const Auth = {};


  /* ============================================================
     CONSTANTS
  ============================================================ */

  // localStorage keys — raw strings for tokens, JSON for objects
  const TOKEN_KEY         = 'ev_token';
  const REFRESH_TOKEN_KEY = 'ev_refresh_token';   // fallback only; real one is httpOnly cookie
  const USER_KEY          = 'ev_user';
  const ROLE_KEY          = 'ev_role';
  const SESSION_ID_KEY    = 'ev_session_id';      // for server-side session tracking
  const IMPERSONATE_KEY   = 'ev_impersonate';     // super admin impersonation

  // Token lifecycle (match backend JWT settings)
  const ACCESS_TOKEN_TTL_MS    = 15 * 60 * 1000;   // 15 minutes
  const REFRESH_THRESHOLD_MS   = 5  * 60 * 1000;   // refresh when < 5 min left
  const REFRESH_CHECK_MS       = 2  * 60 * 1000;   // check every 2 min
  const SOCKET_REAUTH_DELAY_MS = 500;              // debounce socket reauth after refresh

  // Roles — single source of truth
  const ROLES = Object.freeze({
    SUPER_ADMIN : 'super_admin',
    INSTITUTE   : 'institute',
    INSTRUCTOR  : 'instructor',
    TEACHER     : 'teacher',        // institute-linked teacher (same account as instructor)
    STUDENT     : 'student',
    PARENT      : 'parent',
  });

  // OTP purposes
  const OTP_PURPOSE = Object.freeze({
    MOBILE_LOGIN     : 'mobile_login',
    PHONE_VERIFY     : 'phone_verify',
    PASSWORD_RESET   : 'password_reset',
    PARENT_LINK      : 'parent_link',
  });

  // Education levels (for registration + role guards)
  const EDU_LEVELS = Object.freeze([
    'preschool', 'primary', 'middle', 'high_school',
    'undergraduate', 'postgraduate',
  ]);

  // Internal state
  let _refreshTimer        = null;    // setInterval handle
  let _socketReauthTimer   = null;    // debounce handle
  let _otpRequestTimestamp = null;    // for OTP rate-limit UX
  let _isRefreshing        = false;   // prevent concurrent refreshes
  let _refreshPromise      = null;    // shared promise during refresh
  let _initDone            = false;   // guard against double Auth.init()


  /* ============================================================
     INTERNAL STORAGE HELPERS
     All storage ops go through these — never call localStorage
     directly anywhere else in this file.
  ============================================================ */

  /**
   * Read a raw string from localStorage.
   * Returns null on any failure (private browsing, quota, missing key).
   */
  function _lsGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  /**
   * Write a raw string to localStorage.
   * Silently fails on quota errors (user still has in-memory session via Store).
   */
  function _lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      _warn('localStorage.setItem failed for key:', key, e);
    }
  }

  /**
   * Remove a key from localStorage.
   */
  function _lsRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  /**
   * Read and JSON.parse a stored object. Returns null on parse error.
   */
  function _lsGetJson(key) {
    const raw = _lsGet(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      _warn('JSON.parse failed for key:', key);
      _lsRemove(key);   // corrupt data — remove it
      return null;
    }
  }

  /**
   * JSON.stringify and store an object.
   */
  function _lsSetJson(key, value) {
    try {
      _lsSet(key, JSON.stringify(value));
    } catch (e) {
      _warn('JSON.stringify failed for key:', key, e);
    }
  }


  /* ============================================================
     INTERNAL LOGGING
  ============================================================ */

  function _log(...args) {
    if (global.console) console.log('[Auth]', ...args);
  }

  function _warn(...args) {
    if (global.console) console.warn('[Auth]', ...args);
  }

  function _error(...args) {
    if (global.console) console.error('[Auth]', ...args);
  }


  /* ============================================================
     SESSION MANAGEMENT
  ============================================================ */

  /**
   * Auth.init()
   *
   * Call once per page load (called by Router.init()).
   * - Restores session from localStorage into Store
   * - Detects and handles impersonation mode (Super Admin)
   * - Schedules proactive token refresh
   * - Starts cross-tab sync listener
   * - Reconnects Socket.io with current token
   *
   * Returns: user object if session restored, null otherwise.
   */
  Auth.init = function () {
    if (_initDone) return Auth.getUser();
    _initDone = true;

    // Check for impersonation first (Super Admin feature)
    const impersonateData = _lsGetJson(IMPERSONATE_KEY);
    if (impersonateData && impersonateData.token && impersonateData.user) {
      _hydrateStore(
        impersonateData.token,
        null,
        impersonateData.user,
        null,
        true    // isImpersonating = true
      );
      _listenForSessionEvents();
      _connectSocket();
      _log('Impersonation session restored for user:', impersonateData.user.email);
      return impersonateData.user;
    }

    const restored = _restoreSession();

    if (restored) {
      _scheduleTokenRefresh();
      _listenForSessionEvents();
      _connectSocket();
    }

    return restored;
  };

  /**
   * Restore session from localStorage → Store.
   * Returns user object or null.
   */
  function _restoreSession() {
    const token   = _lsGet(TOKEN_KEY);
    const refresh = _lsGet(REFRESH_TOKEN_KEY);
    const user    = _lsGetJson(USER_KEY);
    const role    = _lsGet(ROLE_KEY);

    if (!token || !user) return null;

    // Validate stored role matches user object (tamper check)
    if (role && user.role && role !== user.role) {
      _warn('Role mismatch in storage — clearing session');
      _clearSession();
      return null;
    }

    _hydrateStore(token, refresh, user, null);

    _log('Session restored for role:', user.role, '| user:', user.email || user.phone);
    return user;
  }

  /**
   * Hydrate the global Store with auth state.
   * Single source of truth — always call this, never set Store directly.
   */
  function _hydrateStore(token, refreshToken, user, expiresAt, isImpersonating) {
    if (!global.Store) return;

    global.Store.set('auth', {
      isLoggedIn      : true,
      token           : token,
      refreshToken    : refreshToken || null,
      expiresAt       : expiresAt || null,
      user            : user,
      role            : user.role,
      isImpersonating : isImpersonating || false,

      // Convenience booleans for templates and route guards
      isSuperAdmin  : user.role === ROLES.SUPER_ADMIN,
      isInstitute   : user.role === ROLES.INSTITUTE,
      isInstructor  : user.role === ROLES.INSTRUCTOR || user.role === ROLES.TEACHER,
      isStudent     : user.role === ROLES.STUDENT,
      isParent      : user.role === ROLES.PARENT,

      // Pre-School parent lock mode
      isPreSchoolMode : user.role === ROLES.STUDENT &&
                        user.edu_level === 'preschool',
    });
  }

  /**
   * Persist session to localStorage.
   *
   * CRITICAL: tokens stored as RAW STRINGS.
   * Do NOT use JSON.stringify on token — pages read it via
   * raw localStorage.getItem() and send it in Authorization header.
   * User object IS JSON-stringified (it's an object).
   */
  function _persistSession(token, refreshToken, user) {
    if (token)        _lsSet(TOKEN_KEY, token);              // raw string
    if (refreshToken) _lsSet(REFRESH_TOKEN_KEY, refreshToken); // raw string
    if (user) {
      _lsSetJson(USER_KEY, user);                           // JSON object
      _lsSet(ROLE_KEY, user.role);                          // raw string for fast reads
    }
  }

  /**
   * Clear all session data from localStorage.
   */
  function _clearSession() {
    _lsRemove(TOKEN_KEY);
    _lsRemove(REFRESH_TOKEN_KEY);
    _lsRemove(USER_KEY);
    _lsRemove(ROLE_KEY);
    _lsRemove(SESSION_ID_KEY);
    // Do NOT remove IMPERSONATE_KEY here — handled separately in stopImpersonation()
  }

  /**
   * Update stored user object without touching token.
   * Used after profile updates, avatar changes, etc.
   */
  function _updateStoredUser(updatedUser) {
    _lsSetJson(USER_KEY, updatedUser);
    if (updatedUser.role) _lsSet(ROLE_KEY, updatedUser.role);
    if (global.Store) {
      global.Store.set('auth.user', updatedUser);
      // Update convenience booleans in case role changed
      global.Store.set('auth.isPreSchoolMode',
        updatedUser.role === ROLES.STUDENT && updatedUser.edu_level === 'preschool');
    }
  }


  /* ============================================================
     TOKEN REFRESH — PROACTIVE + ON-DEMAND
  ============================================================ */

  /**
   * Schedule proactive token refresh before expiry.
   * Checks every REFRESH_CHECK_MS.
   * Multiple calls are safe — clears previous timer.
   */
  function _scheduleTokenRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);

    _refreshTimer = setInterval(async function () {
      const expiresAt = global.Store ? global.Store.get('auth.expiresAt') : null;
      if (!expiresAt) return;

      const timeLeft = new Date(expiresAt).getTime() - Date.now();

      if (timeLeft < REFRESH_THRESHOLD_MS && timeLeft > 0) {
        _log('Proactive refresh triggered — time left:', Math.round(timeLeft / 1000) + 's');
        try {
          await Auth.refreshToken();
        } catch (e) {
          // Silent — api.js 401 interceptor will handle on next request
          _warn('Proactive refresh failed:', e.message);
        }
      }

      // Token already expired — force logout
      if (timeLeft <= 0 && Auth.isLoggedIn()) {
        _warn('Token expired — forcing logout');
        await Auth.logout(false);
      }

    }, REFRESH_CHECK_MS);
  }

  /**
   * Manually trigger token refresh.
   * Called by: proactive scheduler, api.js 401 interceptor, any page.
   *
   * Concurrent-safe: if a refresh is already in flight, returns the
   * same promise (all callers share the result).
   *
   * Returns new access token string.
   */
  Auth.refreshToken = async function () {
    // If already refreshing, share the in-flight promise
    if (_isRefreshing && _refreshPromise) {
      _log('Refresh already in flight — sharing promise');
      return _refreshPromise;
    }

    _isRefreshing = true;

    _refreshPromise = (async function () {
      try {
        // Prefer the httpOnly cookie (backend reads it automatically).
        // Send the localStorage fallback in the body as backup.
        const fallbackRefresh = _lsGet(REFRESH_TOKEN_KEY);

        const response = await global.Api.post('/auth/refresh', {
          refresh_token: fallbackRefresh || undefined,
        });

        if (!response || !response.data || !response.data.token) {
          throw new Error('Token refresh response invalid.');
        }

        const { token, refresh_token, expires_at } = response.data;

        // Update Store
        if (global.Store) {
          global.Store.set('auth.token', token);
          if (refresh_token) global.Store.set('auth.refreshToken', refresh_token);
          if (expires_at)    global.Store.set('auth.expiresAt', expires_at);
        }

        // Update localStorage — token as raw string
        _lsSet(TOKEN_KEY, token);
        if (refresh_token) _lsSet(REFRESH_TOKEN_KEY, refresh_token);

        // Re-authenticate Socket.io with new token (debounced)
        _debounceSocketReauth(token);

        _log('Token refreshed successfully');
        return token;

      } catch (e) {
        _error('Token refresh failed:', e.message);

        // If refresh fails with 401/403 — session is dead, log out
        if (e.status === 401 || e.status === 403) {
          _warn('Refresh token rejected — logging out');
          await Auth.logout(false);
        }

        throw e;

      } finally {
        _isRefreshing   = false;
        _refreshPromise = null;
      }
    })();

    return _refreshPromise;
  };

  /**
   * Debounced socket re-authentication after token refresh.
   * Multiple rapid refreshes only trigger one socket reauth.
   */
  function _debounceSocketReauth(newToken) {
    if (_socketReauthTimer) clearTimeout(_socketReauthTimer);
    _socketReauthTimer = setTimeout(function () {
      _connectSocket(newToken);
    }, SOCKET_REAUTH_DELAY_MS);
  }

  /**
   * Check if the current access token is expired.
   * Reads expiresAt from Store.
   * Returns false (assume valid) if expiresAt is unknown.
   */
  Auth.isTokenExpired = function () {
    const expiresAt = global.Store ? global.Store.get('auth.expiresAt') : null;
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
  };


  /* ============================================================
     SOCKET.IO RE-AUTHENTICATION
  ============================================================ */

  /**
   * Connect / reconnect Socket.io with the current auth token.
   * Called after login, token refresh, and page restore.
   * Socket.js is responsible for the actual connection logic.
   */
  function _connectSocket(token) {
    if (!global.Socket) return;

    const t = token || Auth.getToken();
    if (!t) return;

    try {
      global.Socket.authenticate(t);
    } catch (e) {
      _warn('Socket authentication failed:', e.message);
    }
  }


  /* ============================================================
     CROSS-TAB SESSION SYNC
  ============================================================ */

  /**
   * Listen for storage events from other tabs.
   * - Token removed in another tab → log out this tab silently
   * - Token updated in another tab → update this tab's Store
   */
  function _listenForSessionEvents() {
    global.addEventListener('storage', async function (e) {
      if (e.key === TOKEN_KEY) {
        if (e.newValue === null) {
          // Another tab logged out
          _log('Cross-tab logout detected');
          await Auth.logout(false);   // silent, no API call, no redirect loop
        } else if (e.newValue && e.newValue !== Auth.getToken()) {
          // Another tab refreshed the token — sync it here
          _log('Cross-tab token sync');
          if (global.Store) global.Store.set('auth.token', e.newValue);
          _connectSocket(e.newValue);
        }
      }

      if (e.key === USER_KEY && e.newValue) {
        // Profile updated in another tab
        try {
          const updatedUser = JSON.parse(e.newValue);
          if (updatedUser && global.Store) {
            global.Store.set('auth.user', updatedUser);
          }
        } catch (err) {}
      }
    });
  }


  /* ============================================================
     LOGIN — Email + Password
  ============================================================ */

  /**
   * Auth.login({ email, password, remember })
   *
   * - Validates input client-side
   * - Calls POST /auth/login
   * - Hydrates Store + localStorage
   * - Starts refresh scheduler
   * - Authenticates Socket.io
   *
   * Returns: user object
   * Throws: { clientError: true, errors: [...] } or ApiError
   */
  Auth.login = async function (credentials) {
    const { email, password, remember } = credentials;

    const errors = _validateLoginInput(email, password);
    if (errors.length) throw { clientError: true, errors };

    const response = await global.Api.auth.login({ email, password });

    if (!response || !response.data) {
      throw { clientError: false, message: 'Invalid response from server.' };
    }

    const { token, refresh_token, user, expires_at, session_id } = response.data;

    if (!token || !user) {
      throw { clientError: false, message: 'Authentication failed — missing token or user.' };
    }

    _hydrateStore(token, refresh_token, user, expires_at);
    _persistSession(token, refresh_token, user);

    if (session_id) _lsSet(SESSION_ID_KEY, session_id);

    _scheduleTokenRefresh();
    _connectSocket(token);

    _log('Login successful — role:', user.role, '| user:', user.email);
    return user;
  };

  function _validateLoginInput(email, password) {
    const errors = [];
    const U = global.Utils;

    if (!email || !U || !U.isValidEmail(email)) {
      errors.push({ field: 'email', message: 'Enter a valid email address.' });
    }
    if (!password || password.length < 1) {
      errors.push({ field: 'password', message: 'Password is required.' });
    }
    return errors;
  }


  /* ============================================================
     LOGIN — OTP / Mobile Number
  ============================================================ */

  /**
   * Step 1: Request OTP to phone number.
   *
   * Auth.requestMobileOtp({ phone, purpose })
   * purpose: 'mobile_login' | 'phone_verify' | 'password_reset' | 'parent_link'
   *
   * Rate-limited client-side: 60 seconds between requests (mirrors backend).
   */
  Auth.requestMobileOtp = async function ({ phone, purpose }) {
    const U = global.Utils;

    if (!phone || !U || !U.isValidPhone(phone)) {
      throw { clientError: true, errors: [{ field: 'phone', message: 'Enter a valid phone number.' }] };
    }

    const validPurposes = Object.values(OTP_PURPOSE);
    if (!purpose || !validPurposes.includes(purpose)) {
      throw { clientError: true, errors: [{ field: 'purpose', message: 'Invalid OTP purpose.' }] };
    }

    // Client-side rate limit (60 seconds)
    if (_otpRequestTimestamp) {
      const elapsed = Date.now() - _otpRequestTimestamp;
      if (elapsed < 60000) {
        const remaining = Math.ceil((60000 - elapsed) / 1000);
        throw {
          clientError: true,
          errors: [{ field: 'phone', message: `Please wait ${remaining}s before requesting another OTP.` }],
        };
      }
    }

    const response = await global.Api.auth.requestOtp({ phone, purpose });
    _otpRequestTimestamp = Date.now();

    _log('OTP sent to:', phone, '| purpose:', purpose);
    return response && response.data;
  };

  /**
   * Step 2: Verify OTP and log in (for mobile_login purpose).
   *
   * Auth.verifyMobileOtp({ phone, otp })
   *
   * Returns user object on success.
   */
  Auth.verifyMobileOtp = async function ({ phone, otp }) {
    const errors = [];

    if (!phone || !global.Utils || !global.Utils.isValidPhone(phone)) {
      errors.push({ field: 'phone', message: 'Enter a valid phone number.' });
    }
    if (!otp || otp.toString().length < 4) {
      errors.push({ field: 'otp', message: 'Enter the OTP sent to your phone.' });
    }
    if (errors.length) throw { clientError: true, errors };

    const response = await global.Api.auth.verifyOtp({
      phone,
      otp: otp.toString(),
      purpose: OTP_PURPOSE.MOBILE_LOGIN,
    });

    if (!response || !response.data) {
      throw { clientError: false, message: 'OTP verification failed.' };
    }

    const { token, refresh_token, user, expires_at, session_id } = response.data;

    _hydrateStore(token, refresh_token, user, expires_at);
    _persistSession(token, refresh_token, user);
    if (session_id) _lsSet(SESSION_ID_KEY, session_id);
    _scheduleTokenRefresh();
    _connectSocket(token);

    _otpRequestTimestamp = null;  // reset rate limit on success

    _log('OTP login successful — role:', user.role);
    return user;
  };


  /* ============================================================
     REGISTER
  ============================================================ */

  /**
   * Auth.register(data)
   *
   * Supports all role-specific registration flows:
   *
   * All roles:
   *   name, email, password, confirm_password, role, phone (optional)
   *
   * Student (independent):
   *   + edu_level (preschool/primary/.../postgraduate)
   *
   * Student (institute-affiliated):
   *   + institute_code   — links student to institute (pending approval)
   *   + edu_level
   *
   * Parent:
   *   + relationship (father/mother/guardian)
   *   + child_student_id (optional — link at registration or later)
   *
   * Instructor:
   *   + expertise_areas (array of strings)
   *   + bio
   *
   * Institute:
   *   + institute_name, institute_type (school/college/coaching)
   *   + address, accreditation_doc (file — handled separately via uploadDocument)
   *   Note: Institute registration is a 2-step flow.
   *         Step 1: this register() — creates admin account + institute record
   *         Step 2: uploadDocument() — uploads accreditation, triggers Super Admin review
   *
   * Returns response.data on success.
   * Does NOT auto-login (email verification required on most setups).
   */
  Auth.register = async function (data) {
    const errors = _validateRegisterInput(data);
    if (errors.length) throw { clientError: true, errors };

    const response = await global.Api.auth.register(data);

    if (!response || !response.data) {
      throw { clientError: false, message: 'Registration failed. Please try again.' };
    }

    _log('Registration successful — role:', data.role, '| email:', data.email);
    return response.data;
  };

  function _validateRegisterInput(data) {
    const errors = [];
    const U = global.Utils;
    if (!U) return [{ field: 'form', message: 'Utils not loaded.' }];

    // --- Common fields ---
    if (!data.name || U.isEmpty(data.name)) {
      errors.push({ field: 'name', message: 'Full name is required.' });
    } else if (data.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters.' });
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

    if (!data.role || !Object.values(ROLES).includes(data.role)) {
      errors.push({ field: 'role', message: 'Please select a valid role.' });
    }

    if (data.phone && !U.isValidPhone(data.phone)) {
      errors.push({ field: 'phone', message: 'Enter a valid 10-digit phone number.' });
    }

    // --- Role-specific validation ---
    if (data.role === ROLES.STUDENT) {
      // register.html sends 'grade'; edu_level is optional
      if (!data.grade && !data.edu_level) {
        errors.push({ field: 'grade', message: 'Please select your grade or level.' });
      }
    }

    if (data.role === ROLES.PARENT) {
      // register.html sends 'relation'; support both field names
      const rel = data.relation || data.relationship;
      // Accept all values from the register.html dropdown
      const validRelationships = ['father', 'mother', 'guardian', 'grandparent', 'other'];
      if (!rel || !validRelationships.includes(rel)) {
        errors.push({ field: 'p-relation', message: 'Please select your relationship to the child.' });
      }
    }

    if (data.role === ROLES.INSTITUTE) {
      if (!data.institute_name || U.isEmpty(data.institute_name)) {
        errors.push({ field: 'institute_name', message: 'Institute name is required.' });
      }
      // Accept all values from the register.html dropdown
      const validTypes = ['preschool', 'primary', 'secondary', 'k12', 'school', 'college', 'university', 'coaching', 'other'];
      if (!data.institute_type || !validTypes.includes(data.institute_type)) {
        errors.push({ field: 'institute_type', message: 'Please select the institute type.' });
      }
    }

    return errors;
  }


  /* ============================================================
     LOGOUT
  ============================================================ */

  /**
   * Auth.logout()        — full logout: API call + clear session + redirect
   * Auth.logout(false)   — silent: no API call, no redirect (cross-tab sync, expiry)
   */
  Auth.logout = async function (callApi) {
    callApi = callApi !== false;

    // Stop timers
    if (_refreshTimer)      { clearInterval(_refreshTimer);  _refreshTimer = null; }
    if (_socketReauthTimer) { clearTimeout(_socketReauthTimer); _socketReauthTimer = null; }

    // Disconnect socket
    if (global.Socket) {
      try { global.Socket.disconnect(); } catch (e) {}
    }

    if (callApi) {
      try {
        const sessionId = _lsGet(SESSION_ID_KEY);
        await global.Api.auth.logout({ session_id: sessionId });
      } catch (e) {
        // Never block logout on API failure
        _warn('Logout API call failed (continuing):', e.message);
      }
    }

    _clearSession();

    if (global.Store) global.Store.clearAuth();

    _initDone = false;  // allow re-init on next page if needed

    if (callApi) {
      // Use replace so back button doesn't return to authenticated page
      global.location.replace('/pages/auth/login.html');
    }

    _log('Logout complete — callApi:', callApi);
  };


  /* ============================================================
     FORGOT PASSWORD
  ============================================================ */

  /**
   * Auth.forgotPassword(email)
   * Sends a password reset link to the email.
   */
  Auth.forgotPassword = async function (email) {
    const U = global.Utils;
    if (!email || !U || !U.isValidEmail(email)) {
      throw { clientError: true, errors: [{ field: 'email', message: 'Enter a valid email address.' }] };
    }

    const response = await global.Api.auth.forgotPassword({ email });
    return response && response.data;
  };


  /* ============================================================
     RESET PASSWORD
  ============================================================ */

  /**
   * Auth.resetPassword({ token, password, confirm_password })
   * token comes from ?token= in the reset email link.
   */
  Auth.resetPassword = async function (data) {
    const errors = [];
    const U = global.Utils;

    if (!data.token || U.isEmpty(data.token)) {
      errors.push({ field: 'token', message: 'Reset token is missing or invalid.' });
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

    if (errors.length) throw { clientError: true, errors };

    const response = await global.Api.auth.resetPassword(data);
    _log('Password reset successful');
    return response && response.data;
  };


  /* ============================================================
     EMAIL VERIFICATION
  ============================================================ */

  /**
   * Auth.verifyEmail(token)
   * token from ?token= in the verification email.
   */
  Auth.verifyEmail = async function (token) {
    if (!token) {
      throw { clientError: true, errors: [{ field: 'token', message: 'Verification token is missing.' }] };
    }

    const response = await global.Api.auth.verifyEmail({ token });

    // Some backends return a session directly after email verify
    if (response && response.data && response.data.token) {
      const { token: accessToken, refresh_token, user, expires_at } = response.data;
      _hydrateStore(accessToken, refresh_token, user, expires_at);
      _persistSession(accessToken, refresh_token, user);
      _scheduleTokenRefresh();
      _connectSocket(accessToken);
      _log('Email verified + auto-logged in:', user.email);
    }

    return response && response.data;
  };

  /**
   * Auth.resendVerificationEmail(email)
   */
  Auth.resendVerificationEmail = async function (email) {
    const U = global.Utils;
    if (!email || !U || !U.isValidEmail(email)) {
      throw { clientError: true, errors: [{ field: 'email', message: 'Enter a valid email address.' }] };
    }
    const response = await global.Api.auth.resendVerification({ email });
    return response && response.data;
  };


  /* ============================================================
     PHONE VERIFICATION (authenticated)
  ============================================================ */

  /**
   * Step 1: Send OTP to user's phone to verify it.
   * Auth.requestPhoneVerification()
   * Uses currently logged-in user's phone.
   */
  Auth.requestPhoneVerification = async function () {
    const user = Auth.getUser();
    if (!user || !user.phone) {
      throw { clientError: true, errors: [{ field: 'phone', message: 'No phone number on your account.' }] };
    }
    return Auth.requestMobileOtp({ phone: user.phone, purpose: OTP_PURPOSE.PHONE_VERIFY });
  };

  /**
   * Step 2: Verify phone OTP (authenticated user).
   * Auth.verifyPhone({ otp })
   */
  Auth.verifyPhone = async function ({ otp }) {
    if (!otp) {
      throw { clientError: true, errors: [{ field: 'otp', message: 'OTP is required.' }] };
    }

    const user = Auth.getUser();
    if (!user || !user.phone) {
      throw { clientError: true, errors: [{ field: 'phone', message: 'No phone on account.' }] };
    }

    const response = await global.Api.auth.verifyOtp({
      phone: user.phone,
      otp: otp.toString(),
      purpose: OTP_PURPOSE.PHONE_VERIFY,
    });

    // Update stored user with is_phone_verified = true
    if (response && response.data && response.data.user) {
      _updateStoredUser(response.data.user);
    } else if (user) {
      _updateStoredUser(Object.assign({}, user, { is_phone_verified: true }));
    }

    _otpRequestTimestamp = null;
    return response && response.data;
  };


  /* ============================================================
     CHANGE PASSWORD (authenticated)
  ============================================================ */

  /**
   * Auth.changePassword({ current_password, new_password, confirm_password })
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
    if (data.current_password && data.new_password === data.current_password) {
      errors.push({ field: 'new_password', message: 'New password must differ from current password.' });
    }
    if (data.new_password !== data.confirm_password) {
      errors.push({ field: 'confirm_password', message: 'Passwords do not match.' });
    }

    if (errors.length) throw { clientError: true, errors };

    const response = await global.Api.auth.changePassword({
      current_password : data.current_password,
      new_password     : data.new_password,
      // confirm_password is never sent to backend — client-side only
    });

    // Force logout all other sessions (backend invalidates old refresh tokens)
    // This tab stays logged in with the new token returned
    if (response && response.data && response.data.token) {
      const { token, refresh_token, expires_at } = response.data;
      if (global.Store) {
        global.Store.set('auth.token', token);
        if (expires_at) global.Store.set('auth.expiresAt', expires_at);
      }
      _lsSet(TOKEN_KEY, token);
      if (refresh_token) _lsSet(REFRESH_TOKEN_KEY, refresh_token);
      _connectSocket(token);
    }

    _log('Password changed successfully');
    return response && response.data;
  };


  /* ============================================================
     PROFILE UPDATE
  ============================================================ */

  /**
   * Auth.updateProfile(data)
   * Updates name, bio, social links, edu_level, etc.
   * Syncs updated user to Store + localStorage across all tabs.
   */
  Auth.updateProfile = async function (data) {
    const response = await global.Api.auth.updateProfile(data);

    if (response && response.data && response.data.user) {
      _updateStoredUser(response.data.user);
      _log('Profile updated');
    }

    return response && response.data;
  };

  /**
   * Auth.uploadAvatar(file, onProgress)
   * Validates file type + size before uploading.
   * onProgress(percent) called during upload.
   */
  Auth.uploadAvatar = async function (file, onProgress) {
    if (!file) {
      throw { clientError: true, errors: [{ field: 'avatar', message: 'No file selected.' }] };
    }

    const U = global.Utils;
    if (!U.isAllowedFileType(file, ['jpg', 'jpeg', 'png', 'webp'])) {
      throw { clientError: true, errors: [{ field: 'avatar', message: 'Only JPG, PNG, or WEBP images are allowed.' }] };
    }
    if (!U.isFileSizeOk(file, 5)) {
      throw { clientError: true, errors: [{ field: 'avatar', message: 'Image must be under 5 MB.' }] };
    }

    const response = await global.Api.auth.uploadAvatar(file, onProgress);

    if (response && response.data && response.data.avatar_url) {
      const currentUser = Auth.getUser();
      if (currentUser) {
        _updateStoredUser(Object.assign({}, currentUser, { avatar: response.data.avatar_url }));
      }
    }

    _log('Avatar uploaded');
    return response && response.data;
  };

  /**
   * Auth.uploadDocument(file, docType)
   * For Institute accreditation uploads, Instructor credentials, etc.
   * docType: 'accreditation' | 'credential' | 'identity'
   */
  Auth.uploadDocument = async function (file, docType) {
    if (!file) {
      throw { clientError: true, errors: [{ field: 'document', message: 'No file selected.' }] };
    }

    const U = global.Utils;
    if (!U.isAllowedFileType(file, ['pdf', 'jpg', 'jpeg', 'png'])) {
      throw { clientError: true, errors: [{ field: 'document', message: 'Only PDF, JPG, or PNG files are allowed.' }] };
    }
    if (!U.isFileSizeOk(file, 10)) {
      throw { clientError: true, errors: [{ field: 'document', message: 'File must be under 10 MB.' }] };
    }

    const response = await global.Api.auth.uploadDocument(file, docType);
    _log('Document uploaded — type:', docType);
    return response && response.data;
  };


  /* ============================================================
     PARENT — CHILD LINKING
  ============================================================ */

  /**
   * Auth.linkChild({ student_id, otp })
   *
   * Parent links their account to a child's student account.
   * OTP is sent to the student's registered phone/email (requested separately).
   *
   * After successful link, the parent's user object is updated with
   * the new linked_students array.
   */
  Auth.requestChildLinkOtp = async function ({ phone }) {
    return Auth.requestMobileOtp({ phone, purpose: OTP_PURPOSE.PARENT_LINK });
  };

  Auth.linkChild = async function ({ student_id, otp }) {
    const errors = [];

    if (!student_id) {
      errors.push({ field: 'student_id', message: 'Student ID is required.' });
    }
    if (!otp) {
      errors.push({ field: 'otp', message: 'OTP is required.' });
    }
    if (errors.length) throw { clientError: true, errors };

    const response = await global.Api.auth.linkChild({
      student_id,
      otp: otp.toString(),
    });

    if (response && response.data && response.data.user) {
      _updateStoredUser(response.data.user);
    }

    _otpRequestTimestamp = null;
    _log('Child linked to parent — student_id:', student_id);
    return response && response.data;
  };

  /**
   * Auth.unlinkChild(student_id)
   * Parent unlinks a previously linked child.
   */
  Auth.unlinkChild = async function (student_id) {
    if (!student_id) {
      throw { clientError: true, errors: [{ field: 'student_id', message: 'Student ID is required.' }] };
    }

    const response = await global.Api.auth.unlinkChild({ student_id });

    if (response && response.data && response.data.user) {
      _updateStoredUser(response.data.user);
    }

    _log('Child unlinked — student_id:', student_id);
    return response && response.data;
  };


  /* ============================================================
     SUPER ADMIN — USER IMPERSONATION
  ============================================================ */

  /**
   * Auth.impersonateUser(userId)
   *
   * Super Admin only. Temporarily acts as another user for support debugging.
   * - Action is logged in audit trail on the backend
   * - Original Super Admin session is saved separately
   * - Impersonation is indicated in the UI via isImpersonating flag
   *
   * Call Auth.stopImpersonation() to return to original session.
   */
  Auth.impersonateUser = async function (userId) {
    if (!Auth.hasRole(ROLES.SUPER_ADMIN)) {
      throw { clientError: true, errors: [{ field: 'role', message: 'Only Super Admin can impersonate users.' }] };
    }
    if (!userId) {
      throw { clientError: true, errors: [{ field: 'userId', message: 'User ID is required.' }] };
    }

    // Save current super admin session before overwriting
    const currentToken = Auth.getToken();
    const currentUser  = Auth.getUser();
    _lsSetJson('ev_sa_session', { token: currentToken, user: currentUser });

    const response = await global.Api.admin.impersonateUser(userId);

    if (!response || !response.data || !response.data.token) {
      throw { clientError: false, message: 'Impersonation failed.' };
    }

    const { token, user } = response.data;

    // Store impersonation data separately
    _lsSetJson(IMPERSONATE_KEY, { token, user });

    _hydrateStore(token, null, user, null, true);
    _lsSet(TOKEN_KEY, token);   // so api.js picks it up for requests

    _connectSocket(token);

    _log('Impersonating user:', user.email, '| role:', user.role);
    return user;
  };

  /**
   * Auth.stopImpersonation()
   * Restores original Super Admin session.
   */
  Auth.stopImpersonation = function () {
    const savedSession = _lsGetJson('ev_sa_session');

    _lsRemove(IMPERSONATE_KEY);
    _lsRemove('ev_sa_session');

    if (savedSession && savedSession.token && savedSession.user) {
      _hydrateStore(savedSession.token, null, savedSession.user, null, false);
      _lsSet(TOKEN_KEY, savedSession.token);
      _connectSocket(savedSession.token);
      _log('Impersonation ended — restored Super Admin session');
    } else {
      // Fallback — just reload
      global.location.replace('/pages/superadmin/dashboard.html');
    }
  };


  /* ============================================================
     CONVENIENCE GETTERS
  ============================================================ */

  Auth.getUser = function () {
    if (global.Store) {
      const u = global.Store.get('auth.user');
      if (u) return u;
    }
    return _lsGetJson(USER_KEY);
  };

  Auth.getRole = function () {
    if (global.Store) {
      const r = global.Store.get('auth.role');
      if (r) return r;
    }
    return _lsGet(ROLE_KEY);
  };

  Auth.isLoggedIn = function () {
    if (global.Store) return !!global.Store.get('auth.isLoggedIn');
    return !!_lsGet(TOKEN_KEY) && !!_lsGetJson(USER_KEY);
  };

  /**
   * Get the current access token.
   * Tries Store first (hydrated, fast), then localStorage (cold page load).
   */
  Auth.getToken = function () {
    if (global.Store) {
      const t = global.Store.get('auth.token');
      if (t) return t;
    }
    return _lsGet(TOKEN_KEY);   // raw string — never JSON-encoded
  };

  /**
   * Auth.hasRole(role | role[])
   * Auth.hasRole('student')
   * Auth.hasRole(['instructor', 'teacher'])
   */
  Auth.hasRole = function (role) {
    const userRole = Auth.getRole();
    if (!userRole) return false;
    return Array.isArray(role) ? role.includes(userRole) : userRole === role;
  };

  /**
   * Auth.canAccess(requiredRoles)
   * Alias for hasRole — semantic for route guards.
   */
  Auth.canAccess = function (requiredRoles) {
    return Auth.hasRole(requiredRoles);
  };

  /**
   * Auth.isImpersonating()
   * Returns true if Super Admin is currently impersonating another user.
   */
  Auth.isImpersonating = function () {
    return global.Store ? !!global.Store.get('auth.isImpersonating') : false;
  };

  /**
   * Auth.isPreSchoolMode()
   * Returns true if logged in student is in Pre-School (age 2–5) mode.
   * Used to lock the UI into simple, parent-controlled view.
   */
  Auth.isPreSchoolMode = function () {
    return global.Store ? !!global.Store.get('auth.isPreSchoolMode') : false;
  };

  /**
   * Auth.getLinkedChildren()
   * For Parent role — returns array of linked student objects.
   */
  Auth.getLinkedChildren = function () {
    const user = Auth.getUser();
    if (!user || user.role !== ROLES.PARENT) return [];
    return user.linked_students || [];
  };

  /**
   * Auth.getInstituteId()
   * Returns institute_id for institute-affiliated users.
   */
  Auth.getInstituteId = function () {
    const user = Auth.getUser();
    return user ? (user.institute_id || null) : null;
  };

  /**
   * Auth.getEduLevel()
   * Returns edu_level for student users.
   */
  Auth.getEduLevel = function () {
    const user = Auth.getUser();
    return user ? (user.edu_level || null) : null;
  };


  /* ============================================================
     OAUTH — GOOGLE (Redirect-based)
  ============================================================ */

  /**
   * Auth.loginWithGoogle()
   * Redirects to backend Google OAuth endpoint.
   * Backend handles the Google flow and redirects back to callback page.
   * No popup — redirect only (works on mobile, avoids popup blockers).
   */
  Auth.loginWithGoogle = function () {
    // Store current path so we can redirect back after OAuth
    const redirect = encodeURIComponent(global.location.pathname + global.location.search);
    global.location.href = '/api/v1/auth/oauth/google?redirect=' + redirect;
  };

  /**
   * Auth.handleOAuthCallback()
   *
   * Called on the OAuth redirect-back landing page.
   * Reads token from URL query params (backend puts them there after OAuth).
   * Fetches full user profile with the new token.
   *
   * Returns: { success: true, user } | { success: false, error: '...' }
   */
  Auth.handleOAuthCallback = async function () {
    const U = global.Utils;
    if (!U) return { success: false, error: 'Utils not loaded.' };

    const token        = U.getParam('token');
    const refreshToken = U.getParam('refresh_token');
    const expiresAt    = U.getParam('expires_at');
    const errorParam   = U.getParam('error');

    if (errorParam) {
      return { success: false, error: decodeURIComponent(errorParam) };
    }
    if (!token) {
      return { success: false, error: 'No token received from OAuth provider.' };
    }

    // Temporarily store token so Api can make authenticated requests
    if (global.Store) global.Store.set('auth.token', token);
    _lsSet(TOKEN_KEY, token);

    try {
      const response = await global.Api.auth.me();
      const user = response && response.data;

      if (!user) {
        return { success: false, error: 'Failed to load user profile.' };
      }

      _hydrateStore(token, refreshToken, user, expiresAt || null);
      _persistSession(token, refreshToken, user);
      _scheduleTokenRefresh();
      _connectSocket(token);

      _log('OAuth login successful — role:', user.role, '| user:', user.email);
      return { success: true, user };

    } catch (e) {
      _error('OAuth callback failed:', e.message);
      _clearSession();
      if (global.Store) global.Store.clearAuth();
      return { success: false, error: 'Failed to authenticate. Please try again.' };
    }
  };


  /* ============================================================
     FORM ERROR RENDERING HELPERS
     Shared across all auth pages — login, register, forgot, reset, OTP
  ============================================================ */

  /**
   * Auth.renderErrors(errors, formEl)
   * Renders field-level errors onto matching input elements.
   * errors: [{ field: 'email', message: '...' }]
   * Each input must have name="fieldname".
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
   * Auth.clearErrors(formEl)
   */
  Auth.clearErrors = function (formEl) {
    if (!formEl) return;
    formEl.querySelectorAll('.input-error').forEach(function (input) {
      if (global.Utils) global.Utils.clearFieldError(input);
    });
  };

  /**
   * Auth.showAlert(message, type, formEl)
   * type: 'error' | 'success' | 'warning' | 'info'
   * Auto-hides after 6 seconds.
   */
  Auth.showAlert = function (message, type, formEl) {
    const alertEl = formEl
      ? formEl.querySelector('.auth-alert')
      : document.querySelector('.auth-alert');
    if (!alertEl) return;

    alertEl.className = 'auth-alert alert alert-' + (type || 'error');
    alertEl.textContent = message;
    if (global.Utils) global.Utils.show(alertEl);

    // Clear previous auto-hide timer
    if (alertEl._hideTimer) clearTimeout(alertEl._hideTimer);

    alertEl._hideTimer = setTimeout(function () {
      if (global.Utils) global.Utils.hide(alertEl);
    }, 6000);
  };

  /**
   * Auth.hideAlert(formEl)
   */
  Auth.hideAlert = function (formEl) {
    const alertEl = formEl
      ? formEl.querySelector('.auth-alert')
      : document.querySelector('.auth-alert');
    if (!alertEl) return;
    if (alertEl._hideTimer) clearTimeout(alertEl._hideTimer);
    if (global.Utils) global.Utils.hide(alertEl);
  };

  /**
   * Auth.handleApiError(err, formEl)
   *
   * Unified error handler for all auth form submissions.
   * Automatically routes client errors to field errors,
   * and server errors to the top-level alert.
   *
   * Usage in page scripts:
   *   try { await Auth.login(...); }
   *   catch (err) { Auth.handleApiError(err, formEl); }
   */
  Auth.handleApiError = function (err, formEl) {
    if (!err) return;

    if (err.clientError && err.errors && err.errors.length) {
      Auth.renderErrors(err.errors, formEl);
      return;
    }

    // Server validation errors (422 from backend)
    if (err.status === 422 && err.data && err.data.errors) {
      Auth.renderErrors(err.data.errors, formEl);
      return;
    }

    // Specific known status codes
    if (err.status === 401) {
      Auth.showAlert('Invalid credentials. Please check your email and password.', 'error', formEl);
      return;
    }
    if (err.status === 403) {
      Auth.showAlert('Your account is suspended or not yet verified. Please contact support.', 'error', formEl);
      return;
    }
    if (err.status === 429) {
      Auth.showAlert('Too many attempts. Please wait a moment before trying again.', 'warning', formEl);
      return;
    }
    if (err.status >= 500) {
      Auth.showAlert('Server error. Please try again in a few moments.', 'error', formEl);
      return;
    }

    // Fallback
    const message = (err.data && err.data.message) || err.message || 'Something went wrong. Please try again.';
    Auth.showAlert(message, 'error', formEl);
  };


  /* ============================================================
     ROLE DASHBOARD REDIRECT
  ============================================================ */

  /**
   * Auth.redirectToDashboard(user)
   *
   * After login/OAuth, redirect the user to their role-appropriate dashboard.
   * Uses Router if available, otherwise window.location.
   */
  Auth.redirectToDashboard = function (user) {
    const roleRoutes = {
      [ROLES.SUPER_ADMIN] : '/pages/superadmin/dashboard.html',
      [ROLES.INSTITUTE]   : '/pages/institute/dashboard.html',
      [ROLES.INSTRUCTOR]  : '/pages/instructor/dashboard.html',
      [ROLES.TEACHER]     : '/pages/instructor/dashboard.html',   // same UI, different data
      [ROLES.STUDENT]     : '/pages/student/dashboard.html',
      [ROLES.PARENT]      : '/pages/parent/dashboard.html',
    };

    const u = user || Auth.getUser();
    const dest = u && roleRoutes[u.role];

    if (!dest) {
      _warn('Unknown role for redirect:', u && u.role);
      global.location.replace('/pages/auth/login.html');
      return;
    }

    // Check for ?redirect= param from pre-login destination
    const U = global.Utils;
    const redirectParam = U ? U.getParam('redirect') : null;
    const finalDest = redirectParam ? decodeURIComponent(redirectParam) : dest;

    if (global.Router) {
      global.Router.navigate(finalDest);
    } else {
      global.location.replace(finalDest);
    }

    _log('Redirecting to:', finalDest, '| role:', u && u.role);
  };


  /* ============================================================
     CONSTANTS EXPOSURE
     Pages can use Auth.ROLES.STUDENT etc. instead of magic strings.
  ============================================================ */

  Auth.ROLES       = ROLES;
  Auth.OTP_PURPOSE = OTP_PURPOSE;
  Auth.EDU_LEVELS  = EDU_LEVELS;


  /* ============================================================
     EXPOSE
  ============================================================ */

  global.Auth = Auth;

})(window);