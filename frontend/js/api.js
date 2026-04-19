/**
 * EduVerse — Unified API Client
 * api.js
 *
 * MERGED from:
 *   - api.js  (Frontend API Module — bulletproof JSON parsing, XHR progress)
 *   - api.js  (Full API Client — token refresh queue, interceptors, cancellation, retry)
 *
 * Combined Features:
 *   ✔ Bulletproof response parsing  — reads text first, never throws raw JSON error
 *   ✔ Handles empty / non-JSON responses gracefully (204 No Content, nginx crash pages)
 *   ✔ Automatic JWT attach on every request
 *   ✔ Silent token refresh on 401 with concurrent-request queue
 *   ✔ Auto-logout + redirect on unrecoverable 401
 *   ✔ Retry once on network failure
 *   ✔ Request cancellation via AbortController (Api.cancelToken())
 *   ✔ Configurable timeout (default 30 s)
 *   ✔ XHR-based upload with real-time progress + speed tracking
 *   ✔ Fetch-based upload helper (smaller files / simple usage)
 *   ✔ Centralized ApiError class with status / code / data fields
 *   ✔ Named endpoint groups: auth, student, instructor, parent,
 *       institute, superadmin, courses, quizzes, discussions,
 *       notifications, payments, messages, liveSessions, certificates
 *   ✔ Specific HTTP-status messages: 404, 413, 502 / 503, 403, 5xx
 *   ✔ Store / Utils integration (optional — degrades gracefully)
 *
 * Depends on: (optional) utils.js, store.js
 * Exposed as: window.Api
 *
 * Author: EduVerse Engineering
 */

(function (global) {
  'use strict';

  /* ============================================================
     CONFIG
  ============================================================ */

  const CONFIG = {
    baseUrl:       (global.EV_API_BASE || 'http://localhost:5000/api/v1'),  // override via window.EV_API_BASE
    timeout:       30000,       // 30 seconds; set to 0 for uploads (handled separately)
    retryAttempts: 1,           // retry once on network failure
    retryDelay:    1000,        // ms before retry
  };


  /* ============================================================
     CUSTOM ERROR CLASS
  ============================================================ */

  /**
   * ApiError — all errors thrown by this module are instances of ApiError.
   * @param {string} message  Human-readable description
   * @param {number} status   HTTP status code (0 = network / parse error)
   * @param {string} code     Machine-readable code (e.g. 'SESSION_EXPIRED')
   * @param {*}      data     Raw response body, if available
   */
  function ApiError(message, status, code, data) {
    this.name    = 'ApiError';
    this.message = message || 'An unexpected error occurred.';
    this.status  = status  || 0;
    this.code    = code    || 'UNKNOWN_ERROR';
    this.data    = data    || null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;


  /* ============================================================
     TOKEN REFRESH QUEUE
     When a 401 fires, all in-flight requests are paused and queued.
     Once the single refresh call completes they are all replayed.
  ============================================================ */

  let _isRefreshing = false;
  let _refreshQueue = []; // [{ resolve, reject }]

  function _processRefreshQueue(error, token) {
    _refreshQueue.forEach(function (item) {
      if (error) item.reject(error);
      else       item.resolve(token);
    });
    _refreshQueue = [];
  }


  /* ============================================================
     HELPERS
  ============================================================ */

  /** Build an absolute URL from a relative endpoint. */
  function _buildUrl(endpoint) {
    if (/^https?:\/\//.test(endpoint)) return endpoint;
    const base = CONFIG.baseUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return base + path;
  }

  /** Read the current auth token from Store → localStorage fallback. */
  function _getToken() {
    if (global.Store) return global.Store.get('auth.token') || '';
    try { return localStorage.getItem('ev_token') || ''; } catch (e) { return ''; }
  }

  /** Build Authorization header if a token is present. */
  function _authHeaders() {
    const token = _getToken();
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  /** Normalize any thrown value into an ApiError. */
  function _normalizeError(err, status) {
    if (err instanceof ApiError) return err;
    if (err && err.name === 'AbortError') {
      return new ApiError('Request was cancelled.', 0, 'REQUEST_CANCELLED');
    }
    if (err && err.name === 'TypeError') {
      return new ApiError(
        'Network error. Please check your connection.',
        0,
        'NETWORK_ERROR'
      );
    }
    return new ApiError(
      (err && err.message) || 'An unexpected error occurred.',
      status || 0,
      'UNKNOWN_ERROR'
    );
  }

  /**
   * Bulletproof response parser.
   * Reads body as text first (safe even for empty / 204 responses),
   * then attempts JSON.parse. Falls back to meaningful errors instead
   * of the cryptic "Unexpected end of JSON input".
   *
   * @param  {Response} response  fetch Response object
   * @param  {string}   method    HTTP verb (for error messages)
   * @param  {string}   endpoint  URL path  (for error messages)
   * @returns {*} Parsed JSON, or an object representing an empty success.
   */
  async function _parseResponse(response, method, endpoint) {
    let rawText;
    try {
      rawText = await response.text();
    } catch (readErr) {
      throw new ApiError(
        'Failed to read server response: ' + readErr.message,
        response.status,
        'READ_ERROR'
      );
    }

    // ── Empty body ────────────────────────────────────────────
    if (!rawText || !rawText.trim()) {
      if (response.ok) {
        // 204 No Content — treat as success
        return { success: true, message: 'OK', data: null };
      }
      throw new ApiError(
        'Server returned an empty response (HTTP ' + response.status + '). ' +
        'Check server logs for errors.',
        response.status,
        'EMPTY_RESPONSE'
      );
    }

    // ── Known non-JSON status codes ───────────────────────────
    if (response.status === 413) {
      throw new ApiError(
        'File too large. Please use a smaller file.',
        413,
        'FILE_TOO_LARGE'
      );
    }
    if (response.status === 404) {
      throw new ApiError(
        'API route not found: ' + (method || '') + ' ' + (endpoint || '') +
        '. Check that the backend server is running and the route exists.',
        404,
        'NOT_FOUND'
      );
    }
    if (response.status === 502 || response.status === 503) {
      throw new ApiError(
        'Server is temporarily unavailable. Please try again in a moment.',
        response.status,
        'SERVER_UNAVAILABLE'
      );
    }

    // ── Attempt JSON parse ────────────────────────────────────
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // Server returned HTML (e.g. nginx 502 page) or garbled text
      const preview = rawText.substring(0, 200).replace(/\n/g, ' ');
      throw new ApiError(
        'Server returned an invalid response (HTTP ' + response.status +
        '). Expected JSON but got: ' + preview,
        response.status,
        'INVALID_JSON'
      );
    }

    return data;
  }

  /**
   * Attempt a silent access-token refresh using the stored refresh token.
   * Updates Store + localStorage on success.
   */
  async function _refreshToken() {
    const refreshToken = global.Store
      ? global.Store.get('auth.refreshToken')
      : (global.Utils
          ? global.Utils.storage.get('ev_refresh_token')
          : (() => { try { return localStorage.getItem('ev_refresh_token'); } catch (e) { return null; } })()
        );

    if (!refreshToken) {
      throw new ApiError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
    }

    const response = await fetch(_buildUrl('/auth/refresh'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new ApiError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
    }

    const responseData = await _parseResponse(response, 'POST', '/auth/refresh');
    const newToken = responseData && responseData.data && responseData.data.token;

    if (!newToken) {
      throw new ApiError('Token refresh failed.', 401, 'TOKEN_REFRESH_FAILED');
    }

    // Persist new tokens
    if (global.Store) {
      global.Store.set('auth.token', newToken);
      if (responseData.data.refresh_token) {
        global.Store.set('auth.refreshToken', responseData.data.refresh_token);
      }
    }
    if (global.Utils) {
      global.Utils.storage.set('ev_token', newToken);
      if (responseData.data.refresh_token) {
        global.Utils.storage.set('ev_refresh_token', responseData.data.refresh_token);
      }
    } else {
      try {
        localStorage.setItem('ev_token', newToken);
        if (responseData.data.refresh_token) {
          localStorage.setItem('ev_refresh_token', responseData.data.refresh_token);
        }
      } catch (e) { /* ignore */ }
    }

    return newToken;
  }

  /**
   * Force a full logout: clears tokens and redirects to the login page.
   * @param {string} [reason]  Optional query-string reason appended to the URL.
   */
  function _forceLogout(reason) {
    try {
      localStorage.removeItem('ev_token');
      localStorage.removeItem('ev_refresh_token');
      localStorage.removeItem('ev_user');
    } catch (e) { /* ignore */ }
    if (global.Store) global.Store.clearAuth && global.Store.clearAuth();

    // Small delay allows any in-flight toasts to render before redirect
    setTimeout(function () {
      const url = '/pages/auth/login.html' + (reason ? '?reason=' + reason : '');
      window.location.replace(url);
    }, 800);
  }


  /* ============================================================
     CORE REQUEST FUNCTION
     Every public method routes through _request().
  ============================================================ */

  /**
   * @param {string}  method    HTTP verb
   * @param {string}  endpoint  Relative or absolute URL
   * @param {object}  [opts]    Options
   * @param {*}       [opts.body]                  Request body (object or FormData)
   * @param {object}  [opts.params]                Query-string parameters
   * @param {object}  [opts.headers]               Extra headers
   * @param {AbortSignal} [opts.signal]            Cancellation signal
   * @param {boolean} [opts.skipAuth]              Skip Authorization header
   * @param {boolean} [opts.skipRetry]             Skip the one-retry-on-network-fail
   * @param {boolean} [opts._isRetryAfterRefresh]  Internal flag — prevents refresh loops
   */
  async function _request(method, endpoint, opts) {
    opts = opts || {};

    const {
      body                  = null,
      params                = null,
      headers               = {},
      signal                = null,
      skipAuth              = false,
      skipRetry             = false,
      _isRetryAfterRefresh  = false,
    } = opts;

    // Build URL + optional query string
    let url = _buildUrl(endpoint);
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      if (qs) url += '?' + qs;
    }

    // Compose headers
    const requestHeaders = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
      skipAuth ? {} : _authHeaders(),
      headers
    );

    // Timeout via AbortController
    const controller = new AbortController();
    const timeoutId  = CONFIG.timeout
      ? setTimeout(() => controller.abort(), CONFIG.timeout)
      : null;
    const effectiveSignal = signal || controller.signal;

    // Compose fetch options
    const fetchOpts = {
      method:  method.toUpperCase(),
      headers: requestHeaders,
      signal:  effectiveSignal,
    };

    if (body !== null && method !== 'GET' && method !== 'HEAD') {
      if (body instanceof FormData) {
        // Browser must set Content-Type + boundary for multipart
        delete fetchOpts.headers['Content-Type'];
        fetchOpts.body = body;
      } else {
        fetchOpts.body = JSON.stringify(body);
      }
    }

    // ── Fire the request ──────────────────────────────────────
    let response;
    try {
      response = await fetch(url, fetchOpts);
    } catch (networkErr) {
      if (timeoutId) clearTimeout(timeoutId);
      const normalized = _normalizeError(networkErr);

      // One automatic retry on network failure
      if (!skipRetry && normalized.code === 'NETWORK_ERROR') {
        const delay = global.Utils
          ? global.Utils.sleep(CONFIG.retryDelay)
          : new Promise(r => setTimeout(r, CONFIG.retryDelay));
        await delay;
        return _request(method, endpoint, Object.assign({}, opts, { skipRetry: true }));
      }

      throw new ApiError(
        'Cannot reach the server. Please check your connection or try again. (' +
        networkErr.message + ')',
        0,
        'NETWORK_ERROR'
      );
    }

    if (timeoutId) clearTimeout(timeoutId);

    // ── Handle 401: silent token refresh ─────────────────────
    if (response.status === 401 && !skipAuth && !_isRetryAfterRefresh) {
      if (_isRefreshing) {
        // Park this request until the in-progress refresh resolves
        return new Promise(function (resolve, reject) {
          _refreshQueue.push({
            resolve: function (newToken) {
              resolve(_request(method, endpoint, Object.assign({}, opts, {
                headers: Object.assign({}, headers, { Authorization: 'Bearer ' + newToken }),
                _isRetryAfterRefresh: true,
              })));
            },
            reject,
          });
        });
      }

      _isRefreshing = true;
      try {
        const newToken = await _refreshToken();
        _isRefreshing  = false;
        _processRefreshQueue(null, newToken);
        // Replay original request with refreshed token
        return _request(method, endpoint, Object.assign({}, opts, {
          _isRetryAfterRefresh: true,
        }));
      } catch (refreshError) {
        _isRefreshing = false;
        _processRefreshQueue(refreshError, null);
        _forceLogout('session_expired');
        throw new ApiError(
          'Session expired. Redirecting to login…',
          401,
          'SESSION_EXPIRED'
        );
      }
    }

    // ── Parse response body ───────────────────────────────────
    const data = await _parseResponse(response, method, endpoint);

    // ── HTTP error responses ──────────────────────────────────
    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        response.statusText ||
        'Request failed';
      const code = (data && data.code) || 'HTTP_' + response.status;

      // Show toasts for common errors (requires Store)
      if (global.Store && global.Store.addToast) {
        if (response.status === 403) {
          global.Store.addToast(
            'error',
            'Access Denied',
            'You do not have permission to perform this action.'
          );
        } else if (response.status >= 500) {
          global.Store.addToast(
            'error',
            'Server Error',
            'Something went wrong. Please try again later.'
          );
        }
      }

      throw new ApiError(message, response.status, code, data);
    }

    // ── success === false from our API envelope ───────────────
    if (data && data.success === false) {
      throw new ApiError(
        data.message || 'Request failed (HTTP ' + response.status + ')',
        response.status,
        (data && data.code) || 'API_ERROR',
        data
      );
    }

    return data;
  }


  /* ============================================================
     PUBLIC API OBJECT
  ============================================================ */

  const Api = {};

  /** GET  */
  Api.get = function (endpoint, params, opts) {
    return _request('GET', endpoint, Object.assign({}, opts, { params }));
  };
  /** POST */
  Api.post = function (endpoint, body, opts) {
    return _request('POST', endpoint, Object.assign({}, opts, { body }));
  };
  /** PUT  */
  Api.put = function (endpoint, body, opts) {
    return _request('PUT', endpoint, Object.assign({}, opts, { body }));
  };
  /** PATCH */
  Api.patch = function (endpoint, body, opts) {
    return _request('PATCH', endpoint, Object.assign({}, opts, { body }));
  };
  /** DELETE */
  Api.delete = function (endpoint, opts) {
    return _request('DELETE', endpoint, opts);
  };

  /**
   * Fetch-based upload (simple, no progress).
   * For large files with progress tracking use Api.upload() below.
   */
  Api.uploadSimple = function (endpoint, formData) {
    return _request('POST', endpoint, { body: formData });
  };


  /* ============================================================
     XHR UPLOAD WITH REAL-TIME PROGRESS + SPEED TRACKING
     Used for large videos or any file where progress feedback matters.

     Api.upload('/instructor/lessons/5/video', file, {
       fieldName:  'video',
       onProgress: (percent, speed) => console.log(percent + '% @ ' + speed + ' B/s'),
       extraFields: { title: 'Intro', is_preview: '0' },
       onAbortReady: (abortFn) => { window._cancelUpload = abortFn; },
     })
  ============================================================ */

  /**
   * @param {string}   endpoint
   * @param {File}     file
   * @param {object}   [opts]
   * @param {string}   [opts.fieldName='file']      FormData field name
   * @param {object}   [opts.extraFields]           Additional FormData fields
   * @param {Function} [opts.onProgress]            (percent: number, speedBps: number) => void
   * @param {Function} [opts.onAbortReady]          Receives an abort() function
   * @returns {Promise<*>}
   */
  Api.upload = function (endpoint, file, opts) {
    opts = opts || {};
    const { fieldName = 'file', extraFields, onProgress, onAbortReady } = opts;

    return new Promise(function (resolve, reject) {
      const url  = _buildUrl(endpoint);
      const xhr  = new XMLHttpRequest();
      const form = new FormData();
      const start = Date.now();

      form.append(fieldName, file);
      if (extraFields) {
        Object.entries(extraFields).forEach(([k, v]) => form.append(k, v));
      }

      xhr.open('POST', url, true);
      xhr.timeout = 0; // No timeout for potentially large uploads

      const token = _getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Accept', 'application/json');

      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.addEventListener('progress', function (e) {
          if (!e.lengthComputable) return;
          const pct     = Math.round((e.loaded / e.total) * 100);
          const elapsed = (Date.now() - start) / 1000;
          const speed   = elapsed > 0 ? e.loaded / elapsed : 0;
          onProgress(pct, speed);
        });
      }

      xhr.onload = function () {
        const raw = xhr.responseText || '';

        // Empty body
        if (!raw.trim()) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, message: 'Upload complete.', data: null });
          } else {
            reject(new ApiError(
              'Server returned an empty response (HTTP ' + xhr.status + ')',
              xhr.status,
              'EMPTY_RESPONSE'
            ));
          }
          return;
        }

        // File too large
        if (xhr.status === 413) {
          reject(new ApiError(
            'File too large. Server rejected the upload.',
            413,
            'FILE_TOO_LARGE'
          ));
          return;
        }

        // Parse JSON
        let data;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          reject(new ApiError(
            'Upload succeeded but server returned invalid JSON (HTTP ' + xhr.status +
            '). Preview: ' + raw.substring(0, 150),
            xhr.status,
            'INVALID_JSON'
          ));
          return;
        }

        if (data.success === false) {
          reject(new ApiError(data.message || 'Upload failed', xhr.status, 'UPLOAD_ERROR', data));
          return;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const msg = (data && data.message) || 'Upload failed.';
          reject(new ApiError(msg, xhr.status, 'UPLOAD_ERROR', data));
        }
      };

      xhr.onerror   = () => reject(new ApiError('Network error during upload. Check your connection.', 0, 'NETWORK_ERROR'));
      xhr.ontimeout = () => reject(new ApiError('Upload timed out.',                                     0, 'TIMEOUT'));
      xhr.onabort   = () => reject(new ApiError('Upload cancelled.',                                     0, 'REQUEST_CANCELLED'));

      xhr.send(form);

      if (typeof onAbortReady === 'function') {
        onAbortReady(function () { xhr.abort(); });
      }
    });
  };


  /* ============================================================
     CANCELLATION TOKEN
     const token = Api.cancelToken();
     Api.get('/search', params, { signal: token.signal });
     token.cancel(); // aborts
  ============================================================ */

  Api.cancelToken = function () {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      cancel: function () { controller.abort(); },
    };
  };


  /* ============================================================
     NAMED ENDPOINT GROUPS
  ============================================================ */

  /* ── Auth ─────────────────────────────────────────────────── */
  Api.auth = {
    login:              (data)         => Api.post('/auth/login',                data, { skipAuth: true }),
    register:           (data)         => Api.post('/auth/register',             data, { skipAuth: true }),
    resendVerification: (email)        => Api.post('/auth/resend-verification',  { email }, { skipAuth: true }),
    forgotPassword:     (email)        => Api.post('/auth/forgot-password',      { email }, { skipAuth: true }),
    resetPassword:      (data)         => Api.post('/auth/reset-password',       data, { skipAuth: true }),
    verifyEmail:        (token)        => Api.post('/auth/verify-email',         { token }, { skipAuth: true }),
    logout:             ()             => Api.post('/auth/logout',               {}),
    me:                 ()             => Api.get('/auth/me'),
    changePassword:     (data)         => Api.patch('/auth/change-password',     data),
    updateProfile:      (data)         => Api.patch('/auth/profile',             data),
    uploadAvatar:       (f, onProg)    => Api.upload('/auth/avatar',             f, { onProgress: onProg }),
  };

  /* ── Student ──────────────────────────────────────────────── */
  Api.student = {
    dashboard:          ()             => Api.get('/student/dashboard'),
    courses:            (params)       => Api.get('/student/courses',                        params),
    enrolledCourses:    ()             => Api.get('/student/courses/enrolled'),
    enroll:             (courseId)     => Api.post('/student/courses/' + courseId + '/enroll'),
    progress:           (courseId)     => Api.get('/student/courses/' + courseId + '/progress'),
    updateProgress:     (lessonId, d)  => Api.patch('/student/lessons/' + lessonId + '/progress', d),
    performance:        (params)       => Api.get('/student/performance',                    params),
    certificates:       ()             => Api.get('/student/certificates'),
    certificate:        (id)           => Api.get('/student/certificates/' + id),
    assignments:        (params)       => Api.get('/student/assignments',                    params),
    submitAssignment:   (id, data)     => Api.post('/student/assignments/' + id + '/submit', data),
    quizResult:         (id)           => Api.get('/student/quizzes/' + id + '/result'),
    attendance:         (params)       => Api.get('/student/attendance',                     params),
    activity:           (params)       => Api.get('/student/activity',                       params),
    notifications:      (params)       => Api.get('/student/notifications',                  params),
    markNotifRead:      (id)           => Api.patch('/student/notifications/' + id + '/read'),
    markAllRead:        ()             => Api.patch('/student/notifications/mark-all-read'),
    calendar:           (params)       => Api.get('/student/calendar',                       params),
    messages:           (params)       => Api.get('/student/messages',                       params),
    sendMessage:        (data)         => Api.post('/student/messages',                      data),
    profile:            ()             => Api.get('/student/profile'),
    updateProfile:      (data)         => Api.patch('/student/profile',                      data),
    fees:               ()             => Api.get('/student/fees'),
    payFee:             (data)         => Api.post('/student/fees/pay',                      data),
  };

  /* ── Instructor ───────────────────────────────────────────── */
  Api.instructor = {
    // Dashboard
    dashboard:          ()             => Api.get('/instructor/dashboard'),

    // Courses
    courses:            (params)       => Api.get('/instructor/courses',                                params),
    getCourse:          (id)           => Api.get('/instructor/courses/' + id),
    createCourse:       (data)         => Api.post('/instructor/courses',                               data),
    updateCourse:       (id, data)     => Api.patch('/instructor/courses/' + id,                        data),
    deleteCourse:       (id)           => Api.delete('/instructor/courses/' + id),
    publishCourse:      (id)           => Api.patch('/instructor/courses/' + id + '/publish',           {}),
    uploadThumbnail:    (id, f, onP)   => Api.upload('/instructor/courses/' + id + '/thumbnail',        f, { onProgress: onP }),

    // Coupons
    getCoupons:         (courseId)     => Api.get('/instructor/courses/' + courseId + '/coupons'),
    saveCoupons:        (courseId, c)  => Api.post('/instructor/courses/' + courseId + '/coupons',      { coupons: c }),

    // Sections / Modules
    sections:           (courseId)     => Api.get('/instructor/courses/' + courseId + '/sections'),
    getModules:         (courseId)     => Api.get('/instructor/courses/' + courseId + '/modules'),
    addModule:          (courseId, d)  => Api.post('/instructor/courses/' + courseId + '/modules',      d),
    updateModule:       (id, data)     => Api.patch('/instructor/modules/' + id,                        data),
    deleteModule:       (id)           => Api.delete('/instructor/modules/' + id),
    createSection:      (cId, data)    => Api.post('/instructor/courses/' + cId + '/sections',          data),
    updateSection:      (id, data)     => Api.put('/instructor/sections/' + id,                         data),
    deleteSection:      (id)           => Api.delete('/instructor/sections/' + id),

    // Lessons
    lessons:            (sectionId)    => Api.get('/instructor/sections/' + sectionId + '/lessons'),
    getLessons:         (moduleId)     => Api.get('/instructor/modules/' + moduleId + '/videos'),
    addLesson:          (modId, data)  => Api.post('/instructor/sections/' + modId + '/lessons',        data),
    createLesson:       (sId, data)    => Api.post('/instructor/sections/' + sId + '/lessons',          data),
    updateLesson:       (id, data)     => Api.patch('/instructor/lessons/' + id,                        data),
    deleteLesson:       (id)           => Api.delete('/instructor/lessons/' + id),
    saveLessonUrl:      (id, url)      => Api.post('/instructor/lessons/' + id + '/video-url',          { video_url: url }),

    // Video uploads (XHR with progress)
    uploadVideo:        (lessonId, f, onP)          => Api.upload(
      '/instructor/lessons/' + lessonId + '/upload-video', f, { fieldName: 'video', onProgress: onP }
    ),
    uploadVideoToModule: (moduleId, f, title, prev, onP) => Api.upload(
      '/instructor/modules/' + moduleId + '/videos/upload', f, {
        fieldName:   'video',
        extraFields: { title: title || f.name, is_preview: prev ? '1' : '0' },
        onProgress:  onP,
      }
    ),

    // Students
    students:           (params)       => Api.get('/instructor/students',                               params),
    getStudent:         (id)           => Api.get('/instructor/students/' + id),

    // Quizzes
    quizzes:            (params)       => Api.get('/instructor/quizzes',                                params),
    getQuiz:            (id)           => Api.get('/instructor/quizzes/' + id),
    createQuiz:         (data)         => Api.post('/instructor/quizzes',                               data),
    updateQuiz:         (id, data)     => Api.put('/instructor/quizzes/' + id,                          data),
    deleteQuiz:         (id)           => Api.delete('/instructor/quizzes/' + id),

    // Assignments
    assignments:        (params)       => Api.get('/instructor/assignments',                            params),
    getAssignment:      (id)           => Api.get('/instructor/assignments/' + id),
    createAssignment:   (data)         => Api.post('/instructor/assignments',                           data),
    updateAssignment:   (id, data)     => Api.put('/instructor/assignments/' + id,                      data),
    deleteAssignment:   (id)           => Api.delete('/instructor/assignments/' + id),
    getSubmissions:     (filters)      => Api.get('/instructor/submissions',                            filters),
    gradeSubmission:    (id, data)     => Api.post('/instructor/submissions/' + id + '/grade',          data),

    // Live sessions
    liveSessions:       (params)       => Api.get('/instructor/live-sessions',                          params),
    createLiveSession:  (data)         => Api.post('/instructor/live-sessions',                         data),
    updateLiveSession:  (id, data)     => Api.patch('/instructor/live-sessions/' + id,                  data),
    deleteLiveSession:  (id)           => Api.delete('/instructor/live-sessions/' + id),
    endSession:         (id)           => Api.patch('/instructor/live-sessions/' + id + '/end'),

    // Analytics & Earnings
    analytics:          (params)       => Api.get('/instructor/analytics',                              params),
    earnings:           (params)       => Api.get('/instructor/earnings',                               params),

    // Messages
    rooms:              ()             => Api.get('/instructor/messages/rooms'),
    getMessages:        (roomId, lim)  => Api.get('/instructor/messages/' + roomId,                     lim ? { limit: lim } : null),
    sendMessage:        (roomId, text) => Api.post('/instructor/messages/' + roomId,                    { content: text }),
    markRead:           (roomId)       => Api.patch('/instructor/messages/' + roomId + '/read',         {}),
    messages:           (params)       => Api.get('/instructor/messages',                               params),

    // Profile
    profile:            ()             => Api.get('/instructor/profile'),
    getProfile:         ()             => Api.get('/instructor/profile'),
    updateProfile:      (data)         => Api.patch('/instructor/profile',                              data),
    updatePassword:     (data)         => Api.patch('/instructor/profile/password',                     data),
    uploadAvatar:       (f, onP)       => Api.upload('/instructor/avatar',                              f, { onProgress: onP }),
  };

  /* ── Parent ───────────────────────────────────────────────── */
  Api.parent = {
    dashboard:          ()             => Api.get('/parent/dashboard'),
    children:           ()             => Api.get('/parent/children'),
    child:              (id)           => Api.get('/parent/children/' + id),
    childProgress:      (id, params)   => Api.get('/parent/children/' + id + '/progress',   params),
    childAttendance:    (id, params)   => Api.get('/parent/children/' + id + '/attendance',  params),
    childResults:       (id, params)   => Api.get('/parent/children/' + id + '/results',     params),
    fees:               (childId)      => Api.get('/parent/children/' + childId + '/fees'),
    payFee:             (data)         => Api.post('/parent/fees/pay',                       data),
    messages:           (params)       => Api.get('/parent/messages',                        params),
    sendMessage:        (data)         => Api.post('/parent/messages',                       data),
    meetings:           (params)       => Api.get('/parent/meetings',                        params),
    bookMeeting:        (data)         => Api.post('/parent/meetings',                       data),
    notifications:      (params)       => Api.get('/parent/notifications',                   params),
    profile:            ()             => Api.get('/parent/profile'),
    updateProfile:      (data)         => Api.patch('/parent/profile',                       data),
  };

  /* ── Institute ────────────────────────────────────────────── */
  Api.institute = {
    dashboard:          ()             => Api.get('/institute/dashboard'),
    profile:            ()             => Api.get('/institute/profile'),
    updateProfile:      (data)         => Api.put('/institute/profile',                      data),
    uploadLogo:         (f, onP)       => Api.upload('/institute/logo',                      f, { onProgress: onP }),
    students:           (params)       => Api.get('/institute/students',                     params),
    student:            (id)           => Api.get('/institute/students/' + id),
    addStudent:         (data)         => Api.post('/institute/students',                    data),
    updateStudent:      (id, data)     => Api.put('/institute/students/' + id,               data),
    deleteStudent:      (id)           => Api.delete('/institute/students/' + id),
    importStudents:     (f, onP)       => Api.upload('/institute/students/import',           f, { onProgress: onP }),
    teachers:           (params)       => Api.get('/institute/teachers',                     params),
    teacher:            (id)           => Api.get('/institute/teachers/' + id),
    addTeacher:         (data)         => Api.post('/institute/teachers',                    data),
    updateTeacher:      (id, data)     => Api.put('/institute/teachers/' + id,               data),
    deleteTeacher:      (id)           => Api.delete('/institute/teachers/' + id),
    classes:            (params)       => Api.get('/institute/classes',                      params),
    createClass:        (data)         => Api.post('/institute/classes',                     data),
    updateClass:        (id, data)     => Api.put('/institute/classes/' + id,                data),
    deleteClass:        (id)           => Api.delete('/institute/classes/' + id),
    timetable:          (params)       => Api.get('/institute/timetable',                    params),
    saveTimetable:      (data)         => Api.post('/institute/timetable',                   data),
    attendance:         (params)       => Api.get('/institute/attendance',                   params),
    markAttendance:     (data)         => Api.post('/institute/attendance',                  data),
    exams:              (params)       => Api.get('/institute/exams',                        params),
    createExam:         (data)         => Api.post('/institute/exams',                       data),
    updateExam:         (id, data)     => Api.put('/institute/exams/' + id,                  data),
    deleteExam:         (id)           => Api.delete('/institute/exams/' + id),
    results:            (params)       => Api.get('/institute/results',                      params),
    uploadResults:      (f, onP)       => Api.upload('/institute/results/import',            f, { onProgress: onP }),
    fees:               (params)       => Api.get('/institute/fees',                         params),
    createFeeRecord:    (data)         => Api.post('/institute/fees',                        data),
    content:            (params)       => Api.get('/institute/content',                      params),
    uploadContent:      (f, onP)       => Api.upload('/institute/content',                   f, { onProgress: onP }),
    deleteContent:      (id)           => Api.delete('/institute/content/' + id),
    announcements:      (params)       => Api.get('/institute/announcements',                params),
    createAnnounce:     (data)         => Api.post('/institute/announcements',               data),
    reports:            (type, params) => Api.get('/institute/reports/' + type,              params),
    certificates:       (params)       => Api.get('/institute/certificates',                 params),
    issueCertificate:   (data)         => Api.post('/institute/certificates',                data),
  };

  /* ── Super Admin ──────────────────────────────────────────── */
  Api.superadmin = {
    dashboard:          ()             => Api.get('/superadmin/dashboard'),
    institutes:         (params)       => Api.get('/superadmin/institutes',                  params),
    institute:          (id)           => Api.get('/superadmin/institutes/' + id),
    createInstitute:    (data)         => Api.post('/superadmin/institutes',                 data),
    updateInstitute:    (id, data)     => Api.put('/superadmin/institutes/' + id,            data),
    toggleInstitute:    (id, status)   => Api.patch('/superadmin/institutes/' + id + '/status', { status }),
    deleteInstitute:    (id)           => Api.delete('/superadmin/institutes/' + id),
    users:              (params)       => Api.get('/superadmin/users',                       params),
    user:               (id)           => Api.get('/superadmin/users/' + id),
    createUser:         (data)         => Api.post('/superadmin/users',                      data),
    updateUser:         (id, data)     => Api.put('/superadmin/users/' + id,                 data),
    toggleUser:         (id, status)   => Api.patch('/superadmin/users/' + id + '/status',  { status }),
    deleteUser:         (id)           => Api.delete('/superadmin/users/' + id),
    courses:            (params)       => Api.get('/superadmin/courses',                     params),
    toggleCourse:       (id, status)   => Api.patch('/superadmin/courses/' + id + '/status',{ status }),
    deleteCourse:       (id)           => Api.delete('/superadmin/courses/' + id),
    revenue:            (params)       => Api.get('/superadmin/revenue',                     params),
    analytics:          (params)       => Api.get('/superadmin/analytics',                   params),
    settings:           ()             => Api.get('/superadmin/settings'),
    updateSettings:     (data)         => Api.put('/superadmin/settings',                    data),
    support:            (params)       => Api.get('/superadmin/support',                     params),
    replySupport:       (id, data)     => Api.post('/superadmin/support/' + id + '/reply',   data),
    closeTicket:        (id)           => Api.patch('/superadmin/support/' + id + '/close'),
    reports:            (type, params) => Api.get('/superadmin/reports/' + type,             params),
    logs:               (params)       => Api.get('/superadmin/logs',                        params),
  };

  /* ── Courses (public catalog) ─────────────────────────────── */
  Api.courses = {
    list:               (params)       => Api.get('/courses',                params),
    detail:             (id)           => Api.get('/courses/' + id),
    search:             (params)       => Api.get('/courses/search',         params),
    categories:         ()             => Api.get('/courses/categories'),
    reviews:            (id, params)   => Api.get('/courses/' + id + '/reviews', params),
    submitReview:       (id, data)     => Api.post('/courses/' + id + '/reviews', data),
    enroll:             (id)           => Api.post('/courses/' + id + '/enroll', {}),
  };

  /* ── Quizzes ──────────────────────────────────────────────── */
  Api.quizzes = {
    start:              (id)           => Api.post('/quizzes/' + id + '/start'),
    submit:             (id, data)     => Api.post('/quizzes/' + id + '/submit', data),
    result:             (attemptId)    => Api.get('/quizzes/attempts/' + attemptId),
  };

  /* ── Discussions / Q&A ────────────────────────────────────── */
  Api.discussions = {
    list:               (courseId, p)  => Api.get('/courses/' + courseId + '/discussions', p),
    post:               (courseId, d)  => Api.post('/courses/' + courseId + '/discussions', d),
    reply:              (id, data)     => Api.post('/discussions/' + id + '/replies',       data),
    like:               (id)           => Api.post('/discussions/' + id + '/like'),
    delete:             (id)           => Api.delete('/discussions/' + id),
  };

  /* ── Notifications ────────────────────────────────────────── */
  Api.notifications = {
    list:               (params)       => Api.get('/notifications',                          params),
    markRead:           (id)           => Api.patch('/notifications/' + id + '/read'),
    markAllRead:        ()             => Api.patch('/notifications/mark-all-read'),
    preferences:        ()             => Api.get('/notifications/preferences'),
    updatePrefs:        (data)         => Api.put('/notifications/preferences',              data),
    delete:             (id)           => Api.delete('/notifications/' + id),
  };

  /* ── Payments ─────────────────────────────────────────────── */
  Api.payments = {
    initiate:           (data)         => Api.post('/payments/initiate',         data),
    verify:             (data)         => Api.post('/payments/verify',           data),
    history:            (params)       => Api.get('/payments/history',           params),
    invoice:            (id)           => Api.get('/payments/invoices/' + id),
    refund:             (id, data)     => Api.post('/payments/' + id + '/refund',data),
  };

  /* ── Messages / Chat ──────────────────────────────────────── */
  Api.messages = {
    rooms:              ()             => Api.get('/messages/rooms'),
    room:               (id)           => Api.get('/messages/rooms/' + id),
    createRoom:         (data)         => Api.post('/messages/rooms',                        data),
    messages:           (roomId, p)    => Api.get('/messages/rooms/' + roomId + '/messages', p),
    send:               (roomId, data) => Api.post('/messages/rooms/' + roomId + '/messages',data),
    markRead:           (roomId)       => Api.patch('/messages/rooms/' + roomId + '/read'),
    deleteMessage:      (id)           => Api.delete('/messages/' + id),
    uploadAttachment:   (f, onP)       => Api.upload('/messages/attachment',                 f, { onProgress: onP }),
  };

  /* ── Live Sessions ────────────────────────────────────────── */
  Api.liveSessions = {
    list:               (params)       => Api.get('/live-sessions',                  params),
    detail:             (id)           => Api.get('/live-sessions/' + id),
    join:               (id)           => Api.post('/live-sessions/' + id + '/join'),
    leave:              (id)           => Api.post('/live-sessions/' + id + '/leave'),
    token:              (id)           => Api.get('/live-sessions/' + id + '/token'),
    recordings:         (id)           => Api.get('/live-sessions/' + id + '/recordings'),
  };

  /* ── Certificates ─────────────────────────────────────────── */
  Api.certificates = {
    list:               (params)       => Api.get('/certificates',                   params),
    detail:             (id)           => Api.get('/certificates/' + id),
    download:           (id)           => Api.get('/certificates/' + id + '/download'),
    verify:             (code)         => Api.get('/certificates/verify/' + code,    null, { skipAuth: true }),
  };


  /* ============================================================
     EXPOSE
  ============================================================ */

  Api.ApiError = ApiError;
  Api.config   = CONFIG; // Allow callers to change baseUrl / timeout at runtime

  global.Api   = Api;

  // Legacy CommonJS / AMD support
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Api;
  }

})(typeof window !== 'undefined' ? window : this);