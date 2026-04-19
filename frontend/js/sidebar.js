/**
 * EduVerse — Sidebar Manager
 * js/sidebar.js
 *
 * Handles ALL sidebar behavior across every page:
 * - Collapse / expand toggle with localStorage persistence
 * - Mobile open/close via hamburger
 * - Overlay click to close
 * - Correct default state (never starts collapsed unless user chose it on desktop)
 * - User info rendering (name, avatar, initials)
 *
 * HOW TO USE:
 * 1. Include this script on every page after utils.js
 * 2. Call Sidebar.init() inside DOMContentLoaded
 * 3. Call Sidebar.renderUser(user) to populate name/avatar
 *
 * Load order:
 *   <script src="../../js/utils.js"></script>
 *   <script src="../../js/sidebar.js"></script>
 *   ... other scripts ...
 */

'use strict';

const Sidebar = (function () {

  const STORAGE_KEY = 'ev_sidebar_collapsed';

  let _shell    = null;
  let _overlay  = null;
  let _colBtn   = null;
  let _menuBtn  = null;

  /* ──────────────────────────────────────────
     INIT — call once per page in DOMContentLoaded
  ────────────────────────────────────────── */
  function init() {
    _shell   = document.getElementById('app-shell');
    _overlay = document.getElementById('sidebar-overlay');
    _colBtn  = document.getElementById('sidebar-collapse-btn');
    _menuBtn = document.getElementById('navbar-menu-btn');

    if (!_shell) return;

    // ── Restore collapsed state ──
    // Only restore on desktop (>= 1024px). On mobile the sidebar
    // is always hidden by default regardless of localStorage.
    _restoreState();

    // ── Wire collapse toggle button ──
    if (_colBtn) {
      _colBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _toggleCollapse();
      });
    }

    // ── Wire hamburger (mobile) ──
    if (_menuBtn) {
      _menuBtn.addEventListener('click', function () {
        _shell.classList.toggle('sidebar-open');
      });
    }

    // ── Wire overlay click (mobile close) ──
    if (_overlay) {
      _overlay.addEventListener('click', function () {
        _shell.classList.remove('sidebar-open');
      });
    }

    // ── Handle window resize ──
    // If user resizes from mobile to desktop while sidebar-open,
    // clean up mobile classes.
    window.addEventListener('resize', _handleResize);
  }

  /* ──────────────────────────────────────────
     RESTORE STATE
  ────────────────────────────────────────── */
  function _restoreState() {
    const isDesktop = window.innerWidth >= 1024;

    if (isDesktop) {
      // Only collapse on desktop if user explicitly collapsed it before
      const saved = _get();
      if (saved === 'true') {
        _shell.classList.add('sidebar-collapsed');
      } else {
        // Ensure it's expanded (remove any stale class)
        _shell.classList.remove('sidebar-collapsed');
      }
    } else {
      // On mobile/tablet — always start closed, remove collapsed class
      _shell.classList.remove('sidebar-collapsed');
      _shell.classList.remove('sidebar-open');
    }
  }

  /* ──────────────────────────────────────────
     TOGGLE COLLAPSE (desktop)
  ────────────────────────────────────────── */
  function _toggleCollapse() {
    const isNowCollapsed = _shell.classList.toggle('sidebar-collapsed');
    // Save the new state
    _set(String(isNowCollapsed));
  }

  /* ──────────────────────────────────────────
     HANDLE RESIZE
  ────────────────────────────────────────── */
  function _handleResize() {
    if (window.innerWidth >= 1024) {
      // Switched to desktop — close mobile sidebar
      _shell.classList.remove('sidebar-open');
      // Restore desktop collapse state
      const saved = _get();
      if (saved === 'true') {
        _shell.classList.add('sidebar-collapsed');
      } else {
        _shell.classList.remove('sidebar-collapsed');
      }
    } else {
      // Switched to mobile — remove collapsed (irrelevant on mobile)
      _shell.classList.remove('sidebar-collapsed');
    }
  }

  /* ──────────────────────────────────────────
     RENDER USER — populates name, avatar, initials
     across sidebar, navbar, and dropdown
  ────────────────────────────────────────── */
  function renderUser(user) {
    if (!user) return;

    const name   = user.name || '';
    const avatar = user.avatar || null;
    const initials = _getInitials(name);

    // Text elements
    const textIds = [
      'sidebar-user-name',
      'navbar-user-name',
      'dd-user-name',
    ];
    textIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = name;
    });

    // Avatar elements
    const avatarIds = ['sidebar-avatar', 'navbar-avatar'];
    avatarIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (avatar) {
        el.innerHTML = '<img src="' + _esc(avatar) +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />';
      } else {
        el.textContent  = initials;
        el.className    = el.className.replace(/avatar-\w+/g, '').trim();
        el.className   += ' ' + _getAvatarColor(name);
      }
    });
  }

  /* ──────────────────────────────────────────
     THEME TOGGLE — wires all [data-action="toggle-theme"]
  ────────────────────────────────────────── */
  function initTheme() {
    document.querySelectorAll('[data-action="toggle-theme"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const isDark = document.documentElement.classList.toggle('dark');
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        try { localStorage.setItem('ev_theme', isDark ? 'dark' : 'light'); } catch (e) {}
      });
    });
  }

  /* ──────────────────────────────────────────
     LOGOUT — wires all [data-action="logout"]
  ────────────────────────────────────────── */
  function initLogout(loginUrl) {
    loginUrl = loginUrl || '../../pages/auth/login.html';
    document.querySelectorAll('[data-action="logout"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        try {
          localStorage.removeItem('ev_token');
          localStorage.removeItem('ev_user');
          localStorage.removeItem('ev_refresh_token');
        } catch (e) {}
        window.location.replace(loginUrl);
      });
    });
  }

  /* ──────────────────────────────────────────
     DROPDOWN (navbar user dropdown)
  ────────────────────────────────────────── */
  function initDropdown() {
    const trigger  = document.getElementById('navbar-user-trigger');
    const dropdown = document.getElementById('user-dropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.hidden = !dropdown.hidden;
    });

    document.addEventListener('click', function (e) {
      if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.hidden = true;
      }
    });

    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dropdown.hidden = true;
    });
  }

  /* ──────────────────────────────────────────
     NOTIFICATION PANEL
  ────────────────────────────────────────── */
  function initNotifPanel() {
    const btn   = document.querySelector('[data-action="toggle-notif"]');
    const panel = document.getElementById('notif-panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.toggle('open');
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  }

  /* ──────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────── */
  function _get() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function _set(val) {
    try { localStorage.setItem(STORAGE_KEY, val); } catch (e) {}
  }

  function _getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function _getAvatarColor(name) {
    const colors = ['avatar-blue', 'avatar-green', 'avatar-amber', 'avatar-red'];
    if (!name) return colors[0];
    let h = 0;
    for (let i = 0; i < name.length; i++) {
      h = name.charCodeAt(i) + ((h << 5) - h);
    }
    return colors[Math.abs(h) % colors.length];
  }

  function _esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ──────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────── */
  return {
    init,
    renderUser,
    initTheme,
    initLogout,
    initDropdown,
    initNotifPanel,
  };

})();

// Auto-expose globally
window.Sidebar = Sidebar;
