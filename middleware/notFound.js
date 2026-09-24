'use strict';

module.exports = function notFound(req, res) {
  res.status(404).render('errors/404', {
    title: 'Page not found',
    layout: 'app',
    path: req.originalUrl,
  });
};
