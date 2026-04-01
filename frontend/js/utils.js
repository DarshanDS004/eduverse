/**
 * EduVerse — Utility Library
 * utils.js
 *
 * Purpose: Every shared helper function used across the entire
 * frontend. Formatters, validators, DOM helpers, date utilities,
 * string helpers, storage wrappers, debounce/throttle.
 *
 * No dependencies — this file loads first, everything else uses it.
 * Exposed as a single global: window.Utils
 *
 * Author: EduVerse Engineering
 * Last updated: 2025
 */

(function (global) {
  'use strict';

  const Utils = {};


  /* ============================================================
     STRING HELPERS
  ============================================================ */

  /**
   * Get initials from a full name.
   * "Ravi Kumar" → "RK"
   * "Priya" → "PR"
   */
  Utils.getInitials = function (name) {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  /**
   * Capitalize the first letter of a string.
   * "hello world" → "Hello world"
   */
  Utils.capitalize = function (str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  /**
   * Title-case a string.
   * "hello world" → "Hello World"
   */
  Utils.titleCase = function (str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  /**
   * Truncate a string to a max length, appending ellipsis.
   * Utils.truncate("Hello World", 7) → "Hello W…"
   */
  Utils.truncate = function (str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '…';
  };

  /**
   * Slugify a string for use in URLs.
   * "Hello World! 2025" → "hello-world-2025"
   */
  Utils.slugify = function (str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  /**
   * Escape HTML special characters to prevent XSS.
   * Always use when inserting user-generated content into DOM via innerHTML.
   */
  Utils.escapeHtml = function (str) {
    if (str === null || str === undefined) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(str).replace(/[&<>"']/g, ch => map[ch]);
  };

  /**
   * Strip all HTML tags from a string.
   * "<p>Hello <b>World</b></p>" → "Hello World"
   */
  Utils.stripHtml = function (str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.innerHTML = str;
    return div.textContent || div.innerText || '';
  };

  /**
   * Generate a random alphanumeric string of given length.
   * Useful for temp IDs, keys, nonces.
   */
  Utils.randomId = function (length) {
    length = length || 8;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Highlight search term within a text string.
   * Returns HTML string with <mark> tags around matches.
   */
  Utils.highlightMatch = function (text, term) {
    if (!text || !term) return Utils.escapeHtml(text);
    const escaped = Utils.escapeHtml(text);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escapedTerm + ')', 'gi');
    return escaped.replace(regex, '<mark class="highlight">$1</mark>');
  };


  /* ============================================================
     NUMBER & CURRENCY HELPERS
  ============================================================ */

  /**
   * Format a number with commas.
   * 1234567 → "1,234,567"
   */
  Utils.formatNumber = function (num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-IN');
  };

  /**
   * Format a number in compact form.
   * 1500 → "1.5K", 1200000 → "1.2M"
   */
  Utils.formatCompact = function (num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    num = Number(num);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(num);
  };

  /**
   * Format currency in INR by default.
   * 4999 → "₹4,999"
   * Pass currency = 'USD' for "$4,999.00"
   */
  Utils.formatCurrency = function (amount, currency) {
    if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
    currency = currency || 'INR';
    const options = {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: currency === 'INR' ? 0 : 2,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    };
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', options).format(Number(amount));
  };

  /**
   * Format bytes into human-readable size.
   * 1048576 → "1 MB"
   */
  Utils.formatBytes = function (bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + units[i];
  };

  /**
   * Clamp a number between min and max.
   */
  Utils.clamp = function (value, min, max) {
    return Math.min(Math.max(value, min), max);
  };

  /**
   * Round to a specific number of decimal places.
   */
  Utils.round = function (value, decimals) {
    decimals = decimals || 0;
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  /**
   * Calculate percentage.
   * Utils.percent(45, 100) → 45
   */
  Utils.percent = function (value, total) {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  };


  /* ============================================================
     DATE & TIME HELPERS
  ============================================================ */

  /**
   * Format a date string or Date object.
   * Default: "15 Jan 2025"
   * Pass format = 'short' for "15/01/25"
   * Pass format = 'time' for "3:45 PM"
   * Pass format = 'datetime' for "15 Jan 2025, 3:45 PM"
   * Pass format = 'input' for "2025-01-15" (for input[type=date])
   */
  Utils.formatDate = function (date, format) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    format = format || 'default';

    if (format === 'input') {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    if (format === 'short') {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    if (format === 'time') {
      return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    if (format === 'datetime') {
      return Utils.formatDate(d, 'default') + ', ' + Utils.formatDate(d, 'time');
    }

    if (format === 'month-year') {
      return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }

    // Default: "15 Jan 2025"
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /**
   * Return a human-readable relative time string.
   * "just now", "5 minutes ago", "2 hours ago", "3 days ago", "15 Jan 2025"
   */
  Utils.timeAgo = function (date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 30) return 'just now';
    if (diffSec < 60) return diffSec + 's ago';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return diffDays + 'd ago';
    return Utils.formatDate(d);
  };

  /**
   * Format video/audio duration from seconds.
   * 3661 → "1:01:01"
   * 125 → "2:05"
   */
  Utils.formatDuration = function (totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
    totalSeconds = Math.floor(totalSeconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) {
      return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return m + ':' + String(s).padStart(2, '0');
  };

  /**
   * Format duration in a readable way.
   * 3661 → "1h 1m"
   * 125 → "2m 5s"
   */
  Utils.formatDurationReadable = function (totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return '0m';
    totalSeconds = Math.floor(totalSeconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    if (h > 0) return h + 'h ' + (m > 0 ? m + 'm' : '');
    if (m > 0) return m + 'm ' + (s > 0 ? s + 's' : '');
    return s + 's';
  };

  /**
   * Check if a date is today.
   */
  Utils.isToday = function (date) {
    const d = date instanceof Date ? date : new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  /**
   * Check if a date is in the past.
   */
  Utils.isPast = function (date) {
    const d = date instanceof Date ? date : new Date(date);
    return d < new Date();
  };

  /**
   * Check if a date is in the future.
   */
  Utils.isFuture = function (date) {
    const d = date instanceof Date ? date : new Date(date);
    return d > new Date();
  };

  /**
   * Get days remaining from now until a date.
   * Returns 0 if date is in the past.
   */
  Utils.daysRemaining = function (date) {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diff = d - now;
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };


  /* ============================================================
     VALIDATION HELPERS
  ============================================================ */

  /**
   * Validate email address format.
   */
  Utils.isValidEmail = function (email) {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).trim());
  };

  /**
   * Validate Indian or international phone number.
   * Accepts: 10-digit Indian, +91 prefix, international formats.
   */
  Utils.isValidPhone = function (phone) {
    if (!phone) return false;
    const cleaned = String(phone).replace(/[\s\-().+]/g, '');
    return /^\d{10,15}$/.test(cleaned);
  };

  /**
   * Validate password strength.
   * Returns { valid: bool, message: string }
   * Rules: min 8 chars, 1 uppercase, 1 lowercase, 1 number
   */
  Utils.validatePassword = function (password) {
    if (!password) return { valid: false, message: 'Password is required.' };
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters.' };
    if (!/[A-Z]/.test(password)) return { valid: false, message: 'Include at least one uppercase letter.' };
    if (!/[a-z]/.test(password)) return { valid: false, message: 'Include at least one lowercase letter.' };
    if (!/[0-9]/.test(password)) return { valid: false, message: 'Include at least one number.' };
    return { valid: true, message: 'Password is strong.' };
  };

  /**
   * Check if a string is empty or whitespace only.
   */
  Utils.isEmpty = function (value) {
    if (value === null || value === undefined) return true;
    return String(value).trim().length === 0;
  };

  /**
   * Check if a value is a valid URL.
   */
  Utils.isValidUrl = function (url) {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  /**
   * Validate file type against allowed types.
   * Utils.isAllowedFileType(file, ['pdf', 'docx', 'jpg'])
   */
  Utils.isAllowedFileType = function (file, allowedExtensions) {
    if (!file || !allowedExtensions) return false;
    const ext = file.name.split('.').pop().toLowerCase();
    return allowedExtensions.map(e => e.toLowerCase()).includes(ext);
  };

  /**
   * Validate file size against max size in MB.
   */
  Utils.isFileSizeOk = function (file, maxMB) {
    if (!file || !maxMB) return false;
    return file.size <= maxMB * 1024 * 1024;
  };


  /* ============================================================
     DOM HELPERS
  ============================================================ */

  /**
   * Select a single DOM element.
   * Shorthand for document.querySelector.
   */
  Utils.qs = function (selector, parent) {
    return (parent || document).querySelector(selector);
  };

  /**
   * Select all matching DOM elements.
   * Returns Array (not NodeList).
   */
  Utils.qsa = function (selector, parent) {
    return Array.from((parent || document).querySelectorAll(selector));
  };

  /**
   * Create a DOM element with optional properties.
   * Utils.createElement('div', { className: 'card', id: 'main' }, 'Hello')
   */
  Utils.createElement = function (tag, props, textContent) {
    const el = document.createElement(tag);
    if (props) Object.assign(el, props);
    if (textContent !== undefined) el.textContent = textContent;
    return el;
  };

  /**
   * Add one or more CSS classes to an element.
   */
  Utils.addClass = function (el, ...classes) {
    if (!el) return;
    el.classList.add(...classes.filter(Boolean));
  };

  /**
   * Remove one or more CSS classes from an element.
   */
  Utils.removeClass = function (el, ...classes) {
    if (!el) return;
    el.classList.remove(...classes.filter(Boolean));
  };

  /**
   * Toggle a CSS class on an element.
   */
  Utils.toggleClass = function (el, className, force) {
    if (!el) return;
    if (force !== undefined) {
      el.classList.toggle(className, force);
    } else {
      el.classList.toggle(className);
    }
  };

  /**
   * Show a hidden element (removes 'hidden' class, sets display).
   */
  Utils.show = function (el, display) {
    if (!el) return;
    el.style.display = display || '';
    el.removeAttribute('hidden');
    el.classList.remove('hidden');
  };

  /**
   * Hide an element.
   */
  Utils.hide = function (el) {
    if (!el) return;
    el.style.display = 'none';
  };

  /**
   * Set inner HTML safely after escaping, or use raw HTML if trusted.
   * Use setHtml for trusted/controlled content (no user input).
   * Use setText for user-generated content.
   */
  Utils.setHtml = function (el, html) {
    if (!el) return;
    el.innerHTML = html;
  };

  Utils.setText = function (el, text) {
    if (!el) return;
    el.textContent = text;
  };

  /**
   * Scroll an element into view smoothly.
   */
  Utils.scrollIntoView = function (el, behavior) {
    if (!el) return;
    el.scrollIntoView({ behavior: behavior || 'smooth', block: 'nearest' });
  };

  /**
   * Scroll to the top of the page or a container.
   */
  Utils.scrollToTop = function (el, behavior) {
    const target = el || window;
    target.scrollTo({ top: 0, behavior: behavior || 'smooth' });
  };

  /**
   * Get the value of a form field by its selector.
   */
  Utils.getFieldValue = function (selector, parent) {
    const el = Utils.qs(selector, parent);
    if (!el) return '';
    return el.value.trim();
  };

  /**
   * Set the value of a form field.
   */
  Utils.setFieldValue = function (selector, value, parent) {
    const el = Utils.qs(selector, parent);
    if (el) el.value = value !== null && value !== undefined ? value : '';
  };

  /**
   * Clear all form fields in a container.
   */
  Utils.clearForm = function (formEl) {
    if (!formEl) return;
    const fields = formEl.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = false;
      } else {
        field.value = '';
      }
    });
  };

  /**
   * Serialize a form into a plain object.
   * Skips empty fields and buttons.
   */
  Utils.serializeForm = function (formEl) {
    if (!formEl) return {};
    const data = {};
    const fields = formEl.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      if (!field.name || field.type === 'button' || field.type === 'submit') return;
      if (field.type === 'checkbox') {
        data[field.name] = field.checked;
      } else if (field.type === 'radio') {
        if (field.checked) data[field.name] = field.value;
      } else {
        if (field.value.trim() !== '') data[field.name] = field.value.trim();
      }
    });
    return data;
  };

  /**
   * Show a field error message.
   * Looks for a .form-error element after the input.
   */
  Utils.showFieldError = function (inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('input-error');
    let errorEl = inputEl.parentElement.querySelector('.form-error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'form-error';
      inputEl.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
    Utils.show(errorEl);
  };

  /**
   * Clear a field error message.
   */
  Utils.clearFieldError = function (inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('input-error');
    const errorEl = inputEl.parentElement.querySelector('.form-error');
    if (errorEl) Utils.hide(errorEl);
  };


  /* ============================================================
     LOCAL / SESSION STORAGE WRAPPERS
     Safe wrappers — never throw if storage is unavailable
  ============================================================ */

  Utils.storage = {
    /**
     * Set an item in localStorage (serializes objects automatically).
     */
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn('Storage.set failed:', e);
      }
    },

    /**
     * Get an item from localStorage (deserializes automatically).
     */
    get: function (key) {
      try {
        const item = localStorage.getItem(key);
        return item !== null ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Remove an item from localStorage.
     */
    remove: function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    },

    /**
     * Clear all localStorage entries with a specific prefix.
     */
    clearPrefix: function (prefix) {
      try {
        Object.keys(localStorage)
          .filter(key => key.startsWith(prefix))
          .forEach(key => localStorage.removeItem(key));
      } catch (e) {}
    }
  };

  Utils.session = {
    set: function (key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    },
    get: function (key) {
      try {
        const item = sessionStorage.getItem(key);
        return item !== null ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    },
    remove: function (key) {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {}
    },
    clear: function () {
      try {
        sessionStorage.clear();
      } catch (e) {}
    }
  };


  /* ============================================================
     URL & QUERY STRING HELPERS
  ============================================================ */

  /**
   * Parse URL query string into a plain object.
   * "?page=2&q=math" → { page: "2", q: "math" }
   */
  Utils.parseQuery = function (queryString) {
    const params = {};
    const qs = (queryString || window.location.search).replace(/^\?/, '');
    if (!qs) return params;
    qs.split('&').forEach(pair => {
      const [key, val] = pair.split('=').map(decodeURIComponent);
      if (key) params[key] = val || '';
    });
    return params;
  };

  /**
   * Build a query string from a plain object.
   * { page: 2, q: "math" } → "?page=2&q=math"
   */
  Utils.buildQuery = function (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    return qs ? '?' + qs : '';
  };

  /**
   * Get a single query param from the current URL.
   */
  Utils.getParam = function (key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  };

  /**
   * Update query params in the current URL without reload.
   */
  Utils.setParams = function (params) {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        url.searchParams.delete(k);
      } else {
        url.searchParams.set(k, v);
      }
    });
    window.history.replaceState({}, '', url.toString());
  };


  /* ============================================================
     PERFORMANCE HELPERS
  ============================================================ */

  /**
   * Debounce — delay execution until after wait ms since last call.
   * Use for: search input, resize handlers, form autosave.
   */
  Utils.debounce = function (fn, wait) {
    let timer;
    return function () {
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait || 300);
    };
  };

  /**
   * Throttle — execute at most once per wait ms.
   * Use for: scroll handlers, video progress tracking.
   */
  Utils.throttle = function (fn, wait) {
    let last = 0;
    return function () {
      const now = Date.now();
      if (now - last >= (wait || 200)) {
        last = now;
        fn.apply(this, arguments);
      }
    };
  };


  /* ============================================================
     ASYNC HELPERS
  ============================================================ */

  /**
   * Sleep for a given number of milliseconds.
   * Use with async/await: await Utils.sleep(500);
   */
  Utils.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  /**
   * Retry an async function up to maxAttempts times.
   * Useful for network calls that may intermittently fail.
   */
  Utils.retry = function (fn, maxAttempts, delayMs) {
    maxAttempts = maxAttempts || 3;
    delayMs = delayMs || 1000;
    return new Promise(function (resolve, reject) {
      let attempts = 0;
      function attempt() {
        attempts++;
        Promise.resolve()
          .then(fn)
          .then(resolve)
          .catch(function (err) {
            if (attempts >= maxAttempts) {
              reject(err);
            } else {
              setTimeout(attempt, delayMs);
            }
          });
      }
      attempt();
    });
  };


  /* ============================================================
     AVATAR COLOR HELPER
     Assign a consistent avatar color class based on name hash
  ============================================================ */

  /**
   * Get a deterministic avatar color class for a user name.
   * Returns one of: avatar-blue, avatar-green, avatar-amber, avatar-red
   */
  Utils.getAvatarColor = function (name) {
    if (!name) return 'avatar-blue';
    const colors = ['avatar-blue', 'avatar-green', 'avatar-amber', 'avatar-red'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };


  /* ============================================================
     COPY TO CLIPBOARD
  ============================================================ */

  /**
   * Copy a string to the clipboard.
   * Returns a Promise that resolves to true/false.
   */
  Utils.copyToClipboard = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    // Fallback for older browsers
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  };


  /* ============================================================
     DOWNLOAD HELPER
  ============================================================ */

  /**
   * Trigger a file download from a Blob or URL.
   */
  Utils.download = function (url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * Download a string as a text/CSV file.
   */
  Utils.downloadText = function (content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    Utils.download(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };


  /* ============================================================
     DEVICE & BROWSER DETECTION
  ============================================================ */

  /**
   * Check if the user is on a mobile device.
   */
  Utils.isMobile = function () {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  /**
   * Check if the device supports touch.
   */
  Utils.isTouchDevice = function () {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  };

  /**
   * Check if the browser supports a CSS feature.
   */
  Utils.supportsCss = function (property) {
    return property in document.documentElement.style;
  };


  /* ============================================================
     ROLE HELPERS
  ============================================================ */

  /**
   * Map role key to human-readable label.
   */
  Utils.getRoleLabel = function (role) {
    const labels = {
      superadmin: 'Super Admin',
      institute:  'Institute',
      instructor: 'Instructor',
      student:    'Student',
      parent:     'Parent'
    };
    return labels[role] || Utils.titleCase(role || '');
  };

  /**
   * Map education level key to human-readable label.
   */
  Utils.getLevelLabel = function (level) {
    const labels = {
      preschool:  'Pre-School',
      primary:    'Primary School',
      middle:     'Middle School',
      high:       'High School',
      ug:         'Undergraduate',
      pg:         'Postgraduate'
    };
    return labels[level] || Utils.titleCase(level || '');
  };

  /**
   * Get the dashboard URL for a given role.
   */
  Utils.getRoleDashboard = function (role) {
    const dashboards = {
      superadmin: '/pages/superadmin/dashboard.html',
      institute:  '/pages/institute/dashboard.html',
      instructor: '/pages/instructor/dashboard.html',
      student:    '/pages/student/dashboard.html',
      parent:     '/pages/parent/dashboard.html'
    };
    return dashboards[role] || '/';
  };


  /* ============================================================
     EVENT HELPERS
  ============================================================ */

  /**
   * Add an event listener that auto-removes itself after firing once.
   */
  Utils.once = function (el, event, handler) {
    function wrapper(e) {
      handler(e);
      el.removeEventListener(event, wrapper);
    }
    el.addEventListener(event, wrapper);
  };

  /**
   * Delegate event — listen on parent, fire when child matches selector.
   * More performant than attaching listeners to every child element.
   */
  Utils.delegate = function (parent, selector, event, handler) {
    parent.addEventListener(event, function (e) {
      const target = e.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, e);
      }
    });
  };


  /* ============================================================
     LOADING STATE HELPERS
  ============================================================ */

  /**
   * Set a button into loading state.
   * Stores original text so it can be restored later.
   */
  Utils.setButtonLoading = function (btn, loadingText) {
    if (!btn) return;
    btn.dataset.originalText = btn.textContent;
    btn.disabled = true;
    btn.classList.add('loading');
    if (loadingText) btn.textContent = loadingText;
  };

  /**
   * Restore a button from loading state.
   */
  Utils.clearButtonLoading = function (btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove('loading');
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
      delete btn.dataset.originalText;
    }
  };

  /**
   * Show a full-page loading overlay.
   */
  Utils.showPageLoader = function (message) {
    let loader = document.getElementById('ev-page-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'ev-page-loader';
      loader.className = 'page-loader';
      loader.innerHTML = `
        <div class="spinner spinner-lg"></div>
        <div class="page-loader-text" id="ev-page-loader-text"></div>
      `;
      document.body.appendChild(loader);
    }
    const textEl = loader.querySelector('#ev-page-loader-text');
    if (textEl) textEl.textContent = message || 'Loading…';
    Utils.show(loader);
  };

  /**
   * Hide the full-page loading overlay.
   */
  Utils.hidePageLoader = function () {
    const loader = document.getElementById('ev-page-loader');
    if (loader) Utils.hide(loader);
  };


  /* ============================================================
     EXPOSE
  ============================================================ */

  global.Utils = Utils;

})(window);
