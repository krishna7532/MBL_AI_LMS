'use strict';

/**
 * Auth views and Google OAuth entry points.
 */
const auth = { layout: 'auth', pageStyles: ['auth'], pageScripts: ['auth'] };
const prisma = require('../config/db');
const userQueries = require('../query/userQueries');
const consentQueries = require('../query/consentQueries');

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

  try {
    const outcome = await prisma.$transaction(async (transaction) => {
      const existingUser = await userQueries.getUserForApplication(transaction, req.user.id);

      if (!existingUser) {
        const error = new Error('The authenticated user record could not be found.');
        error.status = 404;
        throw error;
      }

      if (existingUser.account_state !== 'pending_approval') {
        return {
          redirect: existingUser.account_state === 'rejected' ? '/rejected' : '/dashboard',
        };
      }

      const activeConsents = new Set(
        (await consentQueries.getActiveConsents(transaction, existingUser.id))
          .map((row) => row.consent_type)
      );

      if (activeConsents.has('terms') && activeConsents.has('privacy')) {
        return { redirect: '/pending' };
      }

      await userQueries.updateUserApplication(transaction, phone, existingUser.id);

      for (const consentType of ['terms', 'privacy']) {
        if (!activeConsents.has(consentType)) {
          await consentQueries.insertConsent(transaction, existingUser.id, consentType, '1.0');
        }
      }

      return { redirect: '/pending' };
    });

    return res.redirect(outcome.redirect);
  } catch (error) {
    return next(error);
  }
};
