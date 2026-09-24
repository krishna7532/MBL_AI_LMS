'use strict';

/**
 * STAGE 1 ONLY — NOT AUTHENTICATION.
 * Injects the demo learner (or demo admin for /admin paths) into every view so the
 * templates can be previewed. There is no session, no login and no authorization here.
 * Stage 2 replaces this with Google OAuth sessions and server-side RBAC (PRD §4, §19.1).
 */
const mock = require('../services/mockService');

module.exports = function mockContext(req, res, next) {
  const isAdminArea = req.path === '/admin' || req.path.startsWith('/admin/');
  res.locals.currentPath = req.path;
  res.locals.isAdminArea = isAdminArea;
  res.locals.user = isAdminArea ? mock.getAdminUser() : mock.getLearner();
  res.locals.unreadCount = isAdminArea ? 0 : mock.getUnreadCount();
  res.locals.layout = 'app';
  res.locals.title = '';
  res.locals.pageStyles = [];
  res.locals.pageScripts = [];
  res.locals.bodyClass = '';
  next();
};
