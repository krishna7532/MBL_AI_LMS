'use strict';

/**
 * Auth views and Google OAuth entry points.
 */
const auth = { layout: 'auth', pageStyles: ['auth'], pageScripts: ['auth'] };
const prisma = require('../config/db');
const userQueries = require('../query/userQueries');
const consentQueries = require('../query/consentQueries');
const authPolicy = require('../services/authPolicy');

// Sends the root URL to the login page.
exports.root = (req, res) => res.redirect(302, '/login');

// Renders sign-in and displays any account access restriction.
exports.login = (req, res) => {
  res.render('auth/login', {
    ...auth,
    title: 'Sign in',
    user: req.user || null,
    isAuthenticated: !!req.user,
    accessMessage: req.query.access === 'restricted'
      ? 'This account does not currently have access. Contact support if you believe this is an error.'
      : null,
  });
};

// Renders the trial application form.
exports.apply = (req, res) => {
  res.render('auth/apply', {
    ...auth,
    title: '14-day trial application',
    user: req.user || null,
    phone: '',
    errorMessage: null,
  });
};
// Shows confirmation that an application is awaiting review.
exports.pending = (req, res) =>
  res.render('auth/pending', { ...auth, title: 'Application received' });

// Redirects the signed-in user to the correct page after Google login.
exports.googleCallback = (req, res) =>
  res.redirect(authPolicy.getPostLoginPath(req.user));

// Displays the latest rejection reason for the signed-in applicant.
exports.rejected = async (req, res, next) => {
  try {
    const reason = await userQueries.getReason(prisma, req.user && req.user.id);
    return res.render('auth/rejected', {
      ...auth,
      title: 'Application not approved',
      reason,
    });
  } catch (error) {
    return next(error);
  }
};

// Validates and records a trial application and its required consents.
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
