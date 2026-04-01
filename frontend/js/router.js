/**
 * EduVerse — Client-Side Router
 * router.js
 *
 * Purpose: Manages all page navigation, role-based access control,
 * browser history, and page lifecycle hooks for the entire frontend.
 *
 * How it works:
 *   - Every page registers itself with a route name and required role.
 *   - Router.navigate(routeName) handles permission checks, then loads the page.
 *   - Browser back/forward buttons work via popstate.
 *   - All sidebar links and nav links use data-route attributes — no href juggling.
 *
 * Depends on: utils.js, store.js
 * Exposed as: window.Router
 *
 * Author: EduVerse Engineering
 * Last updated: 2025
 */

(function (global) {
  'use strict';

  /* ============================================================
     ROUTE REGISTRY
     Every route in the platform defined in one place.

     Structure:
       key:      unique route identifier used in data-route attrs
       path:     HTML file path relative to /frontend
       title:    Browser tab title
       role:     Required role(s) — null means public
       layout:   'app' (sidebar+navbar) | 'auth' | 'landing' | 'blank'
       redirect: Route to go to after successful auth (for auth pages)
  ============================================================ */

  const ROUTES = {

    /* ── Public / Landing ── */
    'home': {
      path:    '/index.html',
      title:   'EduVerse — Every Stage. Every Learner.',
      role:    null,
      layout:  'landing',
    },

    /* ── Auth ── */
    'login': {
      path:    '/pages/auth/login.html',
      title:   'Sign In — EduVerse',
      role:    null,
      layout:  'auth',
      redirect: null,   // resolved at runtime from role
    },
    'register': {
      path:    '/pages/auth/register.html',
      title:   'Create Account — EduVerse',
      role:    null,
      layout:  'auth',
    },
    'forgot-password': {
      path:    '/pages/auth/forgot-password.html',
      title:   'Forgot Password — EduVerse',
      role:    null,
      layout:  'auth',
    },
    'reset-password': {
      path:    '/pages/auth/reset-password.html',
      title:   'Reset Password — EduVerse',
      role:    null,
      layout:  'auth',
    },
    'verify-email': {
      path:    '/pages/auth/verify-email.html',
      title:   'Verify Email — EduVerse',
      role:    null,
      layout:  'auth',
    },

    /* ── Student ── */
    'student.dashboard': {
      path:    '/pages/student/dashboard.html',
      title:   'My Dashboard — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.courses': {
      path:    '/pages/student/courses.html',
      title:   'My Courses — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.player': {
      path:    '/pages/student/player.html',
      title:   'Watch Lesson — EduVerse',
      role:    ['student'],
      layout:  'blank',
    },
    'student.quiz': {
      path:    '/pages/student/quiz.html',
      title:   'Quiz — EduVerse',
      role:    ['student'],
      layout:  'blank',
    },
    'student.assignments': {
      path:    '/pages/student/assignments.html',
      title:   'Assignments — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.performance': {
      path:    '/pages/student/performance.html',
      title:   'My Performance — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.certificates': {
      path:    '/pages/student/certificates.html',
      title:   'Certificates — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.messages': {
      path:    '/pages/student/messages.html',
      title:   'Messages — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.calendar': {
      path:    '/pages/student/calendar.html',
      title:   'Calendar — EduVerse',
      role:    ['student'],
      layout:  'app',
    },
    'student.profile': {
      path:    '/pages/student/profile.html',
      title:   'My Profile — EduVerse',
      role:    ['student'],
      layout:  'app',
    },

    /* ── Instructor ── */
    'instructor.dashboard': {
      path:    '/pages/instructor/dashboard.html',
      title:   'Instructor Dashboard — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.courses': {
      path:    '/pages/instructor/courses.html',
      title:   'My Courses — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.course-builder': {
      path:    '/pages/instructor/course-builder.html',
      title:   'Course Builder — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.students': {
      path:    '/pages/instructor/students.html',
      title:   'My Students — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.assessments': {
      path:    '/pages/instructor/assessments.html',
      title:   'Assessments — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.live-sessions': {
      path:    '/pages/instructor/live-sessions.html',
      title:   'Live Sessions — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.analytics': {
      path:    '/pages/instructor/analytics.html',
      title:   'Analytics — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.earnings': {
      path:    '/pages/instructor/earnings.html',
      title:   'Earnings — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.messages': {
      path:    '/pages/instructor/messages.html',
      title:   'Messages — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },
    'instructor.profile': {
      path:    '/pages/instructor/profile.html',
      title:   'My Profile — EduVerse',
      role:    ['instructor'],
      layout:  'app',
    },

    /* ── Parent ── */
    'parent.dashboard': {
      path:    '/pages/parent/dashboard.html',
      title:   'Parent Dashboard — EduVerse',
      role:    ['parent'],
      layout:  'app',
    },
    'parent.performance': {
      path:    '/pages/parent/performance.html',
      title:   "Child's Performance — EduVerse",
      role:    ['parent'],
      layout:  'app',
    },
    'parent.attendance': {
      path:    '/pages/parent/attendance.html',
      title:   'Attendance — EduVerse',
      role:    ['parent'],
      layout:  'app',
    },
    'parent.messages': {
      path:    '/pages/parent/messages.html',
      title:   'Messages — EduVerse',
      role:    ['parent'],
      layout:  'app',
    },
    'parent.payments': {
      path:    '/pages/parent/payments.html',
      title:   'Payments — EduVerse',
      role:    ['parent'],
      layout:  'app',
    },
    'parent.meetings': {
      path:    '/pages/parent/meetings.html',
      title:   'Meetings — EduVerse',
      role:    ['parent'],
      layout:  'app',
    },
    'parent.profile': {
      path:    '/pages/parent/profile.html',
      title:   'My Profile — EduVerse',
      role:    ['parent'],
      layout:  'app',
    },

    /* ── Institute ── */
    'institute.dashboard': {
      path:    '/pages/institute/dashboard.html',
      title:   'Institute Dashboard — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.students': {
      path:    '/pages/institute/students.html',
      title:   'Students — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.teachers': {
      path:    '/pages/institute/teachers.html',
      title:   'Teachers — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.classes': {
      path:    '/pages/institute/classes.html',
      title:   'Classes — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.timetable': {
      path:    '/pages/institute/timetable.html',
      title:   'Timetable — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.attendance': {
      path:    '/pages/institute/attendance.html',
      title:   'Attendance — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.exams': {
      path:    '/pages/institute/exams.html',
      title:   'Exams — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.results': {
      path:    '/pages/institute/results.html',
      title:   'Results — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.fees': {
      path:    '/pages/institute/fees.html',
      title:   'Fee Management — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.content': {
      path:    '/pages/institute/content.html',
      title:   'Content Library — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.communication': {
      path:    '/pages/institute/communication.html',
      title:   'Communication — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.reports': {
      path:    '/pages/institute/reports.html',
      title:   'Reports — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.certificates': {
      path:    '/pages/institute/certificates.html',
      title:   'Certificates — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },
    'institute.profile': {
      path:    '/pages/institute/profile.html',
      title:   'Institute Profile — EduVerse',
      role:    ['institute'],
      layout:  'app',
    },

    /* ── Super Admin ── */
    'superadmin.dashboard': {
      path:    '/pages/superadmin/dashboard.html',
      title:   'Super Admin — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.institutes': {
      path:    '/pages/superadmin/institutes.html',
      title:   'Institutes — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.instructors': {
      path:    '/pages/superadmin/instructors.html',
      title:   'Instructors — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.users': {
      path:    '/pages/superadmin/users.html',
      title:   'User Management — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.courses': {
      path:    '/pages/superadmin/courses.html',
      title:   'All Courses — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.revenue': {
      path:    '/pages/superadmin/revenue.html',
      title:   'Revenue — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.analytics': {
      path:    '/pages/superadmin/analytics.html',
      title:   'Analytics — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.settings': {
      path:    '/pages/superadmin/settings.html',
      title:   'Settings — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },
    'superadmin.support': {
      path:    '/pages/superadmin/support.html',
      title:   'Support Tickets — EduVerse',
      role:    ['superadmin'],
      layout:  'app',
    },

    /* ── Errors ── */
    '403': {
      path:    '/pages/errors/403.html',
      title:   'Access Denied — EduVerse',
      role:    null,
      layout:  'blank',
    },
    '404': {
      path:    '/pages/errors/404.html',
      title:   'Page Not Found — EduVerse',
      role:    null,
      layout:  'blank',
    },
  };


  /* ============================================================
     ROUTER STATE
  ============================================================ */

  let _currentRoute  = null;
  let _previousRoute = null;
  let _beforeHooks   = [];   // [fn(to, from, next)]
  let _afterHooks    = [];   // [fn(to, from)]


  /* ============================================================
     INTERNAL HELPERS
  ============================================================ */

  /**
   * Resolve the default dashboard route for a given role.
   */
  function _roleDashboard(role) {
    const map = {
      superadmin: 'superadmin.dashboard',
      institute:  'institute.dashboard',
      instructor: 'instructor.dashboard',
      student:    'student.dashboard',
      parent:     'parent.dashboard',
    };
    return map[role] || 'home';
  }

  /**
   * Check whether the current user has access to a route.
   * Returns: 'ok' | 'auth_required' | 'forbidden'
   */
  function _checkAccess(route) {
    if (!route.role) return 'ok';     // public route

    const isLoggedIn = global.Store ? global.Store.get('auth.isLoggedIn') : false;
    if (!isLoggedIn) return 'auth_required';

    const userRole = global.Store ? global.Store.get('auth.role') : null;
    const allowed  = Array.isArray(route.role) ? route.role : [route.role];

    if (allowed.includes(userRole)) return 'ok';
    return 'forbidden';
  }

  /**
   * Update the document title and active sidebar/nav link highlights.
   */
  function _updateUI(routeKey, route) {
    // Browser title
    document.title = route.title || 'EduVerse';

    // Mark active nav items via data-route attribute
    const allNavItems = document.querySelectorAll('[data-route]');
    allNavItems.forEach(function (el) {
      const elRoute = el.getAttribute('data-route');
      if (elRoute === routeKey) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update store
    if (global.Store) {
      global.Store.setRoute(routeKey, route.title);
    }
  }

  /**
   * Run all registered beforeEach hooks in sequence.
   * Each hook receives (to, from, next).
   * Calling next() continues; next(false) aborts; next('routeName') redirects.
   */
  function _runBeforeHooks(to, from) {
    return new Promise(function (resolve) {
      if (_beforeHooks.length === 0) {
        resolve({ proceed: true });
        return;
      }

      let index = 0;

      function runNext(result) {
        if (result === false) {
          resolve({ proceed: false });
          return;
        }
        if (typeof result === 'string') {
          resolve({ proceed: false, redirect: result });
          return;
        }
        if (index >= _beforeHooks.length) {
          resolve({ proceed: true });
          return;
        }
        const hook = _beforeHooks[index++];
        try {
          hook(to, from, runNext);
        } catch (e) {
          console.error('[Router] beforeEach hook error:', e);
          resolve({ proceed: true });
        }
      }

      runNext(undefined);
    });
  }


  /* ============================================================
     PUBLIC ROUTER API
  ============================================================ */

  const Router = {};

  /**
   * Navigate to a route by key.
   * This is the ONLY way to change pages — never use window.location directly.
   *
   * Router.navigate('student.dashboard')
   * Router.navigate('student.player', { lessonId: 42 })
   */
  Router.navigate = async function (routeKey, params) {
    const route = ROUTES[routeKey];

    if (!route) {
      console.warn('[Router] Unknown route:', routeKey);
      Router.navigate('404');
      return;
    }

    // Access control check
    const access = _checkAccess(route);

    if (access === 'auth_required') {
      const currentPath = window.location.pathname;
      window.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(currentPath);
      return;
    }

    if (access === 'forbidden') {
      Router.navigate('403');
      return;
    }

    const from = _currentRoute;
    const to   = { key: routeKey, route: route, params: params || {} };

    // Run before hooks
    const hookResult = await _runBeforeHooks(to, from);

    if (!hookResult.proceed) {
      if (hookResult.redirect) {
        Router.navigate(hookResult.redirect);
      }
      return;
    }

    // Store loading state
    if (global.Store) global.Store.setLoading(true);

    _previousRoute = _currentRoute;
    _currentRoute  = to;

    // Build URL with params as query string
    let url = route.path;
    if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      if (qs) url += '?' + qs;
    }

    // Push to browser history
    window.history.pushState({ routeKey: routeKey, params: params || {} }, '', url);

    // Update UI state
    _updateUI(routeKey, route);

    // Navigate to the actual HTML file
    window.location.href = url;

    // After hooks
    _afterHooks.forEach(function (hook) {
      try { hook(to, from); } catch (e) {}
    });
  };

  /**
   * Replace current history entry (no back button entry created).
   * Use after login, after form submission that redirects.
   */
  Router.replace = async function (routeKey, params) {
    const route = ROUTES[routeKey];
    if (!route) { Router.navigate('404'); return; }

    const access = _checkAccess(route);
    if (access === 'auth_required') {
      window.location.replace('/pages/auth/login.html');
      return;
    }
    if (access === 'forbidden') {
      window.location.replace('/pages/errors/403.html');
      return;
    }

    let url = route.path;
    if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params)
        .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
        .join('&');
      url += '?' + qs;
    }

    window.history.replaceState({ routeKey: routeKey, params: params || {} }, '', url);
    _updateUI(routeKey, route);
    window.location.replace(url);
  };

  /**
   * Go back one step in browser history.
   */
  Router.back = function () {
    window.history.back();
  };

  /**
   * Redirect to the correct dashboard for the logged-in user's role.
   * Called after login completes.
   */
  Router.toDashboard = function () {
    const role = global.Store ? global.Store.get('auth.role') : null;
    const routeKey = _roleDashboard(role);
    Router.replace(routeKey);
  };

  /**
   * Redirect to login, optionally preserving the current URL as redirect target.
   */
  Router.toLogin = function (preserveRedirect) {
    let url = '/pages/auth/login.html';
    if (preserveRedirect) {
      url += '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    }
    window.location.replace(url);
  };

  /**
   * Register a beforeEach navigation guard.
   * Called before every navigation. Must call next() to proceed.
   *
   * Router.beforeEach(function(to, from, next) {
   *   if (!someCondition) next(false);
   *   else next();
   * });
   */
  Router.beforeEach = function (fn) {
    if (typeof fn === 'function') _beforeHooks.push(fn);
  };

  /**
   * Register an afterEach hook.
   * Called after navigation completes.
   */
  Router.afterEach = function (fn) {
    if (typeof fn === 'function') _afterHooks.push(fn);
  };

  /**
   * Get the current route object.
   */
  Router.current = function () {
    return _currentRoute;
  };

  /**
   * Get the previous route object.
   */
  Router.previous = function () {
    return _previousRoute;
  };

  /**
   * Get a route definition by key.
   */
  Router.getRoute = function (key) {
    return ROUTES[key] || null;
  };

  /**
   * Get all routes for a given role.
   * Useful for building sidebars dynamically.
   */
  Router.getRoutesForRole = function (role) {
    return Object.entries(ROUTES)
      .filter(function ([, r]) {
        return r.role && (Array.isArray(r.role) ? r.role.includes(role) : r.role === role);
      })
      .map(function ([key, r]) {
        return Object.assign({ key: key }, r);
      });
  };

  /**
   * Check if the current user can access a given route.
   */
  Router.canAccess = function (routeKey) {
    const route = ROUTES[routeKey];
    if (!route) return false;
    return _checkAccess(route) === 'ok';
  };

  /**
   * Determine which route key matches the current page path.
   * Called on page load to identify current route.
   */
  Router.matchCurrent = function () {
    const currentPath = window.location.pathname;
    const match = Object.entries(ROUTES).find(function ([, r]) {
      return r.path === currentPath || currentPath.startsWith(r.path.split('?')[0]);
    });
    return match ? match[0] : null;
  };

  /**
   * Initialize the router on page load.
   * Call once in every page's init script.
   *
   * What it does:
   *   1. Restores auth from localStorage.
   *   2. Identifies current route.
   *   3. Runs access check on current page.
   *   4. Redirects if unauthorized.
   *   5. Sets up popstate listener.
   *   6. Wires data-route link clicks.
   *   7. Returns the current route key (so pages know who they are).
   */
  Router.init = function () {
    // Restore session
    const restored = global.Store ? global.Store.restoreAuth() : false;

    const routeKey = Router.matchCurrent();
    const route    = routeKey ? ROUTES[routeKey] : null;

    if (route) {
      const access = _checkAccess(route);

      if (access === 'auth_required') {
        Router.toLogin(true);
        return null;
      }

      if (access === 'forbidden') {
        window.location.replace('/pages/errors/403.html');
        return null;
      }

      // Auth pages: if already logged in, redirect to dashboard
      if (route.layout === 'auth' && restored) {
        Router.toDashboard();
        return null;
      }

      _currentRoute = { key: routeKey, route: route, params: {} };
      _updateUI(routeKey, route);
    }

    // Handle browser back/forward
    window.addEventListener('popstate', function (e) {
      if (e.state && e.state.routeKey) {
        const r = ROUTES[e.state.routeKey];
        if (r) {
          _updateUI(e.state.routeKey, r);
          _currentRoute = { key: e.state.routeKey, route: r, params: e.state.params || {} };
        }
      }
    });

    // Wire all data-route links
    Router.bindLinks(document);

    return routeKey;
  };

  /**
   * Bind all [data-route] elements in a container to Router.navigate.
   * Call this after injecting new HTML (e.g., sidebar, modal content).
   *
   * <a data-route="student.courses">My Courses</a>
   * <button data-route="student.quiz" data-params='{"quizId":5}'>Start Quiz</button>
   */
  Router.bindLinks = function (container) {
    container = container || document;
    const links = container.querySelectorAll('[data-route]');
    links.forEach(function (el) {
      // Avoid double-binding
      if (el._routerBound) return;
      el._routerBound = true;

      el.addEventListener('click', function (e) {
        e.preventDefault();
        const routeKey = el.getAttribute('data-route');
        let params = {};
        const paramsAttr = el.getAttribute('data-params');
        if (paramsAttr) {
          try { params = JSON.parse(paramsAttr); } catch (err) {}
        }
        Router.navigate(routeKey, params);
      });
    });
  };

  /**
   * Programmatic guard shortcut — verify the current page is
   * accessible on load, or kick the user out.
   *
   * Call at the top of every page's init:
   *   Router.guard(['student']);
   */
  Router.guard = function (allowedRoles) {
    const isLoggedIn = global.Store ? global.Store.get('auth.isLoggedIn') : false;

    if (!isLoggedIn) {
      Router.toLogin(true);
      return false;
    }

    const userRole = global.Store ? global.Store.get('auth.role') : null;
    const allowed  = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!allowed.includes(userRole)) {
      window.location.replace('/pages/errors/403.html');
      return false;
    }

    return true;
  };


  /* ============================================================
     SIDEBAR NAVIGATION CONFIG
     Defines what each role sees in the sidebar.
     Used by sidebar.html component to render nav items.
  ============================================================ */

  Router.SIDEBAR_NAV = {

    student: [
      { label: 'Dashboard',    route: 'student.dashboard',    icon: 'grid'          },
      { label: 'My Courses',   route: 'student.courses',      icon: 'book-open'     },
      { label: 'Assignments',  route: 'student.assignments',  icon: 'clipboard'     },
      { label: 'Performance',  route: 'student.performance',  icon: 'trending-up'   },
      { label: 'Calendar',     route: 'student.calendar',     icon: 'calendar'      },
      { label: 'Messages',     route: 'student.messages',     icon: 'message-circle', badge: 'chat.unreadCount' },
      { label: 'Certificates', route: 'student.certificates', icon: 'award'         },
      { label: 'Profile',      route: 'student.profile',      icon: 'user'          },
    ],

    instructor: [
      { label: 'Dashboard',     route: 'instructor.dashboard',     icon: 'grid'         },
      { label: 'My Courses',    route: 'instructor.courses',       icon: 'book-open'    },
      { label: 'Course Builder',route: 'instructor.course-builder',icon: 'edit-3'       },
      { label: 'Students',      route: 'instructor.students',      icon: 'users'        },
      { label: 'Assessments',   route: 'instructor.assessments',   icon: 'clipboard'    },
      { label: 'Live Sessions', route: 'instructor.live-sessions', icon: 'video'        },
      { label: 'Analytics',     route: 'instructor.analytics',     icon: 'bar-chart-2'  },
      { label: 'Earnings',      route: 'instructor.earnings',      icon: 'dollar-sign'  },
      { label: 'Messages',      route: 'instructor.messages',      icon: 'message-circle', badge: 'chat.unreadCount' },
      { label: 'Profile',       route: 'instructor.profile',       icon: 'user'         },
    ],

    parent: [
      { label: 'Dashboard',    route: 'parent.dashboard',   icon: 'grid'          },
      { label: 'Performance',  route: 'parent.performance', icon: 'trending-up'   },
      { label: 'Attendance',   route: 'parent.attendance',  icon: 'check-square'  },
      { label: 'Payments',     route: 'parent.payments',    icon: 'credit-card'   },
      { label: 'Meetings',     route: 'parent.meetings',    icon: 'calendar'      },
      { label: 'Messages',     route: 'parent.messages',    icon: 'message-circle', badge: 'chat.unreadCount' },
      { label: 'Profile',      route: 'parent.profile',     icon: 'user'          },
    ],

    institute: [
      { label: 'Dashboard',      route: 'institute.dashboard',      icon: 'grid'          },
      { label: 'Students',       route: 'institute.students',       icon: 'users'         },
      { label: 'Teachers',       route: 'institute.teachers',       icon: 'user-check'    },
      { label: 'Classes',        route: 'institute.classes',        icon: 'layers'        },
      { label: 'Timetable',      route: 'institute.timetable',      icon: 'clock'         },
      { label: 'Attendance',     route: 'institute.attendance',     icon: 'check-square'  },
      { label: 'Exams',          route: 'institute.exams',          icon: 'file-text'     },
      { label: 'Results',        route: 'institute.results',        icon: 'bar-chart-2'   },
      { label: 'Fee Management', route: 'institute.fees',           icon: 'credit-card'   },
      { label: 'Content Library',route: 'institute.content',        icon: 'folder'        },
      { label: 'Communication',  route: 'institute.communication',  icon: 'bell'          },
      { label: 'Reports',        route: 'institute.reports',        icon: 'pie-chart'     },
      { label: 'Certificates',   route: 'institute.certificates',   icon: 'award'         },
      { label: 'Profile',        route: 'institute.profile',        icon: 'settings'      },
    ],

    superadmin: [
      { label: 'Dashboard',    route: 'superadmin.dashboard',   icon: 'grid'          },
      { label: 'Institutes',   route: 'superadmin.institutes',  icon: 'home'          },
      { label: 'Instructors',  route: 'superadmin.instructors', icon: 'user-check'    },
      { label: 'Users',        route: 'superadmin.users',       icon: 'users'         },
      { label: 'Courses',      route: 'superadmin.courses',     icon: 'book-open'     },
      { label: 'Revenue',      route: 'superadmin.revenue',     icon: 'dollar-sign'   },
      { label: 'Analytics',    route: 'superadmin.analytics',   icon: 'bar-chart-2'   },
      { label: 'Support',      route: 'superadmin.support',     icon: 'help-circle'   },
      { label: 'Settings',     route: 'superadmin.settings',    icon: 'settings'      },
    ],

  };


  /* ============================================================
     EXPOSE
  ============================================================ */

  global.Router = Router;

})(window);
