'use strict';

/**
 * Auth views and Google OAuth entry points.
 */
const auth = { layout: 'auth', pageStyles: ['auth'], pageScripts: ['auth'] };

exports.root = (req, res) => res.redirect(302, '/login');

exports.login = (req, res) => {
  res.render('auth/login', {
    ...auth,
    title: 'Sign in',
    user: req.user || null,
    isAuthenticated: !!req.user,
  });
};

exports.apply = (req, res) => {
  res.render('auth/apply', { ...auth, title: '14-day trial application' });
};
exports.pending = (req, res) => res.render('auth/pending', { ...auth, title: 'Application received' });

exports.rejected = (req, res) => res.render('auth/rejected', { ...auth, title: 'Application not approved' });

// No-JS fallback for the application form. Nothing is stored in Stage 1.
exports.applyNotImplemented = (req, res) => {
  res.status(501).render('errors/501', { ...auth, title: 'Not available in Stage 1' });
};
