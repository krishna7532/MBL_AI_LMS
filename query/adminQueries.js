'use strict';

const pool = require('../config/db');

exports.getDashboardStats = async () =>
  pool.query(
    `SELECT
       COUNT(*)::int AS total_users,
       COUNT(*) FILTER (
         WHERE account_state = 'pending_approval'
           AND EXISTS (
             SELECT 1 FROM consents c
             WHERE c.user_id = users.id
               AND c.consent_type = 'terms'
               AND c.withdrawn_at IS NULL
           )
           AND EXISTS (
             SELECT 1 FROM consents c
             WHERE c.user_id = users.id
               AND c.consent_type = 'privacy'
               AND c.withdrawn_at IS NULL
           )
       )::int AS pending_approvals,
       COUNT(*) FILTER (WHERE account_state = 'trial_active')::int AS active_trials,
       COUNT(*) FILTER (WHERE account_state = 'paid_active')::int AS paid_learners,
       COUNT(*) FILTER (WHERE account_state = 'trial_expired')::int AS expired_learners
     FROM users`
  );

exports.getPendingApprovals = async () =>
  pool.query(
    `SELECT *
     FROM users u
     WHERE u.account_state = 'pending_approval'
       AND EXISTS (
         SELECT 1
         FROM consents c
         WHERE c.user_id = u.id
           AND c.consent_type = 'terms'
           AND c.withdrawn_at IS NULL
       )
       AND EXISTS (
         SELECT 1
         FROM consents c
         WHERE c.user_id = u.id
           AND c.consent_type = 'privacy'
           AND c.withdrawn_at IS NULL
       )
     ORDER BY u.created_at ASC`
  );
