/**
 * EduVerse — API Client
 * api.js
 *
 * Purpose: Single HTTP layer for every backend call in the app.
 * All fetch calls go through here — never call fetch() directly
 * from a page or module.
 *
 * Features:
 *   - Automatic JWT attach on every request
 *   - Token refresh on 401 (silent, queues concurrent requests)
 *   - Request / response interceptors
 *   - Centralized error normalization
 *   - File upload with progress tracking
 *   - Request cancellation via AbortController
 *   - Retry on network failure
 *
 * Depends on: utils.js, store.js
 * Exposed as: window.Api
 *
 * Author: EduVerse Engineering
 * Last updated: 2025
 */

(function (global) {
  'use strict';

  /* ============================================================
     CONFIG
  ============================================================ */

  const CONFIG = {
    baseUrl:        'http://localhost:5000/api/v1',
    timeout:        30000,       // 30 seconds
    retryAttempts:  1,           // retry once on network failure
    retryDelay:     1000,        // 1 second before retry
  };


  /* ============================================================
     TOKEN REFRESH QUEUE
     When a 401 fires, all concurrent requests pause and wait
     for the single refresh call to complete, then replay.
  ============================================================ */

  let _isRefreshing    = false;
  let _refreshQueue    = [];    // [{ resolve, reject }]

  function _processRefreshQueue(error, token) {
    _refreshQueue.forEach(function (item) {
      if (error) item.reject(error);
      else item.resolve(token);
    });
    _refreshQueue = [];
  }


  /* ============================================================
     ERROR CLASS
  ============================================================ */

  function ApiError(message, status, code, data) {
    this.name    = 'ApiError';
    this.message = message || 'An unexpected error occurred.';
    this.status  = status  || 0;
    this.code    = code    || 'UNKNOWN_ERROR';
    this.data    = data    || null;
  }
  ApiError.prototype = Object.create(Error.prototype);


  /* ============================================================
     INTERNAL REQUEST HANDLER
  ============================================================ */

  /**
   * Build the full request URL.
   */
  function _buildUrl(endpoint) {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const base = CONFIG.baseUrl.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    return base + path;
  }

  /**
   * Get current auth headers.
   */
  function _authHeaders() {
    const token = global.Store ? global.Store.get('auth.token') : null;
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  }

  /**
   * Normalize any error into an ApiError.
   */
  function _normalizeError(err, status) {
    if (err instanceof ApiError) return err;
    if (err && err.name === 'AbortError') {
      return new ApiError('Request was cancelled.', 0, 'REQUEST_CANCELLED');
    }
    if (err && err.name === 'TypeError') {
      return new ApiError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
    }
    return new ApiError(
      (err && err.message) || 'An unexpected error occurred.',
      status || 0,
      'UNKNOWN_ERROR'
    );
  }

  /**
   * Parse a fetch Response into a usable value.
   * Attempts JSON first, falls back to text.
   */
  async function _parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch (e) {
        return null;
      }
    }
    if (contentType.includes('text/')) {
      return response.text();
    }
    return response.blob();
  }

  /**
   * Attempt to silently refresh the access token.
   * Called automatically when a 401 is received.
   */
  async function _refreshToken() {
    const refreshToken = global.Store
      ? global.Store.get('auth.refreshToken')
      : (global.Utils ? global.Utils.storage.get('ev_refresh_token') : null);

    if (!refreshToken) throw new ApiError('Session expired.', 401, 'SESSION_EXPIRED');

    const response = await fetch(_buildUrl('/auth/refresh'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new ApiError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
    }

    const data = await response.json();
    const newToken = data.data && data.data.token;

    if (!newToken) throw new ApiError('Token refresh failed.', 401, 'TOKEN_REFRESH_FAILED');

    // Update store and storage
    if (global.Store) {
      global.Store.set('auth.token', newToken);
      if (data.data.refresh_token) {
        global.Store.set('auth.refreshToken', data.data.refresh_token);
      }
    }
    if (global.Utils) {
      global.Utils.storage.set('ev_token', newToken);
      if (data.data.refresh_token) {
        global.Utils.storage.set('ev_refresh_token', data.data.refresh_token);
      }
    }

    return newToken;
  }

  /**
   * Core request function — all public methods route through here.
   */
  async function _request(method, endpoint, options) {
    options = options || {};

    const {
      body       = null,
      params     = null,
      headers    = {},
      signal     = null,
      skipAuth   = false,
      skipRetry  = false,
      onProgress = null,   // only for uploads
    } = options;

    let url = _buildUrl(endpoint);
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      if (qs) url += '?' + qs;
    }

    const requestHeaders = Object.assign(
      { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      skipAuth ? {} : _authHeaders(),
      headers
    );

    // Timeout via AbortController
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), CONFIG.timeout);
    const effectiveSignal = signal || controller.signal;

    let fetchOptions = {
      method:  method.toUpperCase(),
      headers: requestHeaders,
      signal:  effectiveSignal,
    };

    if (body !== null && method !== 'GET' && method !== 'HEAD') {
      if (body instanceof FormData) {
        // Let browser set correct multipart content-type boundary
        delete fetchOptions.headers['Content-Type'];
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err) {
      clearTimeout(timeoutId);
      const normalized = _normalizeError(err);
      // Retry once on network failure
      if (!skipRetry && normalized.code === 'NETWORK_ERROR') {
        await (global.Utils ? global.Utils.sleep(CONFIG.retryDelay) : new Promise(r => setTimeout(r, CONFIG.retryDelay)));
        return _request(method, endpoint, Object.assign({}, options, { skipRetry: true }));
      }
      throw normalized;
    }

    clearTimeout(timeoutId);

    // Handle 401 — token expired, attempt refresh
    if (response.status === 401 && !skipAuth && !options._isRetryAfterRefresh) {
      if (_isRefreshing) {
        // Queue this request and wait for refresh to complete
        return new Promise(function (resolve, reject) {
          _refreshQueue.push({
            resolve: function (newToken) {
              resolve(_request(method, endpoint, Object.assign({}, options, {
                headers: Object.assign({}, headers, { 'Authorization': 'Bearer ' + newToken }),
                _isRetryAfterRefresh: true,
              })));
            },
            reject: reject,
          });
        });
      }

      _isRefreshing = true;
      try {
        const newToken = await _refreshToken();
        _isRefreshing  = false;
        _processRefreshQueue(null, newToken);
        // Replay original request with new token
        return _request(method, endpoint, Object.assign({}, options, {
          _isRetryAfterRefresh: true,
        }));
      } catch (refreshError) {
        _isRefreshing = false;
        _processRefreshQueue(refreshError, null);
        // Force logout
        if (global.Store) global.Store.clearAuth();
        window.location.href = '/pages/auth/login.html?reason=session_expired';
        throw new ApiError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
      }
    }

    const responseData = await _parseResponse(response);

    // HTTP error responses
    if (!response.ok) {
      const message = (responseData && (responseData.message || responseData.error))
        || response.statusText
        || 'Request failed';
      const code = (responseData && responseData.code) || 'HTTP_' + response.status;

      // Show toast for common errors
      if (global.Store) {
        if (response.status === 403) {
          global.Store.addToast('error', 'Access Denied', 'You do not have permission to perform this action.');
        } else if (response.status >= 500) {
          global.Store.addToast('error', 'Server Error', 'Something went wrong. Please try again later.');
        }
      }

      throw new ApiError(message, response.status, code, responseData);
    }

    return responseData;
  }


  /* ============================================================
     PUBLIC API OBJECT
  ============================================================ */

  const Api = {};

  /** GET request */
  Api.get = function (endpoint, params, options) {
    return _request('GET', endpoint, Object.assign({}, options, { params: params }));
  };

  /** POST request */
  Api.post = function (endpoint, body, options) {
    return _request('POST', endpoint, Object.assign({}, options, { body: body }));
  };

  /** PUT request */
  Api.put = function (endpoint, body, options) {
    return _request('PUT', endpoint, Object.assign({}, options, { body: body }));
  };

  /** PATCH request */
  Api.patch = function (endpoint, body, options) {
    return _request('PATCH', endpoint, Object.assign({}, options, { body: body }));
  };

  /** DELETE request */
  Api.delete = function (endpoint, options) {
    return _request('DELETE', endpoint, options);
  };

  /**
   * Upload a file with progress tracking.
   * Uses XMLHttpRequest for progress events.
   *
   * Api.upload('/courses/thumbnail', file, {
   *   onProgress: (percent) => console.log(percent + '%'),
   *   extraFields: { course_id: 5 }
   * })
   */
  Api.upload = function (endpoint, file, options) {
    options = options || {};
    const { onProgress, extraFields, fieldName } = options;

    return new Promise(function (resolve, reject) {
      const url    = _buildUrl(endpoint);
      const xhr    = new XMLHttpRequest();
      const form   = new FormData();

      form.append(fieldName || 'file', file);
      if (extraFields) {
        Object.entries(extraFields).forEach(([k, v]) => form.append(k, v));
      }

      xhr.open('POST', url, true);

      // Attach auth token
      const token = global.Store ? global.Store.get('auth.token') : null;
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.setRequestHeader('Accept', 'application/json');

      if (xhr.upload && typeof onProgress === 'function') {
        xhr.upload.onprogress = function (e) {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent, e.loaded, e.total);
          }
        };
      }

      xhr.onload = function () {
        let data;
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = xhr.responseText; }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const msg = (data && data.message) || 'Upload failed.';
          reject(new ApiError(msg, xhr.status, 'UPLOAD_ERROR', data));
        }
      };

      xhr.onerror = function () {
        reject(new ApiError('Network error during upload.', 0, 'NETWORK_ERROR'));
      };

      xhr.onabort = function () {
        reject(new ApiError('Upload cancelled.', 0, 'REQUEST_CANCELLED'));
      };

      xhr.send(form);

      // Return abort function via options callback
      if (typeof options.onAbortReady === 'function') {
        options.onAbortReady(function () { xhr.abort(); });
      }
    });
  };

  /**
   * Create a cancellable request token.
   * const token = Api.cancelToken();
   * Api.get('/search', params, { signal: token.signal });
   * token.cancel(); // to abort
   */
  Api.cancelToken = function () {
    const controller = new AbortController();
    return {
      signal: controller.signal,
      cancel: function () { controller.abort(); },
    };
  };


  /* ============================================================
     NAMED ENDPOINT METHODS
     Every API route in one place — pages import and call these.
     Return raw promise — callers handle .then() / async-await.
  ============================================================ */

  /* ── Auth ── */
  Api.auth = {
    login:           (data)           => Api.post('/auth/login', data, { skipAuth: true }),
    register:        (data)           => Api.post('/auth/register', data, { skipAuth: true }),
    resendVerification: (email)       => Api.post('/auth/resend-verification', { email }, { skipAuth: true }),
    forgotPassword:  (email)          => Api.post('/auth/forgot-password', { email }, { skipAuth: true }),
    resetPassword:   (data)           => Api.post('/auth/reset-password', data, { skipAuth: true }),
    verifyEmail:     (token)          => Api.post('/auth/verify-email', { token }, { skipAuth: true }),
    logout:          ()               => Api.post('/auth/logout'),
    me:              ()               => Api.get('/auth/me'),
    changePassword:  (data)           => Api.patch('/auth/change-password', data),
    updateProfile:   (data)           => Api.patch('/auth/profile', data),
    uploadAvatar:    (file, onProg)   => Api.upload('/auth/avatar', file, { onProgress: onProg }),
  };

  /* ── Student ── */
  Api.student = {
    dashboard:       ()               => Api.get('/student/dashboard'),
    courses:         (params)         => Api.get('/student/courses', params),
    enrolledCourses: ()               => Api.get('/student/courses/enrolled'),
    enroll:          (courseId)       => Api.post('/student/courses/' + courseId + '/enroll'),
    progress:        (courseId)       => Api.get('/student/courses/' + courseId + '/progress'),
    updateProgress:  (lessonId, data) => Api.patch('/student/lessons/' + lessonId + '/progress', data),
    performance:     (params)         => Api.get('/student/performance', params),
    certificates:    ()               => Api.get('/student/certificates'),
    certificate:     (id)             => Api.get('/student/certificates/' + id),
    assignments:     (params)         => Api.get('/student/assignments', params),
    submitAssignment:(id, data)       => Api.post('/student/assignments/' + id + '/submit', data),
    quizResult:      (id)             => Api.get('/student/quizzes/' + id + '/result'),
    attendance:      (params)         => Api.get('/student/attendance', params),
    activity:        (params)         => Api.get('/student/activity', params),
    notifications:   (params)         => Api.get('/student/notifications', params),
    markNotifRead:   (id)             => Api.patch('/student/notifications/' + id + '/read'),
    markAllRead:     ()               => Api.patch('/student/notifications/mark-all-read'),
    calendar:        (params)         => Api.get('/student/calendar', params),
    messages:        (params)         => Api.get('/student/messages', params),
    sendMessage:     (data)           => Api.post('/student/messages', data),
    profile:         ()               => Api.get('/student/profile'),
    updateProfile:   (data)           => Api.patch('/student/profile', data),
    fees:            ()               => Api.get('/student/fees'),
    payFee:          (data)           => Api.post('/student/fees/pay', data),
  };

  /* ── Instructor ── */
  Api.instructor = {
    dashboard:       ()               => Api.get('/instructor/dashboard'),
    courses:         (params)         => Api.get('/instructor/courses', params),
    course:          (id)             => Api.get('/instructor/courses/' + id),
    createCourse:    (data)           => Api.post('/instructor/courses', data),
    updateCourse:    (id, data)       => Api.put('/instructor/courses/' + id, data),
    deleteCourse:    (id)             => Api.delete('/instructor/courses/' + id),
    publishCourse:   (id)             => Api.patch('/instructor/courses/' + id + '/publish'),
    uploadThumb:     (id, f, onProg)  => Api.upload('/instructor/courses/' + id + '/thumbnail', f, { onProgress: onProg }),
    sections:        (courseId)       => Api.get('/instructor/courses/' + courseId + '/sections'),
    createSection:   (courseId, data) => Api.post('/instructor/courses/' + courseId + '/sections', data),
    updateSection:   (id, data)       => Api.put('/instructor/sections/' + id, data),
    deleteSection:   (id)             => Api.delete('/instructor/sections/' + id),
    lessons:         (sectionId)      => Api.get('/instructor/sections/' + sectionId + '/lessons'),
    createLesson:    (sectionId, data)=> Api.post('/instructor/sections/' + sectionId + '/lessons', data),
    updateLesson:    (id, data)       => Api.put('/instructor/lessons/' + id, data),
    deleteLesson:    (id)             => Api.delete('/instructor/lessons/' + id),
    uploadVideo:     (id, f, onProg)  => Api.upload('/instructor/lessons/' + id + '/video', f, { onProgress: onProg }),
    students:        (params)         => Api.get('/instructor/students', params),
    studentDetail:   (id)             => Api.get('/instructor/students/' + id),
    assignments:     (params)         => Api.get('/instructor/assignments', params),
    createAssignment:(data)           => Api.post('/instructor/assignments', data),
    updateAssignment:(id, data)       => Api.put('/instructor/assignments/' + id, data),
    submissions:     (assignId)       => Api.get('/instructor/assignments/' + assignId + '/submissions'),
    gradeSubmission: (subId, data)    => Api.patch('/instructor/submissions/' + subId + '/grade', data),
    quizzes:         (params)         => Api.get('/instructor/quizzes', params),
    createQuiz:      (data)           => Api.post('/instructor/quizzes', data),
    updateQuiz:      (id, data)       => Api.put('/instructor/quizzes/' + id, data),
    deleteQuiz:      (id)             => Api.delete('/instructor/quizzes/' + id),
    analytics:       (params)         => Api.get('/instructor/analytics', params),
    earnings:        (params)         => Api.get('/instructor/earnings', params),
    liveSessions:    (params)         => Api.get('/instructor/live-sessions', params),
    createSession:   (data)           => Api.post('/instructor/live-sessions', data),
    endSession:      (id)             => Api.patch('/instructor/live-sessions/' + id + '/end'),
    messages:        (params)         => Api.get('/instructor/messages', params),
    sendMessage:     (data)           => Api.post('/instructor/messages', data),
    profile:         ()               => Api.get('/instructor/profile'),
    updateProfile:   (data)           => Api.patch('/instructor/profile', data),
    uploadAvatar:    (f, onProg)      => Api.upload('/instructor/avatar', f, { onProgress: onProg }),
  };

  /* ── Parent ── */
  Api.parent = {
    dashboard:       ()               => Api.get('/parent/dashboard'),
    children:        ()               => Api.get('/parent/children'),
    child:           (id)             => Api.get('/parent/children/' + id),
    childProgress:   (id, params)     => Api.get('/parent/children/' + id + '/progress', params),
    childAttendance: (id, params)     => Api.get('/parent/children/' + id + '/attendance', params),
    childResults:    (id, params)     => Api.get('/parent/children/' + id + '/results', params),
    fees:            (childId)        => Api.get('/parent/children/' + childId + '/fees'),
    payFee:          (data)           => Api.post('/parent/fees/pay', data),
    messages:        (params)         => Api.get('/parent/messages', params),
    sendMessage:     (data)           => Api.post('/parent/messages', data),
    meetings:        (params)         => Api.get('/parent/meetings', params),
    bookMeeting:     (data)           => Api.post('/parent/meetings', data),
    notifications:   (params)         => Api.get('/parent/notifications', params),
    profile:         ()               => Api.get('/parent/profile'),
    updateProfile:   (data)           => Api.patch('/parent/profile', data),
  };

  /* ── Institute ── */
  Api.institute = {
    dashboard:       ()               => Api.get('/institute/dashboard'),
    profile:         ()               => Api.get('/institute/profile'),
    updateProfile:   (data)           => Api.put('/institute/profile', data),
    uploadLogo:      (f, onProg)      => Api.upload('/institute/logo', f, { onProgress: onProg }),
    students:        (params)         => Api.get('/institute/students', params),
    student:         (id)             => Api.get('/institute/students/' + id),
    addStudent:      (data)           => Api.post('/institute/students', data),
    updateStudent:   (id, data)       => Api.put('/institute/students/' + id, data),
    deleteStudent:   (id)             => Api.delete('/institute/students/' + id),
    importStudents:  (f, onProg)      => Api.upload('/institute/students/import', f, { onProgress: onProg }),
    teachers:        (params)         => Api.get('/institute/teachers', params),
    teacher:         (id)             => Api.get('/institute/teachers/' + id),
    addTeacher:      (data)           => Api.post('/institute/teachers', data),
    updateTeacher:   (id, data)       => Api.put('/institute/teachers/' + id, data),
    deleteTeacher:   (id)             => Api.delete('/institute/teachers/' + id),
    classes:         (params)         => Api.get('/institute/classes', params),
    createClass:     (data)           => Api.post('/institute/classes', data),
    updateClass:     (id, data)       => Api.put('/institute/classes/' + id, data),
    deleteClass:     (id)             => Api.delete('/institute/classes/' + id),
    timetable:       (params)         => Api.get('/institute/timetable', params),
    saveTimetable:   (data)           => Api.post('/institute/timetable', data),
    attendance:      (params)         => Api.get('/institute/attendance', params),
    markAttendance:  (data)           => Api.post('/institute/attendance', data),
    exams:           (params)         => Api.get('/institute/exams', params),
    createExam:      (data)           => Api.post('/institute/exams', data),
    updateExam:      (id, data)       => Api.put('/institute/exams/' + id, data),
    deleteExam:      (id)             => Api.delete('/institute/exams/' + id),
    results:         (params)         => Api.get('/institute/results', params),
    uploadResults:   (f, onProg)      => Api.upload('/institute/results/import', f, { onProgress: onProg }),
    fees:            (params)         => Api.get('/institute/fees', params),
    createFeeRecord: (data)           => Api.post('/institute/fees', data),
    content:         (params)         => Api.get('/institute/content', params),
    uploadContent:   (f, onProg)      => Api.upload('/institute/content', f, { onProgress: onProg }),
    deleteContent:   (id)             => Api.delete('/institute/content/' + id),
    announcements:   (params)         => Api.get('/institute/announcements', params),
    createAnnounce:  (data)           => Api.post('/institute/announcements', data),
    reports:         (type, params)   => Api.get('/institute/reports/' + type, params),
    certificates:    (params)         => Api.get('/institute/certificates', params),
    issueCertificate:(data)           => Api.post('/institute/certificates', data),
  };

  /* ── Super Admin ── */
  Api.superadmin = {
    dashboard:       ()               => Api.get('/superadmin/dashboard'),
    institutes:      (params)         => Api.get('/superadmin/institutes', params),
    institute:       (id)             => Api.get('/superadmin/institutes/' + id),
    createInstitute: (data)           => Api.post('/superadmin/institutes', data),
    updateInstitute: (id, data)       => Api.put('/superadmin/institutes/' + id, data),
    toggleInstitute: (id, status)     => Api.patch('/superadmin/institutes/' + id + '/status', { status }),
    deleteInstitute: (id)             => Api.delete('/superadmin/institutes/' + id),
    users:           (params)         => Api.get('/superadmin/users', params),
    user:            (id)             => Api.get('/superadmin/users/' + id),
    createUser:      (data)           => Api.post('/superadmin/users', data),
    updateUser:      (id, data)       => Api.put('/superadmin/users/' + id, data),
    toggleUser:      (id, status)     => Api.patch('/superadmin/users/' + id + '/status', { status }),
    deleteUser:      (id)             => Api.delete('/superadmin/users/' + id),
    courses:         (params)         => Api.get('/superadmin/courses', params),
    toggleCourse:    (id, status)     => Api.patch('/superadmin/courses/' + id + '/status', { status }),
    deleteCourse:    (id)             => Api.delete('/superadmin/courses/' + id),
    revenue:         (params)         => Api.get('/superadmin/revenue', params),
    analytics:       (params)         => Api.get('/superadmin/analytics', params),
    settings:        ()               => Api.get('/superadmin/settings'),
    updateSettings:  (data)           => Api.put('/superadmin/settings', data),
    support:         (params)         => Api.get('/superadmin/support', params),
    replySupport:    (id, data)       => Api.post('/superadmin/support/' + id + '/reply', data),
    closeTicket:     (id)             => Api.patch('/superadmin/support/' + id + '/close'),
    reports:         (type, params)   => Api.get('/superadmin/reports/' + type, params),
    logs:            (params)         => Api.get('/superadmin/logs', params),
  };

  /* ── Courses (public catalog) ── */
  Api.courses = {
    list:            (params)         => Api.get('/courses', params),
    detail:          (id)             => Api.get('/courses/' + id),
    search:          (params)         => Api.get('/courses/search', params),
    categories:      ()               => Api.get('/courses/categories'),
    reviews:         (id, params)     => Api.get('/courses/' + id + '/reviews', params),
    submitReview:    (id, data)       => Api.post('/courses/' + id + '/reviews', data),
  };

  /* ── Quizzes ── */
  Api.quizzes = {
    start:           (id)             => Api.post('/quizzes/' + id + '/start'),
    submit:          (id, data)       => Api.post('/quizzes/' + id + '/submit', data),
    result:          (attemptId)      => Api.get('/quizzes/attempts/' + attemptId),
  };

  /* ── Discussions / Q&A ── */
  Api.discussions = {
    list:            (courseId, p)    => Api.get('/courses/' + courseId + '/discussions', p),
    post:            (courseId, data) => Api.post('/courses/' + courseId + '/discussions', data),
    reply:           (id, data)       => Api.post('/discussions/' + id + '/replies', data),
    like:            (id)             => Api.post('/discussions/' + id + '/like'),
    delete:          (id)             => Api.delete('/discussions/' + id),
  };

  /* ── Notifications ── */
  Api.notifications = {
    list:            (params)         => Api.get('/notifications', params),
    markRead:        (id)             => Api.patch('/notifications/' + id + '/read'),
    markAllRead:     ()               => Api.patch('/notifications/mark-all-read'),
    preferences:     ()               => Api.get('/notifications/preferences'),
    updatePrefs:     (data)           => Api.put('/notifications/preferences', data),
    delete:          (id)             => Api.delete('/notifications/' + id),
  };

  /* ── Payments ── */
  Api.payments = {
    initiate:        (data)           => Api.post('/payments/initiate', data),
    verify:          (data)           => Api.post('/payments/verify', data),
    history:         (params)         => Api.get('/payments/history', params),
    invoice:         (id)             => Api.get('/payments/invoices/' + id),
    refund:          (id, data)       => Api.post('/payments/' + id + '/refund', data),
  };

  /* ── Messages / Chat ── */
  Api.messages = {
    rooms:           ()               => Api.get('/messages/rooms'),
    room:            (id)             => Api.get('/messages/rooms/' + id),
    createRoom:      (data)           => Api.post('/messages/rooms', data),
    messages:        (roomId, params) => Api.get('/messages/rooms/' + roomId + '/messages', params),
    send:            (roomId, data)   => Api.post('/messages/rooms/' + roomId + '/messages', data),
    markRead:        (roomId)         => Api.patch('/messages/rooms/' + roomId + '/read'),
    deleteMessage:   (id)             => Api.delete('/messages/' + id),
    uploadAttachment:(f, onProg)      => Api.upload('/messages/attachment', f, { onProgress: onProg }),
  };

  /* ── Live Sessions ── */
  Api.liveSessions = {
    list:            (params)         => Api.get('/live-sessions', params),
    detail:          (id)             => Api.get('/live-sessions/' + id),
    join:            (id)             => Api.post('/live-sessions/' + id + '/join'),
    leave:           (id)             => Api.post('/live-sessions/' + id + '/leave'),
    token:           (id)             => Api.get('/live-sessions/' + id + '/token'),
    recordings:      (id)             => Api.get('/live-sessions/' + id + '/recordings'),
  };

  /* ── Certificates ── */
  Api.certificates = {
    list:            (params)         => Api.get('/certificates', params),
    detail:          (id)             => Api.get('/certificates/' + id),
    download:        (id)             => Api.get('/certificates/' + id + '/download'),
    verify:          (code)           => Api.get('/certificates/verify/' + code, null, { skipAuth: true }),
  };


  /* ============================================================
     EXPOSE
  ============================================================ */

  Api.ApiError = ApiError;
  global.Api   = Api;

})(window);