/**
 * EduVerse — Startup Diagnostic
 * Run from: E:\Ds_projects\eduverse\backend\
 * Command:  node diagnose.js
 *
 * Loads every route file one-by-one in the same order as app.js
 * and reports exactly which one fails and why.
 */

'use strict';

require('./config/env');
require('dotenv').config();

const express = require('express');

const routes = [
  ['auth',          './modules/auth/auth.routes'],
  ['student',       './modules/student/student.routes'],
  ['instructor',    './modules/instructor/instructor.routes'],
  ['institute',     './modules/institute/institute.routes'],
  ['admin',         './modules/superadmin/superadmin.routes'],
  ['parent',        './modules/parent/parent.routes'],
  ['courses',       './modules/courses/courses.routes'],
  ['payments',      './modules/payments/payments.routes'],
  ['materials',     './modules/materials/materials.routes'],
  ['quizzes',       './modules/quizzes/quizzes.routes'],
  ['messages',      './modules/messages/messages.routes'],
  ['notifications', './modules/notifications/notifications.routes'],
  ['certificates',  './modules/certificates/certificates.routes'],
  ['attendance',    './modules/attendance/attendance.routes'],
  ['assignments',   './modules/assignments/assignments.routes'],
  ['discussions',   './modules/discussions/discussions.routes'],
  ['live-sessions', './modules/live-sessions/live-sessions.routes'],
  ['videos',        './modules/videos/videos.routes'],
  ['reports',       './modules/reports/reports.routes'],
];

const app = express();
let allOk = true;

for (const [name, modPath] of routes) {
  try {
    const router = require(modPath);
    const t = typeof router;
    const isRouter = t === 'function' || (t === 'object' && router && router.handle);
    const status = isRouter ? '✅ OK    ' : '❌ BROKEN';
    console.log(`${status}  ${name.padEnd(16)} (${modPath}) → type: ${t}, keys: [${Object.keys(router || {}).join(', ')}]`);
    if (!isRouter) {
      allOk = false;
      console.log(`\n  ↳ "${name}" did NOT export a router/middleware function.`);
      console.log(`    This is the module causing app.js line 154 crash.`);
      console.log(`    Check that ${modPath} ends with "module.exports = router;"\n`);
    }
  } catch (e) {
    allOk = false;
    console.error(`❌ CRASH  ${name.padEnd(16)} (${modPath})`);
    console.error(`  ↳ Error: ${e.message}`);
    console.error(`  ↳ Stack: ${e.stack.split('\n').slice(1, 4).join('\n           ')}`);
    console.log('');
  }
}

console.log('\n' + '═'.repeat(60));
if (allOk) {
  console.log('✅ All route files loaded correctly.');
  console.log('   The bug may be in shared/errorHandler.js or app.js itself.');
  console.log('   Run: node -e "require(\'./shared/errorHandler\')" to check.');
} else {
  console.log('❌ Fix the broken module(s) above, then run npm run dev again.');
}