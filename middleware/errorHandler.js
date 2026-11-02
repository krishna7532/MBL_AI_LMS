'use strict';

const STATUS_MESSAGES = {
  400: 'Please check your information and try again.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'This request conflicts with the current state. Refresh and try again.',
  413: 'The request is too large. Please reduce it and try again.',
  415: 'This file type is not supported.',
  422: 'Please check your information and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  502: 'A service is temporarily unavailable. Please try again later.',
  503: 'A service is temporarily unavailable. Please try again later.',
  504: 'A service is temporarily unavailable. Please try again later.',
};

const DEFAULT_MESSAGE = 'Something went wrong. Please try again later.';

function isValidStatus(status) {
  return Number.isInteger(status) && status >= 400 && status <= 599;
}

function resolveError(error) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  if (code === 'P2002') {
    return { status: 409, message: 'That information is already in use. Please check and try again.' };
  }
  if (code === 'P2025') {
    return { status: 404, message: STATUS_MESSAGES[404] };
  }
  if (code === 'P2000' || code === 'P2003' || code === 'P2014') {
    return { status: 400, message: STATUS_MESSAGES[400] };
  }
  if (/^P\d{4}$/.test(code)) {
    return { status: 500, message: DEFAULT_MESSAGE };
  }

  if (error && error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return { status: 413, message: 'The file is too large. Please choose a smaller file.' };
    }
    return { status: 400, message: 'The file could not be uploaded. Please check it and try again.' };
  }

  if (error && error.code === 'UNSUPPORTED_UPLOAD_TYPE') {
    return { status: 415, message: STATUS_MESSAGES[415] };
  }

  if (error && error.type === 'entity.parse.failed') {
    return { status: 400, message: 'The submitted information could not be read. Please check it and try again.' };
  }
  if (error && error.type === 'entity.too.large') {
    return { status: 413, message: STATUS_MESSAGES[413] };
  }

  const status = error && isValidStatus(Number(error.status))
    ? Number(error.status)
    : 500;
  const message = error && typeof error.publicMessage === 'string'
    ? error.publicMessage
    : STATUS_MESSAGES[status] || DEFAULT_MESSAGE;

  return { status, message };
}

function isApiRequest(req) {
  return req.path === '/api' || req.path.startsWith('/api/');
}

// Logs diagnostics for operators while returning only learner-safe messages.
module.exports = function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const resolved = resolveError(error);
  if (resolved.status >= 500) {
    console.error('Request failed:', {
      method: req.method,
      path: req.path,
      status: resolved.status,
    }, error);
  }

  if (isApiRequest(req) || req.accepts(['html', 'json']) === 'json') {
    return res.status(resolved.status).json({
      success: false,
      message: resolved.message,
    });
  }

  return res.status(resolved.status).render('errors/500', {
    title: 'Something went wrong',
    layout: 'app',
    pageStyles: [],
    pageScripts: [],
    bodyClass: '',
    user: req.user || null,
    isAdminArea: req.path === '/admin' || req.path.startsWith('/admin/'),
    status: resolved.status,
    detail: resolved.message,
    homeUrl: req.user && req.user.role === 'admin_publisher' ? '/admin' : '/dashboard',
  });
};
