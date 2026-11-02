'use strict';

// Sets shared template locals from the current request without inventing a user.
module.exports = function viewContext(req, res, next) {
  const isAdminArea = req.path === '/admin' || req.path.startsWith('/admin/');
  const authenticatedUser = req.user || null;

  res.locals.currentPath = req.path;
  res.locals.isAdminArea = isAdminArea;
  res.locals.user = authenticatedUser;
  res.locals.isAuthenticated = !!authenticatedUser;
  res.locals.unreadCount = 0;
  res.locals.layout = 'app';
  res.locals.title = '';
  res.locals.pageStyles = [];
  res.locals.pageScripts = [];
  res.locals.bodyClass = '';
  next();
};
