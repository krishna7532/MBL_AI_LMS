'use strict';

/**
 * STAGE 1: renders the public / access-state pages only.
 * Google OAuth, the application submission and the approval state machine arrive in Stage 2.
 */
const auth = { layout: 'auth', pageStyles: ['auth'], pageScripts: ['auth'] };

exports.root = (req, res) => res.redirect(302, '/login');

exports.login = (req, res) => res.render('auth/login', { ...auth, title: 'Sign in' });

exports.apply = (req, res) => res.render('auth/apply', { ...auth, title: '14-day trial application' });

exports.pending = (req, res) => res.render('auth/pending', { ...auth, title: 'Application received' });

exports.rejected = (req, res) => res.render('auth/rejected', { ...auth, title: 'Application not approved' });

// No-JS fallback for the application form. Nothing is stored in Stage 1.
exports.applyNotImplemented = (req, res) => {
  res.status(501).render('errors/501', { ...auth, title: 'Not available in Stage 1' });
};
