const modules = [
  'auth', 'student', 'instructor', 'institute', 'superadmin', 'parent',
  'courses', 'payments', 'materials', 'quizzes', 'messages', 'notifications',
  'certificates', 'attendance', 'assignments', 'discussions', 'live-sessions',
  'videos', 'reports'
];

modules.forEach(m => {
  try {
    const r = require(./modules//.routes);
    console.log(✓ : );
  } catch (e) {
    console.log(✗ : );
  }
});
