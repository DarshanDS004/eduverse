/**
 * EduVerse — Institute Routes
 * modules/institute/institute.routes.js
 */

'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const ctrl    = require('./institute.controller');
const { protect, restrictTo } = require('../auth/auth.middleware');

router.use(protect);
router.use(restrictTo('institute'));

/* ── Multer helpers ── */
function makeStorage(sub) {
  const dir = path.join(__dirname, '../../../uploads', sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename:    (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, sub.replace('/', '-') + '-' + Date.now() + ext);
    },
  });
}

const logoUpload    = multer({ storage: makeStorage('logos'),    limits: { fileSize: 5  * 1024 * 1024 } });
const docUpload     = multer({ storage: makeStorage('docs'),     limits: { fileSize: 20 * 1024 * 1024 } });
const materialUpload= multer({ storage: makeStorage('materials'),limits: { fileSize: 50 * 1024 * 1024 } });
const videoUpload   = multer({ storage: makeStorage('videos'),   limits: { fileSize: 500* 1024 * 1024 } });
const bulkUpload    = multer({ storage: makeStorage('bulk'),     limits: { fileSize: 10 * 1024 * 1024 } });

/* ═══════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════ */
router.get('/dashboard', ctrl.getDashboard);

/* ═══════════════════════════════════════
   PROFILE
═══════════════════════════════════════ */
router.get('/profile',              ctrl.getProfile);
router.patch('/profile',            ctrl.updateProfile);
router.post('/profile/logo',        logoUpload.single('logo'),       ctrl.uploadLogo);
router.post('/profile/accreditation', docUpload.single('document'),  ctrl.uploadAccreditation);

/* ═══════════════════════════════════════
   STUDENT MANAGEMENT
═══════════════════════════════════════ */
router.get('/students',                     ctrl.getStudents);
router.get('/students/:id',                 ctrl.getStudent);
router.post('/students',                    ctrl.addStudent);
router.post('/students/bulk-import',        bulkUpload.single('file'), ctrl.bulkImportStudents);
router.patch('/students/:id',               ctrl.updateStudent);
router.patch('/students/:id/status',        ctrl.updateStudentStatus);
router.delete('/students/:id',              ctrl.removeStudent);
router.post('/students/:id/link-parent',    ctrl.linkParent);
router.get('/students/:id/generate-id-card',ctrl.generateIdCard);
router.get('/pending-registrations',        ctrl.getPendingRegistrations);
router.patch('/pending-registrations/:id/approve', ctrl.approveRegistration);
router.patch('/pending-registrations/:id/reject',  ctrl.rejectRegistration);

/* ═══════════════════════════════════════
   TEACHER MANAGEMENT
═══════════════════════════════════════ */
router.get('/teachers',              ctrl.getTeachers);
router.get('/teachers/:id',          ctrl.getTeacher);
router.post('/teachers',             ctrl.addTeacher);
router.post('/teachers/bulk-import', bulkUpload.single('file'), ctrl.bulkImportTeachers);
router.patch('/teachers/:id',        ctrl.updateTeacher);
router.patch('/teachers/:id/status', ctrl.updateTeacherStatus);
router.delete('/teachers/:id',       ctrl.removeTeacher);

/* ═══════════════════════════════════════
   CLASS & BATCH MANAGEMENT
═══════════════════════════════════════ */
router.get('/classes',                          ctrl.getClasses);
router.post('/classes',                         ctrl.createClass);
router.get('/classes/:id',                      ctrl.getClass);
router.patch('/classes/:id',                    ctrl.updateClass);
router.delete('/classes/:id',                   ctrl.deleteClass);
router.post('/classes/:id/students',            ctrl.assignStudentToClass);
router.delete('/classes/:id/students/:sid',     ctrl.removeStudentFromClass);
router.post('/classes/:id/teachers',            ctrl.assignTeacherToClass);
router.delete('/classes/:id/teachers/:tid',     ctrl.removeTeacherFromClass);
router.post('/students/:id/transfer-class',     ctrl.transferStudent);

/* ═══════════════════════════════════════
   ACADEMIC YEARS
═══════════════════════════════════════ */
router.get('/academic-years',        ctrl.getAcademicYears);
router.post('/academic-years',       ctrl.createAcademicYear);
router.patch('/academic-years/:id',  ctrl.updateAcademicYear);

/* ═══════════════════════════════════════
   TIMETABLE
═══════════════════════════════════════ */
router.get('/timetable',             ctrl.getTimetable);
router.post('/timetable',            ctrl.createTimetableEntry);
router.patch('/timetable/:id',       ctrl.updateTimetableEntry);
router.delete('/timetable/:id',      ctrl.deleteTimetableEntry);

/* ═══════════════════════════════════════
   ACADEMIC CALENDAR
═══════════════════════════════════════ */
router.get('/calendar',              ctrl.getCalendar);
router.post('/calendar',             ctrl.createCalendarEvent);
router.patch('/calendar/:id',        ctrl.updateCalendarEvent);
router.delete('/calendar/:id',       ctrl.deleteCalendarEvent);

/* ═══════════════════════════════════════
   ATTENDANCE
═══════════════════════════════════════ */
router.get('/attendance/sessions',              ctrl.getAttendanceSessions);
router.post('/attendance/sessions',             ctrl.createAttendanceSession);
router.post('/attendance/sessions/:id/mark',    ctrl.markAttendance);
router.patch('/attendance/records/:id',         ctrl.overrideAttendance);
router.get('/attendance/student/:studentId',    ctrl.getStudentAttendance);
router.get('/attendance/class/:classId',        ctrl.getClassAttendance);

/* ═══════════════════════════════════════
   FEE MANAGEMENT
═══════════════════════════════════════ */
router.get('/fees/structures',                  ctrl.getFeeStructures);
router.post('/fees/structures',                 ctrl.createFeeStructure);
router.patch('/fees/structures/:id',            ctrl.updateFeeStructure);
router.delete('/fees/structures/:id',           ctrl.deleteFeeStructure);
router.post('/fees/assign',                     ctrl.assignFee);
router.get('/fees/students',                    ctrl.getStudentFees);
router.patch('/fees/:id/manual-payment',        ctrl.recordManualPayment);
router.post('/fees/send-reminder',              ctrl.sendFeeReminder);

/* ═══════════════════════════════════════
   CONTENT MANAGEMENT
═══════════════════════════════════════ */
router.get('/content',                          ctrl.getContent);
router.post('/content/video',   videoUpload.single('video'),       ctrl.uploadVideo);
router.post('/content/material',materialUpload.single('file'),     ctrl.uploadMaterial);
router.patch('/content/:id',                    ctrl.updateContent);
router.delete('/content/:id',                   ctrl.archiveContent);

/* ═══════════════════════════════════════
   ANNOUNCEMENTS
═══════════════════════════════════════ */
router.get('/announcements',                    ctrl.getAnnouncements);
router.post('/announcements',                   ctrl.createAnnouncement);
router.delete('/announcements/:id',             ctrl.deleteAnnouncement);

/* ═══════════════════════════════════════
   CERTIFICATES & DOCUMENTS
═══════════════════════════════════════ */
router.post('/certificates/batch',              ctrl.issueBatchCertificates);
router.post('/certificates/transfer/:studentId',ctrl.generateTransferCert);
router.post('/certificates/bonafide/:studentId',ctrl.generateBonafideCert);

/* ═══════════════════════════════════════
   REPORTS & ANALYTICS
═══════════════════════════════════════ */
router.get('/analytics',                        ctrl.getAnalytics);
router.get('/reports/student/:id',              ctrl.getStudentReport);
router.get('/reports/class/:id',                ctrl.getClassReport);
router.get('/reports/attendance',               ctrl.getAttendanceReport);
router.get('/reports/fees',                     ctrl.getFeeReport);

module.exports = router;