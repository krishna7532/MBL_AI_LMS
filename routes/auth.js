'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
const c = require('../controllers/authController');

router.get('/', c.root);
router.get('/login', c.login);
router.get('/apply', c.apply);
router.post('/apply', c.applyNotImplemented);
router.get('/pending', c.pending);
router.get('/rejected', c.rejected);

module.exports = router;



// Step 1: redirect user to Google
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Step 2: Google redirects back here
router.get(
  '/google/callback',
  passport.authenticate('google', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
  })
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

module.exports = router;