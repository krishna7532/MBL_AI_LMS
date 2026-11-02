'use strict';

// 404 middleware that renders the not-found error template for unmatched routes
module.exports = function notFound(req, res) {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'We could not find what you were looking for.',
    });
  }

  res.status(404).render('errors/404', {
    title: 'Page not found',
    layout: 'app',
  });
};
