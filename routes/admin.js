'use strict';

const router = require('express').Router();
const c = require('../controllers/adminController');

const upload = require('../middleware/upload');
const releaseController = require('../controllers/releaseController');
const requireAdmin = require('../middleware/routeAccess').requireAdmin;

// Protects every route in this module with administrator authorization.
router.use(requireAdmin);

// Admin dashboard overview
router.get('/', c.dashboard);
// Learner application review and user management
router.get('/users', c.users);
router.post('/users/:userId/decision', c.decision);

// Revision notes approval and preview
router.get('/content', c.content);
router.post('/content/:noteId/approve', c.approveNote);
router.get('/content/:noteId/preview', c.contentPreview);

// Assessment items approval and preview
router.get('/assessments', c.assessments);
router.post('/assessment/:questionId/approve', c.approveAssessment);
router.get('/assessments/:assessmentId/preview', c.assessmentPreview);

// System audit logs and admin settings
router.get('/audit-logs', c.auditLogs);
router.get('/settings', c.settings);

// Content release lifecycle: preview, publish, retire
router.get('/releases', releaseController.showReleasesPage);
router.get('/releases/:releaseId/preview', releaseController.previewRelease);
router.post('/releases/:releaseId/publish', releaseController.publishRelease);
router.post('/releases/:releaseId/retire', releaseController.retireRelease);

// Upload and import a zipped content release package
router.post('/releases/import', upload.single('releasePackage'), releaseController.importRelease);

module.exports = router;
