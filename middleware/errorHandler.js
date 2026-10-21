'use strict';

const config = require('../config');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const message = config.isProduction
    ? 'The request could not be completed.'
    : err.message;

  if (req.accepts(['html', 'json']) === 'json') {
    return res.status(status).json({ success: false, message });
  }

  res.status(status).render('errors/500', {
    title: 'Something went wrong',
    layout: 'app',
    status,
    // Never expose stack traces outside development
    detail: config.isProduction ? null : message,
  });
};
