'use strict';

/**
 * Auth views and Google OAuth entry points.
 */
const auth = { layout: 'auth', pageStyles: ['auth'], pageScripts: ['auth'] };
const pool = require('../config/db');

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
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, account_state
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [req.user.id]
    );

    if (!userResult.rows[0]) {
      const error = new Error('The authenticated user record could not be found.');
      error.status = 404;
      throw error;
    }

    const existingUser = userResult.rows[0];
    if (existingUser.account_state !== 'pending_approval') {
      await client.query('ROLLBACK');
      return res.redirect(existingUser.account_state === 'rejected' ? '/rejected' : '/dashboard');
    }

    const consentResult = await client.query(
      `SELECT consent_type
       FROM consents
       WHERE user_id = $1
         AND consent_type IN ('terms', 'privacy')
         AND withdrawn_at IS NULL`,
      [existingUser.id]
    );
    const activeConsents = new Set(consentResult.rows.map((row) => row.consent_type));

    if (activeConsents.has('terms') && activeConsents.has('privacy')) {
      await client.query('ROLLBACK');
      return res.redirect('/pending');
    }

    await client.query(
      `UPDATE users
       SET phone = $1,
           account_state = 'pending_approval',
           updated_at = NOW()
       WHERE id = $2`,
      [phone, existingUser.id]
    );

    for (const consentType of ['terms', 'privacy']) {
      if (!activeConsents.has(consentType)) {
        await client.query(
          `INSERT INTO consents (user_id, consent_type, policy_version, accepted_at)
           VALUES ($1, $2, $3, NOW())`,
          [existingUser.id, consentType, '1.0']
        );
      }
    }

    await client.query('COMMIT');
    return res.redirect('/pending');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to roll back learner application transaction:', rollbackError);
      }
    }
    return next(error);
  } finally {
    if (client) client.release();
  }
};
