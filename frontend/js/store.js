/**
 * EduVerse — Global State Store
 * store.js
 *
 * Purpose: Lightweight reactive state manager for the entire frontend.
 * No external dependencies — built from scratch.
 *
 * How it works:
 *   - A central state object holds all app-wide data.
 *   - Modules subscribe to specific state keys.
 *   - When state changes via Store.set(), all subscribers for that key fire.
 *   - Every module uses Store — never pass state via globals or DOM attributes.
 *
 * Depends on: utils.js
 * Exposed as: window.Store
 *
 * Author: EduVerse Engineering
 * Last updated: 2025
 */

(function (global) {
  'use strict';

  /* ============================================================
     INTERNAL STATE
     All state is private. External code uses get/set only.
  ============================================================ */

  const _state = {

    /* ── Auth ── */
    auth: {
      isLoggedIn:   false,
      token:        null,
      refreshToken: null,
      expiresAt:    null,
      user:         null,   // { id, name, email, role, avatar, institute_id }
      role:         null,   // 'superadmin' | 'institute' | 'instructor' | 'student' | 'parent'
    },

    /* ── UI ── */
    ui: {
      sidebarCollapsed:  false,
      sidebarOpen:       false,   // mobile only
      notifPanelOpen:    false,
      activeModal:       null,
      theme:             'light', // 'light' | 'dark'
      pageLoading:       false,
      currentPage:       null,
      currentRoute:      null,
    },

    /* ── Notifications ── */
    notifications: {
      items:       [],
      unreadCount: 0,
      loading:     false,
    },

    /* ── Courses ── */
    courses: {
      list:       [],
      current:    null,   // currently open course
      filters:    { level: '', category: '', search: '', page: 1, perPage: 20 },
      pagination: { total: 0, page: 1, totalPages: 1 },
      loading:    false,
    },

    /* ── Video Player ── */
    player: {
      lessonId:       null,
      courseId:       null,
      playing:        false,
      currentTime:    0,
      duration:       0,
      volume:         1,
      muted:          false,
      quality:        'auto',
      playbackRate:   1,
      fullscreen:     false,
      progress:       0,    // percent 0–100
    },

    /* ── Quiz ── */
    quiz: {
      active:       false,
      quizId:       null,
      questions:    [],
      answers:      {},   // { questionId: answerId }
      currentIndex: 0,
      timeLeft:     0,
      submitted:    false,
      result:       null,
    },

    /* ── Assignments ── */
    assignments: {
      list:    [],
      current: null,
      loading: false,
    },

    /* ── Messages / Chat ── */
    chat: {
      rooms:          [],
      activeRoomId:   null,
      messages:       {},   // { roomId: [messages] }
      unreadCount:    0,
      typing:         {},   // { roomId: [userIds typing] }
      loading:        false,
    },

    /* ── Live Session ── */
    liveSession: {
      active:       false,
      sessionId:    null,
      roomId:       null,
      participants: [],
      isHost:       false,
      audioOn:      true,
      videoOn:      true,
      screenShare:  false,
      chat:         [],
      handRaised:   false,
      recording:    false,
    },

    /* ── Attendance ── */
    attendance: {
      records: [],
      summary: null,
      loading: false,
    },

    /* ── Calendar ── */
    calendar: {
      events:        [],
      selectedDate:  null,
      viewMode:      'month',  // 'month' | 'week' | 'day'
      loading:       false,
    },

    /* ── Student (dashboard-specific) ── */
    student: {
      enrolledCourses:  [],
      recentActivity:   [],
      performance:      null,
      certificates:     [],
      loading:          false,
    },

    /* ── Instructor (dashboard-specific) ── */
    instructor: {
      myCourses:    [],
      myStudents:   [],
      earnings:     null,
      analytics:    null,
      loading:      false,
    },

    /* ── Institute (dashboard-specific) ── */
    institute: {
      stats:    null,
      teachers: [],
      students: [],
      classes:  [],
      loading:  false,
    },

    /* ── Parent (dashboard-specific) ── */
    parent: {
      children:    [],
      activeChild: null,
      loading:     false,
    },

    /* ── Super Admin (dashboard-specific) ── */
    superadmin: {
      stats:      null,
      institutes: [],
      users:      [],
      revenue:    null,
      loading:    false,
    },

    /* ── Upload ── */
    upload: {
      queue:    [],   // [{ id, file, progress, status, url }]
      active:   false,
    },

    /* ── Toast Queue (managed internally by Toast module) ── */
    toasts: [],

  };


  /* ============================================================
     SUBSCRIBER REGISTRY
     Map of key → array of callback functions
  ============================================================ */

  const _subscribers = {};


  /* ============================================================
     INTERNAL HELPERS
  ============================================================ */

  /**
   * Deep clone a value to prevent external mutations of state.
   */
  function _clone(value) {
    if (value === null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return value;
    }
  }

  /**
   * Deep-merge source into target (non-destructive partial update).
   */
  function _merge(target, source) {
    const result = Object.assign({}, target);
    Object.keys(source).forEach(key => {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = _merge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    });
    return result;
  }

  /**
   * Resolve a dot-notation path on an object.
   * 'auth.user.name' → value at state.auth.user.name
   */
  function _resolvePath(obj, path) {
    return path.split('.').reduce((acc, key) => {
      return acc !== undefined && acc !== null ? acc[key] : undefined;
    }, obj);
  }

  /**
   * Set a value at a dot-notation path on an object (mutates obj).
   */
  function _setPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Notify all subscribers for a given top-level key.
   */
  function _notify(topKey, newValue, prevValue) {
    const subs = _subscribers[topKey];
    if (!subs || subs.length === 0) return;
    subs.forEach(function (cb) {
      try {
        cb(_clone(newValue), _clone(prevValue));
      } catch (e) {
        console.error('[Store] Subscriber error on key "' + topKey + '":', e);
      }
    });
    // Also notify wildcard subscribers
    const wildcards = _subscribers['*'];
    if (wildcards) {
      wildcards.forEach(function (cb) {
        try {
          cb(topKey, _clone(newValue), _clone(prevValue));
        } catch (e) {
          console.error('[Store] Wildcard subscriber error:', e);
        }
      });
    }
  }


  /* ============================================================
     PUBLIC API
  ============================================================ */

  const Store = {};

  /**
   * Get a value from the store.
   * Supports dot-notation: Store.get('auth.user.name')
   * Returns a deep clone — external mutations do not affect state.
   */
  Store.get = function (path) {
    if (!path) return _clone(_state);
    return _clone(_resolvePath(_state, path));
  };

  /**
   * Set a value in the store.
   * Supports dot-notation: Store.set('auth.isLoggedIn', true)
   * For nested objects, performs a deep merge (partial update).
   *
   * Store.set('auth', { isLoggedIn: true, user: {...} })
   *   → merges into state.auth, does NOT wipe other auth keys.
   *
   * Store.set('auth.isLoggedIn', true)
   *   → sets only that one leaf key.
   *
   * Notifies all subscribers of the top-level key.
   */
  Store.set = function (path, value) {
    if (!path) return;

    const keys = path.split('.');
    const topKey = keys[0];

    const prevTopValue = _clone(_state[topKey]);

    if (keys.length === 1) {
      // Top-level key: merge if object, replace otherwise
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof _state[topKey] === 'object' &&
        _state[topKey] !== null
      ) {
        _state[topKey] = _merge(_state[topKey], value);
      } else {
        _state[topKey] = value;
      }
    } else {
      // Nested path: set the leaf, then the top key is still the notifier
      _setPath(_state, path, value);
    }

    _notify(topKey, _state[topKey], prevTopValue);
  };

  /**
   * Fully replace a top-level key (no merge).
   * Use when you want to completely overwrite a key's value.
   */
  Store.replace = function (key, value) {
    if (!key || key.includes('.')) {
      console.warn('[Store] replace() only supports top-level keys.');
      return;
    }
    const prev = _clone(_state[key]);
    _state[key] = value;
    _notify(key, _state[key], prev);
  };

  /**
   * Subscribe to changes on a top-level key.
   * Use '*' to subscribe to all changes (receives key as first arg).
   *
   * const unsub = Store.subscribe('auth', (newVal, prevVal) => { ... });
   * unsub(); // to unsubscribe
   */
  Store.subscribe = function (key, callback) {
    if (typeof callback !== 'function') return function () {};
    if (!_subscribers[key]) _subscribers[key] = [];
    _subscribers[key].push(callback);

    // Return unsubscribe function
    return function () {
      _subscribers[key] = _subscribers[key].filter(cb => cb !== callback);
    };
  };

  /**
   * Subscribe and immediately invoke the callback with the current value.
   * Useful for initializing UI that depends on current state.
   */
  Store.watch = function (key, callback) {
    if (typeof callback !== 'function') return function () {};
    callback(_clone(_resolvePath(_state, key)));
    return Store.subscribe(key.split('.')[0], callback);
  };

  /**
   * Reset a top-level key back to its initial empty/null state.
   * Useful on logout or page teardown.
   */
  Store.reset = function (key) {
    const defaults = {
      auth: {
        isLoggedIn: false, token: null, refreshToken: null,
        expiresAt: null, user: null, role: null,
      },
      ui: {
        sidebarCollapsed: false, sidebarOpen: false,
        notifPanelOpen: false, activeModal: null,
        theme: 'light', pageLoading: false,
        currentPage: null, currentRoute: null,
      },
      notifications: { items: [], unreadCount: 0, loading: false },
      courses: {
        list: [], current: null,
        filters: { level: '', category: '', search: '', page: 1, perPage: 20 },
        pagination: { total: 0, page: 1, totalPages: 1 },
        loading: false,
      },
      player: {
        lessonId: null, courseId: null, playing: false,
        currentTime: 0, duration: 0, volume: 1, muted: false,
        quality: 'auto', playbackRate: 1, fullscreen: false, progress: 0,
      },
      quiz: {
        active: false, quizId: null, questions: [], answers: {},
        currentIndex: 0, timeLeft: 0, submitted: false, result: null,
      },
      assignments: { list: [], current: null, loading: false },
      chat: {
        rooms: [], activeRoomId: null, messages: {},
        unreadCount: 0, typing: {}, loading: false,
      },
      liveSession: {
        active: false, sessionId: null, roomId: null,
        participants: [], isHost: false, audioOn: true,
        videoOn: true, screenShare: false, chat: [],
        handRaised: false, recording: false,
      },
      attendance: { records: [], summary: null, loading: false },
      calendar: { events: [], selectedDate: null, viewMode: 'month', loading: false },
      student: { enrolledCourses: [], recentActivity: [], performance: null, certificates: [], loading: false },
      instructor: { myCourses: [], myStudents: [], earnings: null, analytics: null, loading: false },
      institute: { stats: null, teachers: [], students: [], classes: [], loading: false },
      parent: { children: [], activeChild: null, loading: false },
      superadmin: { stats: null, institutes: [], users: [], revenue: null, loading: false },
      upload: { queue: [], active: false },
      toasts: [],
    };

    if (key) {
      if (defaults[key] !== undefined) {
        Store.replace(key, _clone(defaults[key]));
      }
    } else {
      // Reset all keys
      Object.keys(defaults).forEach(k => Store.replace(k, _clone(defaults[k])));
    }
  };

  /**
   * Reset all state except UI theme preference (persists across logout).
   * Called on logout.
   */
  Store.resetOnLogout = function () {
    const theme = Store.get('ui.theme');
    Store.reset();
    Store.set('ui.theme', theme);
  };


  /* ============================================================
     CONVENIENCE SETTERS
     Commonly used patterns — keeps calling code clean
  ============================================================ */

  /**
   * Save auth data after login.
   */
  Store.setAuth = function (user, token, refreshToken, expiresAt) {
    Store.set('auth', {
      isLoggedIn:   true,
      token:        token,
      refreshToken: refreshToken,
      expiresAt:    expiresAt,
      user:         user,
      role:         user ? user.role : null,
    });
    // Persist token to storage
    if (global.Utils) {
      global.Utils.storage.set('ev_token', token);
      global.Utils.storage.set('ev_refresh_token', refreshToken);
      global.Utils.storage.set('ev_user', user);
    }
  };

  /**
   * Clear auth data on logout.
   */
  Store.clearAuth = function () {
    Store.resetOnLogout();
    if (global.Utils) {
      global.Utils.storage.remove('ev_token');
      global.Utils.storage.remove('ev_refresh_token');
      global.Utils.storage.remove('ev_user');
    }
  };

  /**
   * Restore auth from localStorage on page load.
   * Called once during app init (router.js / auth.js).
   */
  Store.restoreAuth = function () {
    if (!global.Utils) return false;
    const token   = global.Utils.storage.get('ev_token');
    const refresh = global.Utils.storage.get('ev_refresh_token');
    const user    = global.Utils.storage.get('ev_user');

    if (token && user) {
      Store.set('auth', {
        isLoggedIn:   true,
        token:        token,
        refreshToken: refresh || null,
        expiresAt:    null,
        user:         user,
        role:         user.role,
      });
      return true;
    }
    return false;
  };

  /**
   * Set the page loading state (shows/hides global spinner).
   */
  Store.setLoading = function (loading) {
    Store.set('ui.pageLoading', loading);
    if (global.Utils) {
      if (loading) global.Utils.showPageLoader();
      else global.Utils.hidePageLoader();
    }
  };

  /**
   * Update the active route info.
   */
  Store.setRoute = function (routeName, pageTitle) {
    Store.set('ui', { currentRoute: routeName, currentPage: pageTitle });
  };

  /**
   * Add a toast to the queue.
   * Toast module reads this and renders.
   */
  Store.addToast = function (type, title, message, duration) {
    const toast = {
      id:       (global.Utils ? global.Utils.randomId(6) : Math.random().toString(36).slice(2)),
      type:     type || 'info',    // 'success' | 'error' | 'warning' | 'info'
      title:    title || '',
      message:  message || '',
      duration: duration || 4000,
      ts:       Date.now(),
    };
    const current = _clone(_state.toasts);
    current.push(toast);
    Store.replace('toasts', current);
    return toast.id;
  };

  /**
   * Remove a toast from the queue by id.
   */
  Store.removeToast = function (id) {
    const updated = _state.toasts.filter(t => t.id !== id);
    Store.replace('toasts', updated);
  };

  /**
   * Update notification unread count.
   */
  Store.setUnreadNotifications = function (count) {
    Store.set('notifications.unreadCount', count);
  };

  /**
   * Prepend a new notification (from socket).
   */
  Store.addNotification = function (notif) {
    const items = _clone(_state.notifications.items);
    items.unshift(notif);
    Store.set('notifications', {
      items: items,
      unreadCount: _state.notifications.unreadCount + 1,
    });
  };

  /**
   * Append messages to a chat room.
   */
  Store.addChatMessage = function (roomId, message) {
    const messages = _clone(_state.chat.messages);
    if (!messages[roomId]) messages[roomId] = [];
    messages[roomId].push(message);
    Store.set('chat.messages', messages);
  };

  /**
   * Update a live session participant list.
   */
  Store.setParticipants = function (participants) {
    Store.set('liveSession.participants', participants);
  };

  /**
   * Update an upload item in the queue (by id).
   */
  Store.updateUpload = function (id, updates) {
    const queue = _state.upload.queue.map(item => {
      return item.id === id ? Object.assign({}, item, updates) : item;
    });
    Store.set('upload.queue', queue);
  };

  /**
   * Add an item to the upload queue.
   */
  Store.addUpload = function (uploadItem) {
    const queue = _clone(_state.upload.queue);
    queue.push(uploadItem);
    Store.set('upload', { queue: queue, active: true });
  };


  /* ============================================================
     DEVTOOLS (non-production)
     Attach to window for browser console inspection.
  ============================================================ */

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    global.__EV_STORE__ = {
      state:       _state,
      subscribers: _subscribers,
      get:         Store.get,
      set:         Store.set,
    };
  }


  /* ============================================================
     EXPOSE
  ============================================================ */

  global.Store = Store;

})(window);
