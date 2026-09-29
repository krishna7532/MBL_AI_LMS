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
  passport.authenticate('google', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: false,
  })
);

router.get('/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    res.redirect('/login');
  });
});

module.exports = router;