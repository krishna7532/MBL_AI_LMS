'use strict';

const router = require('express').Router();
const c = require('../controllers/adminController');

const upload = require('../middleware/upload');
const releaseController = require('../controllers/releaseController');

// STAGE 2: mount requireAuth + requireRole('admin', 'content_editor') here.
router.get('/', c.dashboard);
router.get('/users', c.users);
router.post('/users/:userId/decision', c.decision);
router.get('/content', c.content);
router.get('/assessments', c.assessments);
router.get('/audit-logs', c.auditLogs);
router.get('/settings', c.settings);

router.get('/releases', releaseController.showReleasesPage);
router.post('/releases/import', upload.single('releasePackage'), releaseController.importRelease);

module.exports = router;
