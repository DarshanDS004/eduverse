/**
 * EduVerse — Institute Controller
 * modules/institute/institute.controller.js
 */

'use strict';

const svc = require('./institute.service');
const { sendSuccess, sendError } = require('../../shared/errorHandler');

const ok      = (res, msg, data) => sendSuccess(res, 200, msg, data);
const created = (res, msg, data) => sendSuccess(res, 201, msg, data);

/* ── Dashboard ── */
exports.getDashboard = async (req, res, next) => {
  try { return ok(res, 'Dashboard loaded.', await svc.getDashboard(req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ PROFILE ══════════════ */
exports.getProfile = async (req, res, next) => {
  try { return ok(res, 'Profile loaded.', await svc.getProfile(req.user.id)); }
  catch (e) { next(e); }
};
exports.updateProfile = async (req, res, next) => {
  try { return ok(res, 'Profile updated.', await svc.updateProfile(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    const url = '/uploads/logos/' + req.file.filename;
    return ok(res, 'Logo uploaded.', await svc.updateLogo(req.user.id, url));
  } catch (e) { next(e); }
};
exports.uploadAccreditation = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    const url = '/uploads/docs/' + req.file.filename;
    return ok(res, 'Document uploaded.', await svc.updateAccreditation(req.user.id, url));
  } catch (e) { next(e); }
};

/* ══════════════ STUDENTS ══════════════ */
exports.getStudents = async (req, res, next) => {
  try { return ok(res, 'Students loaded.', await svc.getStudents(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.getStudent = async (req, res, next) => {
  try { return ok(res, 'Student loaded.', await svc.getStudent(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.addStudent = async (req, res, next) => {
  try { return created(res, 'Student added.', await svc.addStudent(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.bulkImportStudents = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    return ok(res, 'Students imported.', await svc.bulkImportStudents(req.user.id, req.file));
  } catch (e) { next(e); }
};
exports.updateStudent = async (req, res, next) => {
  try { return ok(res, 'Student updated.', await svc.updateStudent(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updateStudentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    return ok(res, 'Status updated.', await svc.updateStudentStatus(req.params.id, req.user.id, status));
  } catch (e) { next(e); }
};
exports.removeStudent = async (req, res, next) => {
  try { return ok(res, 'Student removed.', await svc.removeStudent(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.linkParent = async (req, res, next) => {
  try {
    const { parent_email, parent_phone, relation } = req.body;
    return ok(res, 'Parent linked.', await svc.linkParent(req.params.id, req.user.id, parent_email, parent_phone, relation));
  } catch (e) { next(e); }
};
exports.generateIdCard = async (req, res, next) => {
  try { return ok(res, 'ID card generated.', await svc.generateIdCard(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.getPendingRegistrations = async (req, res, next) => {
  try { return ok(res, 'Pending registrations loaded.', await svc.getPendingRegistrations(req.user.id)); }
  catch (e) { next(e); }
};
exports.approveRegistration = async (req, res, next) => {
  try { return ok(res, 'Registration approved.', await svc.approveRegistration(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.rejectRegistration = async (req, res, next) => {
  try { return ok(res, 'Registration rejected.', await svc.rejectRegistration(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ TEACHERS ══════════════ */
exports.getTeachers = async (req, res, next) => {
  try { return ok(res, 'Teachers loaded.', await svc.getTeachers(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.getTeacher = async (req, res, next) => {
  try { return ok(res, 'Teacher loaded.', await svc.getTeacher(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.addTeacher = async (req, res, next) => {
  try { return created(res, 'Teacher added.', await svc.addTeacher(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.bulkImportTeachers = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    return ok(res, 'Teachers imported.', await svc.bulkImportTeachers(req.user.id, req.file));
  } catch (e) { next(e); }
};
exports.updateTeacher = async (req, res, next) => {
  try { return ok(res, 'Teacher updated.', await svc.updateTeacher(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updateTeacherStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    return ok(res, 'Status updated.', await svc.updateTeacherStatus(req.params.id, req.user.id, status));
  } catch (e) { next(e); }
};
exports.removeTeacher = async (req, res, next) => {
  try { return ok(res, 'Teacher removed.', await svc.removeTeacher(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ CLASSES ══════════════ */
exports.getClasses = async (req, res, next) => {
  try { return ok(res, 'Classes loaded.', await svc.getClasses(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.createClass = async (req, res, next) => {
  try { return created(res, 'Class created.', await svc.createClass(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.getClass = async (req, res, next) => {
  try { return ok(res, 'Class loaded.', await svc.getClass(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.updateClass = async (req, res, next) => {
  try { return ok(res, 'Class updated.', await svc.updateClass(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.deleteClass = async (req, res, next) => {
  try { return ok(res, 'Class deleted.', await svc.deleteClass(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.assignStudentToClass = async (req, res, next) => {
  try {
    const { student_id, roll_number } = req.body;
    return ok(res, 'Student assigned.', await svc.assignStudentToClass(req.params.id, student_id, roll_number));
  } catch (e) { next(e); }
};
exports.removeStudentFromClass = async (req, res, next) => {
  try { return ok(res, 'Student removed from class.', await svc.removeStudentFromClass(req.params.id, req.params.sid)); }
  catch (e) { next(e); }
};
exports.assignTeacherToClass = async (req, res, next) => {
  try {
    const { teacher_id, subject } = req.body;
    return ok(res, 'Teacher assigned.', await svc.assignTeacherToClass(req.params.id, teacher_id, subject));
  } catch (e) { next(e); }
};
exports.removeTeacherFromClass = async (req, res, next) => {
  try { return ok(res, 'Teacher removed from class.', await svc.removeTeacherFromClass(req.params.id, req.params.tid)); }
  catch (e) { next(e); }
};
exports.transferStudent = async (req, res, next) => {
  try {
    const { from_class_id, to_class_id } = req.body;
    return ok(res, 'Student transferred.', await svc.transferStudent(req.params.id, from_class_id, to_class_id));
  } catch (e) { next(e); }
};

/* ══════════════ ACADEMIC YEARS ══════════════ */
exports.getAcademicYears = async (req, res, next) => {
  try { return ok(res, 'Academic years loaded.', await svc.getAcademicYears(req.user.id)); }
  catch (e) { next(e); }
};
exports.createAcademicYear = async (req, res, next) => {
  try { return created(res, 'Academic year created.', await svc.createAcademicYear(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updateAcademicYear = async (req, res, next) => {
  try { return ok(res, 'Academic year updated.', await svc.updateAcademicYear(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};

/* ══════════════ TIMETABLE ══════════════ */
exports.getTimetable = async (req, res, next) => {
  try { return ok(res, 'Timetable loaded.', await svc.getTimetable(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.createTimetableEntry = async (req, res, next) => {
  try { return created(res, 'Timetable entry created.', await svc.createTimetableEntry(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updateTimetableEntry = async (req, res, next) => {
  try { return ok(res, 'Timetable entry updated.', await svc.updateTimetableEntry(req.params.id, req.body)); }
  catch (e) { next(e); }
};
exports.deleteTimetableEntry = async (req, res, next) => {
  try { return ok(res, 'Timetable entry deleted.', await svc.deleteTimetableEntry(req.params.id)); }
  catch (e) { next(e); }
};

/* ══════════════ CALENDAR ══════════════ */
exports.getCalendar = async (req, res, next) => {
  try { return ok(res, 'Calendar loaded.', await svc.getCalendar(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.createCalendarEvent = async (req, res, next) => {
  try { return created(res, 'Event created.', await svc.createCalendarEvent(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updateCalendarEvent = async (req, res, next) => {
  try { return ok(res, 'Event updated.', await svc.updateCalendarEvent(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.deleteCalendarEvent = async (req, res, next) => {
  try { return ok(res, 'Event deleted.', await svc.deleteCalendarEvent(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ ATTENDANCE ══════════════ */
exports.getAttendanceSessions = async (req, res, next) => {
  try { return ok(res, 'Sessions loaded.', await svc.getAttendanceSessions(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.createAttendanceSession = async (req, res, next) => {
  try { return created(res, 'Session created.', await svc.createAttendanceSession(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.markAttendance = async (req, res, next) => {
  try { return ok(res, 'Attendance marked.', await svc.markAttendance(req.params.id, req.body.records)); }
  catch (e) { next(e); }
};
exports.overrideAttendance = async (req, res, next) => {
  try {
    const { status } = req.body;
    return ok(res, 'Attendance overridden.', await svc.overrideAttendance(req.params.id, status));
  } catch (e) { next(e); }
};
exports.getStudentAttendance = async (req, res, next) => {
  try { return ok(res, 'Attendance loaded.', await svc.getStudentAttendance(req.params.studentId, req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.getClassAttendance = async (req, res, next) => {
  try { return ok(res, 'Attendance loaded.', await svc.getClassAttendance(req.params.classId, req.user.id, req.query)); }
  catch (e) { next(e); }
};

/* ══════════════ FEES ══════════════ */
exports.getFeeStructures = async (req, res, next) => {
  try { return ok(res, 'Fee structures loaded.', await svc.getFeeStructures(req.user.id)); }
  catch (e) { next(e); }
};
exports.createFeeStructure = async (req, res, next) => {
  try { return created(res, 'Fee structure created.', await svc.createFeeStructure(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.updateFeeStructure = async (req, res, next) => {
  try { return ok(res, 'Fee structure updated.', await svc.updateFeeStructure(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.deleteFeeStructure = async (req, res, next) => {
  try { return ok(res, 'Fee structure deleted.', await svc.deleteFeeStructure(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.assignFee = async (req, res, next) => {
  try { return ok(res, 'Fee assigned.', await svc.assignFee(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.getStudentFees = async (req, res, next) => {
  try { return ok(res, 'Student fees loaded.', await svc.getStudentFees(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.recordManualPayment = async (req, res, next) => {
  try { return ok(res, 'Payment recorded.', await svc.recordManualPayment(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.sendFeeReminder = async (req, res, next) => {
  try { return ok(res, 'Reminders sent.', await svc.sendFeeReminder(req.user.id, req.body)); }
  catch (e) { next(e); }
};

/* ══════════════ CONTENT ══════════════ */
exports.getContent = async (req, res, next) => {
  try { return ok(res, 'Content loaded.', await svc.getContent(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.uploadVideo = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    return created(res, 'Video uploaded.', await svc.uploadVideo(req.user.id, req.body, req.file));
  } catch (e) { next(e); }
};
exports.uploadMaterial = async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.', 'NO_FILE');
    return created(res, 'Material uploaded.', await svc.uploadMaterial(req.user.id, req.body, req.file));
  } catch (e) { next(e); }
};
exports.updateContent = async (req, res, next) => {
  try { return ok(res, 'Content updated.', await svc.updateContent(req.params.id, req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.archiveContent = async (req, res, next) => {
  try { return ok(res, 'Content archived.', await svc.archiveContent(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ ANNOUNCEMENTS ══════════════ */
exports.getAnnouncements = async (req, res, next) => {
  try { return ok(res, 'Announcements loaded.', await svc.getAnnouncements(req.user.id)); }
  catch (e) { next(e); }
};
exports.createAnnouncement = async (req, res, next) => {
  try { return created(res, 'Announcement sent.', await svc.createAnnouncement(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.deleteAnnouncement = async (req, res, next) => {
  try { return ok(res, 'Announcement deleted.', await svc.deleteAnnouncement(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ CERTIFICATES ══════════════ */
exports.issueBatchCertificates = async (req, res, next) => {
  try { return ok(res, 'Certificates issued.', await svc.issueBatchCertificates(req.user.id, req.body)); }
  catch (e) { next(e); }
};
exports.generateTransferCert = async (req, res, next) => {
  try { return ok(res, 'Transfer certificate generated.', await svc.generateTransferCert(req.params.studentId, req.user.id)); }
  catch (e) { next(e); }
};
exports.generateBonafideCert = async (req, res, next) => {
  try { return ok(res, 'Bonafide certificate generated.', await svc.generateBonafideCert(req.params.studentId, req.user.id)); }
  catch (e) { next(e); }
};

/* ══════════════ ANALYTICS & REPORTS ══════════════ */
exports.getAnalytics = async (req, res, next) => {
  try { return ok(res, 'Analytics loaded.', await svc.getAnalytics(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.getStudentReport = async (req, res, next) => {
  try { return ok(res, 'Report loaded.', await svc.getStudentReport(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.getClassReport = async (req, res, next) => {
  try { return ok(res, 'Report loaded.', await svc.getClassReport(req.params.id, req.user.id)); }
  catch (e) { next(e); }
};
exports.getAttendanceReport = async (req, res, next) => {
  try { return ok(res, 'Report loaded.', await svc.getAttendanceReport(req.user.id, req.query)); }
  catch (e) { next(e); }
};
exports.getFeeReport = async (req, res, next) => {
  try { return ok(res, 'Report loaded.', await svc.getFeeReport(req.user.id, req.query)); }
  catch (e) { next(e); }
};