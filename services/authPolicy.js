'use strict';

const ADMIN_ROLES = new Set(['admin_publisher']);
const LEARNER_ROLES = new Set(['approved_trial_learner', 'paid_learner']);

// Chooses the post-login destination from the user's account state and role.
function getPostLoginPath(user) {
  if (!user) return '/login';
  if (user.isNewUser && user.role === 'applicant') return '/apply';

  if (user.accountState === 'pending_approval') return '/pending';
  if (user.accountState === 'rejected' || user.accountState === 'suspended') {
    return '/rejected';
  }

  if (ADMIN_ROLES.has(user.role) && user.accountState === 'active') {
    return '/admin';
  }

  const hasLearnerAccess =
    user.accountState === 'active' ||
    (user.accountState === 'trial_active' && user.trial && user.trial.isActive) ||
    (user.accountState === 'paid_active' && user.subscriptionActive);

  if (LEARNER_ROLES.has(user.role) && hasLearnerAccess) return '/dashboard';
  return '/login?access=restricted';
}

module.exports = { getPostLoginPath };
