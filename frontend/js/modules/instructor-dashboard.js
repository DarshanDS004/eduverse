/**
 * EduVerse — Instructor Dashboard Module
 * js/modules/instructor-dashboard.js
 *
 * Mirrors StudentDashboard pattern exactly.
 * Spec: backend/docs/instructor-dashboard-spec.md
 *
 * API calls:
 *   GET  /api/v1/instructor/dashboard
 *   GET  /api/v1/instructor/earnings/trend?months=N
 *   POST /api/v1/notifications/read-all
 *
 * Real-time:
 *   Socket.io room: instructor:<id>
 *   Events: instructor:new_enrollment, instructor:new_submission,
 *           instructor:new_message, instructor:new_forum_doubt,
 *           notification:new
 *
 * Auto-refresh: every 60 seconds
 */

'use strict';

/* global Api, Store, Utils, Sidebar, feather, io, Chart */

const InstructorDashboard = (function () {

  /* ─── Private state ─── */
  let _user          = null;
  let _socket        = null;
  let _refreshTimer  = null;
  let _chartInstance = null;

  /* ════════════════════════════════════════
     INIT
  ════════════════════════════════════════ */
  async function init() {

    /* Auth guard */
    let token, user;
    try {
      token = localStorage.getItem('ev_token');
      user  = token ? JSON.parse(localStorage.getItem('ev_user')) : null;
    } catch(e) { token = null; user = null; }

    if (!token || !user) {
      window.location.replace('../../pages/auth/login.html');
      return;
    }
    if (user.role !== 'instructor') {
      window.location.replace('../../pages/errors/403.html');
      return;
    }

    _user = user;

    /* Render user info into sidebar / navbar */
    _renderUser();
    _setGreeting();

    /* Load all dashboard data */
    await _loadAll();

    /* Wire period selector for earnings chart */
    var periodSel = document.getElementById('earnings-period');
    if (periodSel) {
      periodSel.addEventListener('change', function () {
        _loadEarningsTrend(parseInt(this.value, 10));
      });
    }

    /* Auto-refresh every 60 seconds */
    _refreshTimer = setInterval(_loadAll, 60000);

    /* Real-time Socket.io */
    _connectSocket();

    /* Feather icons pass */
    _icons();
  }

  /* ════════════════════════════════════════
     DATA LOADING
  ════════════════════════════════════════ */
  async function _loadAll() {
    try {
      var res = await Api.get('/instructor/dashboard');
      var d   = res && res.data;
      if (!d) throw new Error('No data');

      var stats    = d.stats           || {};
      var courses  = d.courses         || [];
      var students = d.recent_students || [];
      var sessions = d.live_sessions   || [];
      var earnings = d.earnings        || {};
      var trend    = d.earnings_trend  || [];

      var pendingGrading = parseInt(d.pending_submissions || 0, 10);
      var unreadMessages = parseInt(d.unread_messages     || 0, 10);
      var forumDoubts    = parseInt(d.unanswered_forum    || 0, 10);

      _renderStats(stats, pendingGrading, unreadMessages, forumDoubts);
      _renderCourses(courses);
      _renderEnrollments(students);
      _renderTasks(pendingGrading, unreadMessages, forumDoubts);
      _renderSessions(sessions);
      _renderEarnings(earnings);
      _renderEarningsChart(trend);
      _renderNotifications(d.notifications);
      _renderProfileStrength(_user);
      _renderBadges(courses, pendingGrading, unreadMessages, sessions);
      _renderWelcomeSubtitle(stats, courses, pendingGrading + unreadMessages + forumDoubts);

      _icons();

    } catch (err) {
      console.error('[InstructorDashboard]', err);
      _showError(err);
    }
  }

  /* ── Earnings trend (period selector) ── */
  async function _loadEarningsTrend(months) {
    try {
      var res  = await Api.get('/instructor/earnings/trend', { months: months });
      var data = (res && res.data) || [];
      _renderEarningsChart(data);
    } catch (err) {
      console.error('[EarningsTrend]', err);
      _renderEarningsChart([]);
    }
  }

  /* ════════════════════════════════════════
     RENDER USER
  ════════════════════════════════════════ */
  function _renderUser() {
    if (!_user) return;

    var name    = _user.name  || '';
    var email   = _user.email || '';
    var initials = _initials(name);
    var color   = _avatarColor(name);

    /* Text fields */
    _text('sidebar-user-name', name);
    _text('navbar-user-name',  name);
    _text('dd-user-name',      name);
    _text('sidebar-user-email', email);
    _text('dd-user-email',     email);

    /* Avatars */
    ['sidebar-avatar','navbar-avatar'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (_user.avatar) {
        el.innerHTML = '<img src="' + _esc(_user.avatar) +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt="Avatar" />';
      } else {
        el.textContent = initials;
        el.className   = 'avatar avatar-sm ' + color;
      }
    });
  }

  function _setGreeting() {
    var h = new Date().getHours();
    _text('welcome-greeting',
      h < 12 ? 'Good morning ☀️' :
      h < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙');
    _text('welcome-name',
      'Hi, ' + ((_user && _user.name || '').split(' ')[0] || 'Instructor') + '!');
  }

  function _renderWelcomeSubtitle(stats, courses, totalPending) {
    var pubCount = courses.filter(function(c) { return c.status === 'published'; }).length;
    var students = parseInt(stats.total_students || 0, 10);
    var parts    = [];

    if (pubCount > 0)
      parts.push(pubCount + ' published course' + (pubCount !== 1 ? 's' : ''));
    if (students > 0)
      parts.push(students.toLocaleString('en-IN') + ' student' + (students !== 1 ? 's' : ''));
    if (totalPending > 0)
      parts.push(totalPending + ' pending task' + (totalPending !== 1 ? 's' : ''));

    _text('welcome-subtitle',
      parts.length ? parts.join(' · ') : 'Ready to inspire your students today!');
  }

  /* ════════════════════════════════════════
     RENDER STATS
  ════════════════════════════════════════ */
  function _renderStats(stats, pendingGrading, unreadMessages, forumDoubts) {
    var totalCourses  = parseInt(stats.total_courses  || 0, 10);
    var totalStudents = parseInt(stats.total_students || 0, 10);
    var totalEarnings = parseFloat(stats.total_earnings || 0);
    var avgRating     = stats.avg_rating ? parseFloat(stats.avg_rating) : null;
    var totalPending  = pendingGrading + unreadMessages + forumDoubts;

    _text('stat-courses',  totalCourses);
    _text('stat-students', totalStudents.toLocaleString('en-IN'));
    _text('stat-earnings', _currency(totalEarnings));
    _text('stat-rating',   avgRating ? avgRating.toFixed(1) : '—');
    _text('stat-pending',  totalPending);

    /* Stars for rating */
    if (avgRating) {
      var stars = Math.round(avgRating);
      _text('stat-rating-stars', '★'.repeat(stars) + '☆'.repeat(5 - stars));
    }

    /* Pending sub-label */
    if (totalPending > 0) {
      _text('stat-pending-sub', totalPending + ' action' + (totalPending !== 1 ? 's' : '') + ' needed');
    } else {
      _text('stat-pending-sub', 'All clear ✓');
    }

    /* Delta badges */
    if (stats.courses_delta  != null) _showDelta('stat-courses-delta',  stats.courses_delta);
    if (stats.students_delta != null) _showDelta('stat-students-delta', stats.students_delta);
    if (stats.earnings_delta != null) _showDelta('stat-earnings-delta', stats.earnings_delta + '%');
  }

  /* ════════════════════════════════════════
     RENDER SIDEBAR BADGES
  ════════════════════════════════════════ */
  function _renderBadges(courses, grading, messages, sessions) {
    _badge('badge-courses',  courses.length);
    _badge('badge-grade',    grading);
    _badge('badge-messages', messages);
    _badge('badge-sessions', sessions.length);
  }

  /* ════════════════════════════════════════
     RENDER COURSE PERFORMANCE
  ════════════════════════════════════════ */
  function _renderCourses(courses) {
    var el = document.getElementById('courses-list');
    if (!el) return;

    if (!courses.length) {
      el.innerHTML = _empty('📚','No courses yet',
        'Create your first course to start teaching.');
      return;
    }

    var THUMBS = ['📘','📗','📕','📙','📓'];
    var BGS    = ['#dbeafe','#d1fae5','#fee2e2','#fef3c7','#ede9fe'];

    var sorted = courses.slice().sort(function(a,b){
      return (b.enrolled_count||0) - (a.enrolled_count||0);
    });

    el.innerHTML = sorted.slice(0,5).map(function(c,i){
      var enrolled   = parseInt(c.enrolled_count||0,10);
      var maxStudents= parseInt(c.max_students||Math.max(enrolled,1),10);
      var pct        = maxStudents>0 ? Math.min(100,Math.round((enrolled/maxStudents)*100)) : 0;
      var rating     = c.avg_rating ? parseFloat(c.avg_rating).toFixed(1) : '—';
      var revenue    = c.revenue != null ? _currency(parseFloat(c.revenue)) : '—';
      var isLive     = c.status === 'published';

      return '<div class="course-row">' +
        '<div class="course-thumb" style="background:' + BGS[i%BGS.length] + ';">' + THUMBS[i%THUMBS.length] + '</div>' +
        '<div class="course-info">' +
          '<div class="course-title-row">' +
            '<div class="course-name">' + _esc(c.title) + '</div>' +
            (isLive ? '<span class="badge-live">Live</span>' : '<span class="badge-draft">Draft</span>') +
          '</div>' +
          '<div class="course-meta">' + _esc(c.category||c.level||'General') + '</div>' +
          '<div class="course-progress-bar">' +
            '<div class="course-progress-fill" style="width:' + pct + '%;"></div>' +
          '</div>' +
        '</div>' +
        '<div class="course-stats">' +
          '<div class="course-stat"><div class="course-stat-val">' + enrolled + '</div><div class="course-stat-lbl">Students</div></div>' +
          '<div class="course-stat"><div class="course-stat-val" style="color:var(--color-accent-500);">★' + rating + '</div><div class="course-stat-lbl">Rating</div></div>' +
          '<div class="course-stat"><div class="course-stat-val" style="color:var(--color-success);">' + revenue + '</div><div class="course-stat-lbl">Revenue</div></div>' +
        '</div>' +
        '<a href="course-builder.html?id=' + _esc(String(c.id)) + '" class="btn btn-ghost btn-sm" style="flex-shrink:0;" title="Edit course">' +
          '<i data-feather="edit-2" style="width:14px;height:14px;"></i>' +
        '</a>' +
      '</div>';
    }).join('');
  }

  /* ════════════════════════════════════════
     RENDER RECENT ENROLLMENTS
  ════════════════════════════════════════ */
  function _renderEnrollments(list) {
    var el = document.getElementById('enrollments-list');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = _empty('👥','No enrollments yet',
        'Students will appear here after enrolling in your courses.');
      return;
    }

    var AV_BGS = ['#dbeafe','#d1fae5','#ede9fe','#fef3c7','#fee2e2'];
    var AV_TXT = ['var(--color-primary-700)','var(--color-success-dark)','#5b21b6','#92400e','var(--color-danger-dark)'];

    el.innerHTML = list.slice(0,6).map(function(s,i){
      var n   = s.name || s.student_name || 'Student';
      var ini = _initials(n);
      var ago = _timeAgo(s.enrolled_at || s.last_enrolled_at);

      return '<div class="enroll-item">' +
        '<div class="enroll-avatar" style="background:' + AV_BGS[i%5] + ';color:' + AV_TXT[i%5] + ';">' + _esc(ini) + '</div>' +
        '<div class="enroll-info">' +
          '<div class="enroll-name">' + _esc(n) + '</div>' +
          '<div class="enroll-course">enrolled in <strong>' + _esc(s.course_title||'—') + '</strong></div>' +
        '</div>' +
        '<div class="enroll-time">' + ago + '</div>' +
      '</div>';
    }).join('');
  }

  /* ════════════════════════════════════════
     RENDER PENDING TASKS
  ════════════════════════════════════════ */
  function _renderTasks(grading, messages, forum) {
    var total = grading + messages + forum;
    _text('tasks-total', total);

    var el = document.getElementById('tasks-list');
    if (!el) return;

    el.innerHTML =
      '<a href="assessments.html" class="task-item">' +
        '<div class="task-icon" style="background:var(--color-warning-light);">' +
          '<i data-feather="check-square" style="width:15px;height:15px;color:var(--color-warning);"></i>' +
        '</div>' +
        '<div class="task-info">' +
          '<div class="task-title">Submissions to Grade</div>' +
          '<div class="task-sub">Across all assignments</div>' +
        '</div>' +
        '<span class="task-count" style="background:var(--color-warning-light);color:var(--color-warning-dark);">' + grading + ' pending</span>' +
      '</a>' +
      '<a href="messages.html" class="task-item">' +
        '<div class="task-icon" style="background:var(--color-primary-50);">' +
          '<i data-feather="mail" style="width:15px;height:15px;color:var(--color-primary-600);"></i>' +
        '</div>' +
        '<div class="task-info">' +
          '<div class="task-title">Unread Messages</div>' +
          '<div class="task-sub">From students</div>' +
        '</div>' +
        '<span class="task-count" style="background:var(--color-primary-50);color:var(--color-primary-700);">' + messages + ' new</span>' +
      '</a>' +
      '<div class="task-item" style="cursor:default;">' +
        '<div class="task-icon" style="background:var(--color-success-light);">' +
          '<i data-feather="message-square" style="width:15px;height:15px;color:var(--color-success);"></i>' +
        '</div>' +
        '<div class="task-info">' +
          '<div class="task-title">Unanswered Forum</div>' +
          '<div class="task-sub">Student questions</div>' +
        '</div>' +
        '<span class="task-count" style="background:var(--color-success-light);color:var(--color-success-dark);">' + forum + ' open</span>' +
      '</div>';
  }

  /* ════════════════════════════════════════
     RENDER UPCOMING SESSIONS
  ════════════════════════════════════════ */
  function _renderSessions(sessions) {
    var el = document.getElementById('sessions-list');
    if (!el) return;

    if (!sessions.length) {
      el.innerHTML =
        '<div style="text-align:center;padding:var(--space-5);color:var(--text-muted);">' +
          '<div style="font-size:1.5rem;margin-bottom:6px;">📅</div>' +
          '<div style="font-size:var(--font-size-sm);">No upcoming sessions.</div>' +
          '<a href="live-sessions.html" style="font-size:var(--font-size-xs);color:var(--color-primary-600);">Schedule one →</a>' +
        '</div>';
      return;
    }

    el.innerHTML = sessions.slice(0,3).map(function(s){
      var dt       = s.scheduled_at ? new Date(s.scheduled_at) : null;
      var diffMin  = dt ? Math.ceil((dt - new Date()) / 60000) : 0;
      var isLive   = dt && diffMin > 0 && diffMin <= 60;
      var timeStr  = isLive
        ? '<span class="live-dot"></span> Starting in ' + diffMin + ' min'
        : dt
          ? dt.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'}) +
            ' · ' + dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
          : '—';

      return '<div class="session-item">' +
        '<div class="session-time">' + timeStr + '</div>' +
        '<div class="session-title">' + _esc(s.title) + '</div>' +
        '<div class="session-meta">' + _esc(s.course_title||'') +
          (s.duration_minutes ? ' · ' + s.duration_minutes + ' min' : '') + '</div>' +
        (s.meeting_link
          ? '<a href="' + _esc(s.meeting_link) + '" target="_blank" rel="noopener" ' +
              'class="btn btn-primary btn-sm" style="margin-top:var(--space-3);width:100%;display:flex;align-items:center;justify-content:center;gap:4px;">' +
              '<i data-feather="video" style="width:13px;height:13px;"></i> Start Session</a>'
          : '') +
      '</div>';
    }).join('');
  }

  /* ════════════════════════════════════════
     RENDER EARNINGS PANEL
  ════════════════════════════════════════ */
  function _renderEarnings(earnings) {
    _text('earnings-total',     _currency(parseFloat(earnings.total    || 0)));
    _text('earnings-courses',   _currency(parseFloat(earnings.courses  || 0)));
    _text('earnings-materials', _currency(parseFloat(earnings.materials|| 0)));
    _text('earnings-pending',   _currency(parseFloat(earnings.pending_payout || 0)));
  }

  /* ════════════════════════════════════════
     RENDER EARNINGS CHART
  ════════════════════════════════════════ */
  function _renderEarningsChart(trend) {
    if (typeof Chart === 'undefined') return;

    var canvas = document.getElementById('earnings-chart');
    var empty  = document.getElementById('chart-empty');
    var wrap   = document.getElementById('chart-wrap');

    if (!trend || !trend.length) {
      if (canvas && wrap) { wrap.style.display = 'none'; }
      if (empty) empty.style.display = 'block';
      return;
    }

    if (wrap)  wrap.style.display  = 'block';
    if (empty) empty.style.display = 'none';

    if (_chartInstance) {
      _chartInstance.destroy();
      _chartInstance = null;
    }

    if (!canvas) return;

    var ctx      = canvas.getContext('2d');
    var gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(5, 150, 105, 0.18)');
    gradient.addColorStop(1, 'rgba(5, 150, 105, 0.01)');

    _chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.map(function(t){ return t.month; }),
        datasets: [{
          label:              'Earnings (₹)',
          data:               trend.map(function(t){ return parseFloat(t.amount)||0; }),
          borderColor:        '#059669',
          backgroundColor:    gradient,
          tension:            0.4,
          fill:               true,
          pointBackgroundColor: '#059669',
          pointRadius:        4,
          pointHoverRadius:   6,
        }]
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280' }
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { size: 11, family: 'Inter, sans-serif' }, color: '#6b7280',
              callback: function(v){ return '₹' + v.toLocaleString('en-IN'); }
            }
          }
        }
      }
    });
  }

  /* ════════════════════════════════════════
     RENDER NOTIFICATIONS
  ════════════════════════════════════════ */
  function _renderNotifications(notifData) {
    if (!notifData) return;

    /* Badge */
    var badgeEl = document.getElementById('notif-badge');
    if (badgeEl) {
      if ((notifData.unread_count||0) > 0) {
        badgeEl.textContent   = notifData.unread_count > 99 ? '99+' : notifData.unread_count;
        badgeEl.style.display = 'flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    /* Panel */
    var panelBody = document.getElementById('notif-panel-body');
    if (!panelBody) return;
    var items = notifData.items || [];

    if (!items.length) {
      panelBody.innerHTML =
        '<div class="notif-panel-empty">' +
          '<div style="font-size:2rem;margin-bottom:8px;">🔔</div>' +
          '<div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-primary);">All caught up!</div>' +
          '<div style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:4px;">No new notifications</div>' +
        '</div>';
      return;
    }

    panelBody.innerHTML = items.map(function(n){
      return '<div class="notif-item' + (n.is_read?'':' unread') + '" data-id="' + n.id + '" style="cursor:pointer;">' +
        '<div class="notif-icon">🔔</div>' +
        '<div class="notif-body">' +
          '<div class="notif-title">' + _esc(n.title||'') + '</div>' +
          '<div class="notif-text">'  + _esc(n.body ||'') + '</div>' +
          '<div class="notif-time">'  + _timeAgo(n.created_at) + '</div>' +
        '</div>' +
        (!n.is_read ? '<div class="notif-dot"></div>' : '') +
      '</div>';
    }).join('');

    panelBody.querySelectorAll('.notif-item').forEach(function(item){
      item.addEventListener('click', async function(){
        var id  = item.getAttribute('data-id');
        var dot = item.querySelector('.notif-dot');
        item.classList.remove('unread');
        if (dot) dot.remove();
        try { await Api.patch('/notifications/' + id + '/read'); } catch(e) {}
      });
    });
  }

  /* ════════════════════════════════════════
     RENDER PROFILE STRENGTH
  ════════════════════════════════════════ */
  function _renderProfileStrength(u) {
    if (!u) return;
    var fields = [
      { label: 'Full name',       done: !!u.name },
      { label: 'Bio',             done: !!u.bio },
      { label: 'Avatar / Photo',  done: !!u.avatar },
      { label: 'Specialization',  done: !!u.specialization },
      { label: 'Social links',    done: !!(u.linkedin_url || u.website) },
    ];
    var done = fields.filter(function(f){ return f.done; }).length;
    var pct  = Math.round((done / fields.length) * 100);

    var bar   = document.getElementById('profile-bar');
    var pctEl = document.getElementById('profile-pct');
    var tips  = document.getElementById('profile-tips');

    if (bar)   bar.style.width   = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';

    if (tips) {
      var missing = fields.filter(function(f){ return !f.done; });
      tips.innerHTML = missing.length === 0
        ? '<div class="profile-tip profile-tip-done">✅ Profile is complete!</div>'
        : missing.slice(0,4).map(function(f){
            return '<div class="profile-tip">○ Add your ' + f.label.toLowerCase() + '</div>';
          }).join('');
    }
  }

  /* ════════════════════════════════════════
     SOCKET.IO — Real-time updates
  ════════════════════════════════════════ */
  function _connectSocket() {
    if (typeof io === 'undefined') return;

    var token = '';
    try { token = localStorage.getItem('ev_token') || ''; } catch(e) {}

    _socket = io('/', {
      auth:               { token: token },
      transports:         ['websocket'],
      reconnectionAttempts: 5,
    });

    /* New enrollment → reload + toast */
    _socket.on('instructor:new_enrollment', function(data){
      _loadAll();
      _toast('success',
        '🎉 New Enrollment!',
        (data.student_name||'A student') + ' enrolled in ' + (data.course_title||'your course'));
    });

    /* New submission → reload + toast */
    _socket.on('instructor:new_submission', function(data){
      _loadAll();
      _toast('info',
        '📝 New Submission',
        (data.student_name||'A student') + ' submitted ' + (data.assignment_title||'an assignment'));
    });

    /* New message → reload + toast */
    _socket.on('instructor:new_message', function(data){
      _loadAll();
      _toast('info',
        '💬 New Message',
        'Message from ' + (data.sender_name||'a student'));
    });

    /* New forum doubt → reload + toast */
    _socket.on('instructor:new_forum_doubt', function(data){
      _loadAll();
      _toast('info',
        '❓ Forum Doubt',
        (data.student_name||'A student') + ' posted a question');
    });

    /* Push notification → add to panel + badge */
    _socket.on('notification:new', function(data){
      _addNotification(data);
    });

    _socket.on('connect_error', function(err){
      console.warn('[Socket]', err.message);
    });
  }

  /* Add a single notification to panel (real-time push) */
  function _addNotification(n) {
    var badge = document.getElementById('notif-badge');
    if (badge) {
      var cur = parseInt(badge.textContent, 10) || 0;
      badge.textContent   = cur + 1;
      badge.style.display = 'flex';
    }

    var body = document.getElementById('notif-panel-body');
    if (!body) return;

    var empty = body.querySelector('.notif-panel-empty');
    if (empty) empty.remove();

    var item = document.createElement('div');
    item.className = 'notif-item unread';
    item.innerHTML =
      '<div class="notif-icon">🔔</div>' +
      '<div class="notif-body">' +
        '<div class="notif-title">' + _esc(n.title||'') + '</div>' +
        '<div class="notif-text">'  + _esc(n.body ||'') + '</div>' +
        '<div class="notif-time">Just now</div>' +
      '</div>' +
      '<div class="notif-dot"></div>';
    body.insertBefore(item, body.firstChild);
  }

  /* ════════════════════════════════════════
     ERROR STATE
  ════════════════════════════════════════ */
  function _showError(err) {
    var msg = err && err.code === 'NETWORK_ERROR'
      ? '⚠️ Cannot connect to server. Is the backend running?'
      : err && err.status === 401
      ? '⚠️ Session expired. <a href="../../pages/auth/login.html">Sign in again</a>.'
      : '⚠️ Failed to load dashboard. Please refresh.';

    ['courses-list','enrollments-list','tasks-list','sessions-list'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.innerHTML =
        '<div style="color:var(--color-danger);font-size:var(--font-size-sm);padding:var(--space-4);">' + msg + '</div>';
    });

    ['stat-courses','stat-students','stat-earnings','stat-pending'].forEach(function(id){
      _text(id, '0');
    });
    _text('stat-rating', '—');
    _text('earnings-total','₹0');
    _text('earnings-courses','₹0');
    _text('earnings-materials','₹0');
    _text('earnings-pending','₹0');
    _renderEarningsChart([]);
  }

  /* ════════════════════════════════════════
     DESTROY — call on page unload
  ════════════════════════════════════════ */
  function destroy() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    if (_socket) _socket.disconnect();
    if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; }
  }

  /* ════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════ */
  function _text(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = (val == null ? '' : val);
  }

  function _esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _currency(n) {
    return '₹' + (parseFloat(n)||0).toLocaleString('en-IN', {
      minimumFractionDigits: 0, maximumFractionDigits: 0
    });
  }

  function _timeAgo(d) {
    if (!d) return '';
    /* Use Utils.timeAgo if available */
    if (typeof Utils !== 'undefined' && Utils.timeAgo) return Utils.timeAgo(d);
    var diff = Math.floor((new Date() - new Date(d)) / 1000);
    if (diff < 60)     return 'Just now';
    if (diff < 3600)   return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
  }

  function _initials(name) {
    if (typeof Utils !== 'undefined' && Utils.getInitials) return Utils.getInitials(name);
    if (!name) return '?';
    var p = name.trim().split(/\s+/);
    return p.length === 1 ? p[0].slice(0,2).toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
  }

  function _avatarColor(name) {
    if (typeof Utils !== 'undefined' && Utils.getAvatarColor) return Utils.getAvatarColor(name);
    var c = ['avatar-blue','avatar-green','avatar-amber','avatar-red'];
    if (!name) return c[0];
    var h = 0;
    for (var i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return c[Math.abs(h) % c.length];
  }

  function _showDelta(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    var n = parseFloat(value);
    if (isNaN(n)) return;
    el.textContent   = (n >= 0 ? '+' : '') + value;
    el.className     = 'stat-delta ' + (n >= 0 ? 'delta-up' : 'delta-down');
    el.style.display = '';
  }

  function _badge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent   = count > 99 ? '99+' : count;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }

  function _empty(icon, title, text) {
    return '<div style="text-align:center;padding:var(--space-6);color:var(--text-muted);">' +
      '<div style="font-size:1.8rem;margin-bottom:var(--space-2);">' + icon + '</div>' +
      '<div style="font-size:var(--font-size-sm);font-weight:600;color:var(--text-primary);">' + title + '</div>' +
      '<div style="font-size:var(--font-size-xs);margin-top:3px;">' + text + '</div>' +
    '</div>';
  }

  function _icons() {
    if (typeof feather !== 'undefined') feather.replace({ 'stroke-width': 1.75 });
  }

  function _toast(type, title, msg) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML =
      '<div class="toast-content">' +
        '<div class="toast-title">' + _esc(title) + '</div>' +
        '<div class="toast-msg">'   + _esc(msg)   + '</div>' +
      '</div>' +
      '<button class="toast-close" aria-label="Close">✕</button>';
    el.querySelector('.toast-close').addEventListener('click', function(){ el.remove(); });
    container.appendChild(el);
    setTimeout(function(){ if (el.parentNode) el.remove(); }, 5000);
  }

  /* ── Public API ── */
  return { init: init, destroy: destroy };

})();