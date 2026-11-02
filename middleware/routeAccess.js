'use strict';

const prisma = require('../config/db');

const ADMIN_ROLES = new Set(['admin_publisher']);
const LEARNER_ROLES = new Set(['approved_trial_learner', 'paid_learner']);

// Identifies API requests so access errors use JSON responses.
function isApiRequest(req) {
  return req.originalUrl.startsWith('/api/');
}

// Confirms a learner has a current account state and valid trial or subscription.
function hasCurrentLearnerAccess(user) {
  return user.account_state === 'active' ||
    (user.account_state === 'trial_active' && user.trials.length > 0) ||
    (user.account_state === 'paid_active' && user.subscriptions.length > 0);
}

// Responds to denied access with an API error or an appropriate page.
function deny(req, res, status, message, user) {
  if (isApiRequest(req)) {
    return res.status(status).json({ success: false, message });
  }

  if (status === 401) return res.redirect('/login');

  const homeUrl = user && ADMIN_ROLES.has(user.role)
    ? '/admin'
    : user && LEARNER_ROLES.has(user.role) && hasCurrentLearnerAccess(user)
      ? '/dashboard'
      : '/login?access=restricted';

  return res.status(status).render('errors/500', {
    title: 'Access unavailable',
    layout: 'app',
    status,
    detail: message,
    homeUrl,
  });
}

// Builds authentication and role guards using the supplied Prisma client.
function createRouteAccess(database = prisma) {
  const requireAuthenticated = (req, res, next) => {
    if (req.user && req.user.id) return next();
    if (isApiRequest(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    return res.redirect('/login');
  };

  // Loads current roles and entitlements instead of trusting session snapshots.
  async function findCurrentUser(req) {
    const now = new Date();
    return database.users.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        role: true,
        account_state: true,
        deleted_at: true,
        trials: {
          where: {
            state: 'active',
            starts_at: { lte: now },
            ends_at: { gt: now },
          },
          select: { id: true },
          take: 1,
        },
        subscriptions: {
          where: {
            status: 'active',
            starts_at: { lte: now },
            ends_at: { gt: now },
          },
          select: { id: true },
          take: 1,
        },
      },
    });
  }

  // Allows only authenticated, active administrator accounts.
  function requireAdmin(req, res, next) {
    return requireAuthenticated(req, res, () => {
      findCurrentUser(req).then((user) => {
        if (!user || user.deleted_at) {
          return deny(req, res, 401, 'Authentication required.');
        }

        if (!ADMIN_ROLES.has(user.role) || user.account_state !== 'active') {
          return deny(req, res, 403, 'An active administrator account is required.', user);
        }

        req.authorizationUser = user;
        return next();
      }).catch(next);
    });
  }

  // Allows only authenticated learners with a current entitlement.
  function requireLearner(req, res, next) {
    return requireAuthenticated(req, res, () => {
      findCurrentUser(req).then((user) => {
        if (!user || user.deleted_at) {
          return deny(req, res, 401, 'Authentication required.');
        }

        if (!LEARNER_ROLES.has(user.role)) {
          return deny(req, res, 403, 'An active learner account is required.', user);
        }

        if (!hasCurrentLearnerAccess(user)) {
          return deny(req, res, 403, 'Your learner access is inactive or expired.', user);
        }

        req.authorizationUser = user;
        return next();
      }).catch(next);
    });
  }

  return { requireAuthenticated, requireAdmin, requireLearner };
}

const guards = createRouteAccess();

module.exports = {
  ADMIN_ROLES,
  LEARNER_ROLES,
  createRouteAccess,
  ...guards,
};
