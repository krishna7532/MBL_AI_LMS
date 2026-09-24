'use strict';

const router = require('express').Router();
const c = require('../controllers/adminController');

// STAGE 2: mount requireAuth + requireRole('admin', 'content_editor') here.
router.get('/', c.dashboard);
router.get('/users', c.users);
router.get('/content', c.content);
router.get('/assessments', c.assessments);
router.get('/releases', c.releases);
router.get('/audit-logs', c.auditLogs);
router.get('/settings', c.settings);

module.exports = router;
