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
  exports.getAdmin = async () => {
    return pool.query(
      `SELECT * FROM users WHERE role = 'admin_publisher'`
    );
  };

exports.decidePendingUser = async (client, userId, adminId, decision, reason) => {
  const userResult = await client.query(
    `SELECT id, account_state
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    const error = new Error('The applicant could not be found.');
    error.status = 404;
    throw error;
  }
  if (user.account_state !== 'pending_approval') {
    const error = new Error('The applicant is no longer awaiting approval.');
    error.status = 409;
    throw error;
  }

  const nextAccountState = decision === 'approved' ? 'trial_active' : 'rejected';
  if (decision === 'approved') {
    await client.query(
      `UPDATE users
       SET account_state = $1,
           role = 'approved_trial_learner',
           updated_at = NOW()
       WHERE id = $2`,
      [nextAccountState, userId]
    );
  } else {
    await client.query(
      `UPDATE users
       SET account_state = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [nextAccountState, userId]
    );
  }

  let trial = null;
  if (decision === 'approved') {
    const trialResult = await client.query(
      `INSERT INTO trials (user_id, starts_at, ends_at, state)
       VALUES ($1, NOW(), NOW() + INTERVAL '14 days', 'active')
       RETURNING starts_at, ends_at`,
      [userId]
    );
    trial = trialResult.rows[0];
  }

  await client.query(
    `INSERT INTO access_approvals (user_id, admin_id, decision, reason)
     VALUES ($1, $2, $3, $4)`,
    [userId, adminId, decision, reason || null]
  );

  return { status: 'ok', trial };
};
