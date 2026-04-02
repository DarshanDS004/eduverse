/**
 * EduVerse — Student Dashboard Module
 * js/modules/student/dashboard.js
 * 100% backend-driven. Matches our Node.js + MySQL API exactly.
 */
'use strict';

const StudentDashboard = (() => {

  let _user            = null;
  let _countdownTimer  = null;

  /* ═══════════════════════════ INIT ═══════════════════════════ */
  async function init() {

    // Auth guard
    let token, user;
    try {
      token = localStorage.getItem('ev_token');
      user  = token ? JSON.parse(localStorage.getItem('ev_user')) : null;
    } catch(e) { token = null; user = null; }

    if (!token || !user) {
      window.location.replace('../../pages/auth/login.html');
      return;
    }
    if (user.role !== 'student') {
      window.location.replace('../../pages/errors/403.html');
      return;
    }

    _user = user;
    _renderUser();
    _setGreeting();
    _renderDate();
    _showSkeletons();
    await _loadAll();
  }

  /* ══════════════════════ DATA LOADING ════════════════════════ */
  async function _loadAll() {
    try {
      const res  = await Api.student.dashboard();
      const d    = res && res.data;
      if (!d) throw new Error('No data returned from server.');

      _renderStats(d.stats);
      _renderCourses(d.courses           || []);
      _renderAssignments(d.assignments   || []);
      _renderActivity(d.activity         || []);
      _renderStreak(d.streak             || { count: 0, days: [] });
      _renderLiveSession(d.live_sessions || []);
      _renderNotifications(d.notifications);

    } catch (err) {
      _showError(err);
    }
  }

  /* ══════════════════════ RENDER USER ════════════════════════ */
  function _renderUser() {
    if (!_user) return;
    const name     = _user.name || '';
    const initials = _initials(name);
    const color    = _avatarColor(name);

    _text('welcome-name',      name.split(' ')[0]);
    _text('sidebar-user-name', name);
    _text('navbar-user-name',  name);
    _text('dd-user-name',      name);

    ['sidebar-avatar','navbar-avatar'].forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      if (_user.avatar) {
        el.innerHTML = '<img src="' + _esc(_user.avatar) + '" ' +
          'style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />';
      } else {
        el.textContent = initials;
        el.className   = 'avatar avatar-sm ' + color;
      }
    });
  }

  function _setGreeting() {
    const h = new Date().getHours();
    _text('welcome-greeting',
      h < 12 ? 'Good morning ☀️' :
      h < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙');
  }

  function _renderDate() {
    const el = document.getElementById('navbar-date');
    if (el) {
      el.textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric',
        month: 'long', year: 'numeric',
      });
    }
  }

  /* ══════════════════════ RENDER STATS ═══════════════════════ */
  function _renderStats(stats) {
    if (!stats) return;

    _text('stat-courses',     stats.total_courses       ?? '—');
    _text('stat-assignments', stats.pending_assignments ?? '—');
    _text('stat-attendance',
      stats.attendance_rate != null ? stats.attendance_rate + '%' : '—');
    _text('stat-score',
      stats.avg_score != null ? stats.avg_score + '%' : '—');

    // Assignment badge in sidebar
    const badge = document.getElementById('badge-assignments');
    if (badge && stats.pending_assignments > 0) {
      badge.textContent   = stats.pending_assignments;
      badge.style.display = 'flex';
    }

    // Score delta
    const deltaEl = document.getElementById('stat-score-delta');
    if (deltaEl && stats.avg_score != null) {
      deltaEl.textContent = stats.avg_score >= 75
        ? '▲ Good standing' : '▼ Needs improvement';
      deltaEl.className   = 'stat-delta ' +
        (stats.avg_score >= 75 ? 'delta-up' : 'delta-down');
    }

    // Welcome subtitle
    const subtitleEl = document.getElementById('welcome-subtitle');
    if (subtitleEl) {
      const parts = [];
      if (stats.total_courses > 0)
        parts.push(stats.total_courses + ' course' +
          (stats.total_courses > 1 ? 's' : '') + ' enrolled');
      if (stats.pending_assignments > 0)
        parts.push(stats.pending_assignments + ' assignment' +
          (stats.pending_assignments > 1 ? 's' : '') + ' pending');
      subtitleEl.textContent = parts.length
        ? parts.join(' · ')
        : 'Welcome back! Keep learning today. 🚀';
    }
  }

  /* ══════════════════════ RENDER COURSES ═════════════════════ */
  function _renderCourses(courses) {
    const el = document.getElementById('continue-learning-list');
    if (!el) return;

    if (!courses.length) {
      el.innerHTML = _empty('📚','No courses yet',
        'Browse the catalog to enroll in your first course.');
      return;
    }

    const colors = ['#dbeafe','#d1fae5','#fef3c7','#ede9fe','#fee2e2'];
    const emojis = ['📘','📗','📙','📕','📓'];

    el.innerHTML = courses.slice(0, 4).map(function(c, i) {
      const pct   = Math.round(c.progress || 0);
      const bg    = colors[i % colors.length];
      const emoji = emojis[i % emojis.length];
      const bar   = _barColor(pct);
      const ago   = c.last_activity_at
        ? Utils.timeAgo(c.last_activity_at) : '';

      return '<a class="course-item" href="courses.html" ' +
        'style="text-decoration:none;color:inherit;">' +
        '<div class="course-thumb" style="background:' + bg + ';">' +
          emoji +
        '</div>' +
        '<div class="course-item-info">' +
          '<div class="course-item-subject">' +
            _esc(c.category || c.level || 'Course') +
          '</div>' +
          '<div class="course-item-title">' + _esc(c.title) + '</div>' +
          '<div class="course-item-meta">' +
            '<span>' + _esc(c.instructor_name || 'Instructor') + '</span>' +
            (c.watched_videos != null && c.total_videos
              ? '<span>' + c.watched_videos + '/' + c.total_videos + ' videos</span>'
              : '') +
            (ago ? '<span>' + ago + '</span>' : '') +
          '</div>' +
          '<div class="course-progress-bar">' +
            '<div class="course-progress-fill" ' +
              'style="width:' + pct + '%;background:' + bar + ';"></div>' +
          '</div>' +
        '</div>' +
        '<div class="course-item-pct" style="color:' + bar + ';">' +
          pct + '%' +
        '</div>' +
      '</a>';
    }).join('');
  }

  /* ══════════════════════ RENDER ASSIGNMENTS ═════════════════ */
  function _renderAssignments(assignments) {
    const el = document.getElementById('assignments-list');
    if (!el) return;

    if (!assignments.length) {
      el.innerHTML = _empty('✅','All caught up!',
        'No pending assignments right now.');
      return;
    }

    el.innerHTML = assignments.slice(0, 4).map(function(a) {
      const deadline = a.deadline ? new Date(a.deadline) : null;
      const daysLeft = deadline ? Utils.daysRemaining(deadline) : null;
      const isLate   = deadline && deadline < new Date();
      const urgency  = isLate ? 'due-urgent'
        : daysLeft <= 2 ? 'due-soon' : 'due-later';

      const day   = deadline ? deadline.getDate() : '—';
      const month = deadline
        ? deadline.toLocaleString('en', { month: 'short' }) : '';

      const dueText = isLate ? 'Overdue'
        : daysLeft === 0 ? 'Due today'
        : daysLeft === 1 ? 'Due tomorrow'
        : daysLeft != null ? 'In ' + daysLeft + ' days' : '—';

      return '<div class="assignment-item">' +
        '<div class="assignment-due-badge ' + urgency + '">' +
          '<div class="due-day">'   + day   + '</div>' +
          '<div class="due-month">' + month + '</div>' +
        '</div>' +
        '<div class="assignment-info">' +
          '<div class="assignment-title">' + _esc(a.title) + '</div>' +
          '<div class="assignment-meta">' +
            _esc(a.course_title || '') +
            ' · <span style="color:' +
              (isLate ? 'var(--color-danger)' :
               daysLeft <= 2 ? 'var(--color-warning)' :
               'var(--text-muted)') + ';">' +
              dueText +
            '</span>' +
            (a.max_marks ? ' · ' + a.max_marks + ' marks' : '') +
          '</div>' +
        '</div>' +
        '<span class="assignment-status ' +
          (isLate ? 'status-overdue' : 'status-pending') + '">' +
          (isLate ? 'Overdue' : 'Pending') +
        '</span>' +
      '</div>';
    }).join('');
  }

  /* ══════════════════════ RENDER ACTIVITY ════════════════════ */
  function _renderActivity(activity) {
    const el = document.getElementById('activity-feed');
    if (!el) return;

    if (!activity.length) {
      el.innerHTML = _empty('📋','No activity yet',
        'Start watching a lesson to see your activity here.');
      return;
    }

    el.innerHTML = activity.slice(0, 6).map(function(item) {
      const icon = item.type === 'video_watched' ? '▶️'
        : item.type === 'quiz_completed' ? '✅'
        : item.type === 'assignment_submitted' ? '📝'
        : '📌';

      const text = item.type === 'video_watched'
        ? 'Watched <strong>' + _esc(item.item_title) + '</strong>' +
          (item.course_title ? ' in ' + _esc(item.course_title) : '')
        : item.type === 'quiz_completed'
        ? 'Completed quiz <strong>' + _esc(item.item_title) + '</strong>'
        : item.type === 'assignment_submitted'
        ? 'Submitted <strong>' + _esc(item.item_title) + '</strong>'
        : _esc(item.item_title || '');

      return '<div class="activity-item">' +
        '<div class="activity-dot" ' +
          'style="background:var(--color-primary-50);">' +
          icon +
        '</div>' +
        '<div class="activity-content">' +
          '<div class="activity-text">' + text + '</div>' +
          '<div class="activity-time">' +
            Utils.timeAgo(item.created_at) +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ══════════════════════ RENDER STREAK ══════════════════════ */
  function _renderStreak(streak) {
    const countEl = document.getElementById('streak-count');
    const msgEl   = document.getElementById('streak-msg');
    const daysRow = document.getElementById('streak-days-row');

    if (countEl) countEl.textContent = streak.count || 0;

    if (msgEl) {
      msgEl.textContent = streak.count === 0
        ? 'Start learning today to build your streak! 💪'
        : streak.count >= 7
        ? 'Amazing! ' + streak.count + ' day streak! 🔥'
        : 'Great job! Keep going! ⚡';
    }

    if (daysRow && streak.days && streak.days.length) {
      daysRow.innerHTML = streak.days.map(function(d) {
        const cls = d.today ? 'sd-today' : d.done ? 'sd-done' : 'sd-future';
        const dateStyle = d.today
          ? 'font-size:9px;color:var(--color-primary-600);' +
            'font-weight:600;margin-top:3px;'
          : 'font-size:9px;color:var(--text-muted);margin-top:3px;';
        return '<div style="text-align:center;">' +
          '<div class="streak-day ' + cls + '">' + d.label + '</div>' +
          '<div style="' + dateStyle + '">' + d.date + '</div>' +
        '</div>';
      }).join('');
    }
  }

  /* ══════════════════ RENDER LIVE SESSION ════════════════════ */
  function _renderLiveSession(sessions) {
    const subjectEl    = document.getElementById('live-class-subject');
    const titleEl      = document.getElementById('live-class-title');
    const instructorEl = document.getElementById('live-class-instructor');
    const initialsEl   = document.getElementById('live-instructor-initials');
    const countdownEl  = document.getElementById('live-countdown');
    const joinBtn      = document.getElementById('live-join-btn');

    if (!sessions || !sessions.length) {
      if (subjectEl)    subjectEl.textContent    = 'No upcoming classes';
      if (titleEl)      titleEl.textContent      = 'No live sessions scheduled.';
      if (instructorEl) instructorEl.textContent = '';
      if (countdownEl)  countdownEl.textContent  = '—';
      if (joinBtn)      joinBtn.style.display    = 'none';
      return;
    }

    const s = sessions[0];
    if (subjectEl)    subjectEl.textContent    = s.course_title || 'Live Class';
    if (titleEl)      titleEl.textContent      = s.title;
    if (instructorEl) instructorEl.textContent = s.instructor_name || '';
    if (initialsEl)   initialsEl.textContent   = _initials(s.instructor_name || 'IN');

    if (joinBtn && s.meeting_link) {
      joinBtn.href          = s.meeting_link;
      joinBtn.target        = '_blank';
      joinBtn.style.display = 'flex';
    }

    // Countdown timer
    if (_countdownTimer) clearInterval(_countdownTimer);
    _tick(s.scheduled_at);
    _countdownTimer = setInterval(function() {
      _tick(s.scheduled_at);
    }, 1000);
  }

  function _tick(scheduledAt) {
    const el   = document.getElementById('live-countdown');
    if (!el) return;
    const diff = new Date(scheduledAt) - new Date();
    if (diff <= 0) { el.textContent = 'Starting now!'; return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = h > 0
      ? h + 'h ' + String(m).padStart(2,'0') + 'm'
      : String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  /* ══════════════════ RENDER NOTIFICATIONS ═══════════════════ */
  function _renderNotifications(notifData) {
    if (!notifData) return;

    // Badge
    const badgeEl = document.getElementById('notif-badge');
    if (badgeEl) {
      if (notifData.unread_count > 0) {
        badgeEl.textContent   = notifData.unread_count > 99
          ? '99+' : notifData.unread_count;
        badgeEl.style.display = 'flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    // Panel body
    const panelBody = document.getElementById('notif-panel-body');
    if (!panelBody) return;

    const items = notifData.items || [];
    if (!items.length) {
      panelBody.innerHTML =
        '<div class="notif-panel-empty">' +
        '<div style="font-size:2rem;margin-bottom:8px;">🔔</div>' +
        '<div style="font-size:var(--font-size-sm);font-weight:600;' +
          'color:var(--text-primary);">All caught up!</div>' +
        '<div style="font-size:var(--font-size-xs);color:var(--text-muted);' +
          'margin-top:4px;">No new notifications</div>' +
        '</div>';
      return;
    }

    panelBody.innerHTML = items.map(function(n) {
      return '<div class="notif-item' + (n.is_read ? '' : ' unread') + '" ' +
        'data-id="' + n.id + '" style="cursor:pointer;">' +
        '<div class="notif-icon">🔔</div>' +
        '<div class="notif-body">' +
          '<div class="notif-title">' + _esc(n.title || '') + '</div>' +
          '<div class="notif-text">'  + _esc(n.body  || '') + '</div>' +
          '<div class="notif-time">'  + Utils.timeAgo(n.created_at) + '</div>' +
        '</div>' +
        (!n.is_read ? '<div class="notif-dot"></div>' : '') +
      '</div>';
    }).join('');

    // Mark read on click
    panelBody.querySelectorAll('.notif-item').forEach(function(item) {
      item.addEventListener('click', async function() {
        const id  = item.getAttribute('data-id');
        const dot = item.querySelector('.notif-dot');
        item.classList.remove('unread');
        if (dot) dot.remove();
        try { await Api.notifications.markRead(id); } catch(e) {}
      });
    });
  }

  /* ══════════════════════ SKELETON LOADERS ═══════════════════ */
  function _showSkeletons() {
    const sk = function(w, h) {
      return '<div class="skel" style="height:' + h + 'px;width:' + w +
        ';border-radius:6px;margin-bottom:8px;"></div>';
    };

    [
      ['continue-learning-list',
        sk('100%',54) + sk('100%',54) + sk('100%',54)],
      ['assignments-list',
        sk('100%',44) + sk('100%',44) + sk('85%',44)],
      ['activity-feed',
        sk('100%',36) + sk('100%',36) + sk('100%',36)],
    ].forEach(function(pair) {
      const el = document.getElementById(pair[0]);
      if (el) el.innerHTML = pair[1];
    });

    ['stat-courses','stat-assignments',
     'stat-attendance','stat-score'].forEach(function(id) {
      _text(id, '…');
    });
  }

  /* ══════════════════════ ERROR STATE ════════════════════════ */
  function _showError(err) {
    console.error('[Dashboard]', err);
    const msg = err && err.code === 'NETWORK_ERROR'
      ? '⚠️ Cannot connect to backend. Is the server running?'
      : err && err.status === 401
      ? '⚠️ Session expired. <a href="../../pages/auth/login.html">Sign in again</a>.'
      : '⚠️ Failed to load dashboard. Please refresh.';

    ['continue-learning-list','assignments-list',
     'activity-feed'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.innerHTML =
        '<div style="color:var(--color-danger);font-size:var(--font-size-sm);' +
        'padding:var(--space-4);">' + msg + '</div>';
    });
  }

  /* ══════════════════════ HELPERS ════════════════════════════ */
  function _text(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val == null ? '' : val;
  }

  function _esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _barColor(pct) {
    return pct >= 80 ? '#10b981'
      : pct >= 50 ? '#3b82f6'
      : pct >= 25 ? '#f59e0b'
      : '#9ca3af';
  }

  function _initials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return p.length === 1
      ? p[0].slice(0,2).toUpperCase()
      : (p[0][0] + p[p.length-1][0]).toUpperCase();
  }

  function _avatarColor(name) {
    const c = ['avatar-blue','avatar-green','avatar-amber','avatar-red'];
    if (!name) return c[0];
    let h = 0;
    for (let i = 0; i < name.length; i++)
      h = name.charCodeAt(i) + ((h << 5) - h);
    return c[Math.abs(h) % c.length];
  }

  function _empty(icon, title, text) {
    return '<div style="text-align:center;padding:var(--space-6);' +
      'color:var(--text-muted);">' +
      '<div style="font-size:1.8rem;margin-bottom:var(--space-2);">' +
        icon + '</div>' +
      '<div style="font-size:var(--font-size-sm);font-weight:600;' +
        'color:var(--text-primary);">' + title + '</div>' +
      '<div style="font-size:var(--font-size-xs);margin-top:3px;">' +
        text + '</div>' +
    '</div>';
  }

  function destroy() {
    if (_countdownTimer) clearInterval(_countdownTimer);
  }

  return { init, destroy };

})();