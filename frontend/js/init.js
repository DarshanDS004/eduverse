/**
 * EduVerse — Session Initializer
 * Runs immediately on every page — restores auth from localStorage into Store.
 * Must be loaded after auth.js and before any module.
 */
(function () {
  'use strict';

  // Restore theme immediately to prevent flash
  try {
    if (localStorage.getItem('ev_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}

  // Restore auth session into Store memory
  // This must happen before any auth guard runs
  if (typeof Auth !== 'undefined') {
    Auth.init();
  }

})();