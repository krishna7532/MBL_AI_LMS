'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
const c = require('../controllers/authController');
const authPolicy = require('../services/authPolicy');
const requireAuthenticated = require('../middleware/routeAccess').requireAuthenticated;

// Keeps the application form available only to signed-in applicants awaiting review.
function requireApplicant(req, res, next) {
  if (req.user.role === 'applicant' && req.user.accountState === 'pending_approval') {
    return next();
  }
  return res.redirect(authPolicy.getPostLoginPath(req.user));
}

// Public entry and login views
router.get('/', c.root);
router.get('/login', c.login);

// Learner application submission and status pages
router.get('/apply', requireAuthenticated, requireApplicant, c.apply);
router.post('/apply', requireAuthenticated, requireApplicant, c.submitApplication);
router.get('/pending', requireAuthenticated, c.pending);
router.get('/rejected', requireAuthenticated, c.rejected);

//for authentication
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  c.googleCallback
);

// Clears the Passport login session and returns the user to sign-in.
router.get('/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    res.redirect('/login');
  });
});

module.exports = router;
