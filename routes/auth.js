'use strict';

const express = require('express');
const router = express.Router();
const passport = require('passport');
const c = require('../controllers/authController');

router.get('/', c.root);
router.get('/login', c.login);
router.get('/apply', c.apply);
router.post('/apply', (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.id) return next();
  return res.redirect('/login');
}, c.submitApplication);
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
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const accountState = req.user.accountState;

    if(accountState==='pending_approval'){
      return res.redirect('/pending');
    }
    if(accountState==='rejected' || accountState==='suspended'){
      return res.redirect('/rejected');
    }
   if(accountState==='trial_active' || accountState==='paid_active'){
    return res.redirect('/dashboard');
   }
    // Keep the current success destination:
    return res.redirect('/apply');
  }
);

router.get('/logout', (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    res.redirect('/login');
  });
});

module.exports = router;