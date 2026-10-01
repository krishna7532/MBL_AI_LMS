'use strict';

/**
 * Auth views and Google OAuth entry points.
 */
const auth = { layout: 'auth', pageStyles: ['auth'], pageScripts: ['auth'] };
const pool = require('../config/db');
const userQueries = require('../query/userQueries');
const consentQueries = require('../query/consentQueries');
const transactionQueries = require('../query/transactionQueries');

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
  res.render('auth/apply', {
    ...auth,
    title: '14-day trial application',
    user: req.user || null,
    phone: '',
    errorMessage: null,
  });
};
exports.pending = (req, res) => res.render('auth/pending', { ...auth, title: 'Application received' });

exports.rejected = (req, res) => res.render('auth/rejected', { ...auth, title: 'Application not approved' });

exports.submitApplication = async (req, res, next) => {
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const digits = phone.replace(/\D/g, '');
  const validPhone = /^[+]?[\d\s-]+$/.test(phone) && digits.length >= 10 && digits.length <= 15;
  const acceptedTerms = req.body.consent_terms === 'accepted';
  const acceptedPrivacy = req.body.consent_privacy === 'accepted';

  if (!validPhone || !acceptedTerms || !acceptedPrivacy) {
    return res.status(400).render('auth/apply', {
      ...auth,
      title: '14-day trial application',
      user: req.user,
      phone,
      errorMessage: !validPhone
        ? 'Enter a valid phone number with 10 to 15 digits.'
        : 'Agree to both the Terms of Use and the Privacy Policy to apply.',
    });
  }

  let client;
  try {
    client = await pool.connect();
    await transactionQueries.begin(client);

    const userResult = await userQueries.getUserForApplication(client, req.user.id);

    if (!userResult.rows[0]) {
      const error = new Error('The authenticated user record could not be found.');
      error.status = 404;
      throw error;
    }

    const existingUser = userResult.rows[0];
    if (existingUser.account_state !== 'pending_approval') {
      await transactionQueries.rollback(client);
      return res.redirect(existingUser.account_state === 'rejected' ? '/rejected' : '/dashboard');
    }

    const consentResult = await consentQueries.getActiveConsents(client, existingUser.id);
    const activeConsents = new Set(consentResult.rows.map((row) => row.consent_type));

    if (activeConsents.has('terms') && activeConsents.has('privacy')) {
      await transactionQueries.rollback(client);
      return res.redirect('/pending');
    }

    await userQueries.updateUserApplication(client, phone, existingUser.id);

    for (const consentType of ['terms', 'privacy']) {
      if (!activeConsents.has(consentType)) {
        await consentQueries.insertConsent(client, existingUser.id, consentType, '1.0');
      }
    }

    await transactionQueries.commit(client);
    return res.redirect('/pending');
  } catch (error) {
    if (client) {
      try {
        await transactionQueries.rollback(client);
      } catch (rollbackError) {
        console.error('Failed to roll back learner application transaction:', rollbackError);
      }
    }
    return next(error);
  } finally {
    if (client) client.release();
  }
};
