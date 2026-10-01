'use strict';

/**
 * STAGE 1: display-only admin screens. No role check exists yet, and none of the
 * buttons persist anything. Server-side RBAC and audit logging are Stage 2 (PRD §4, §12.4).
 */
const mock = require('../services/mockService');
const pool = require('../config/db');

const base = { pageStyles: ['admin'], pageScripts: ['admin'] };

exports.dashboard = async (req, res, next) => {
  try {
    const statsResult = await pool.query(
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

    const data = await mock.getAdminOverview();
    const counts = statsResult.rows[0];
    data.stats = {
      ...data.stats,
      totalUsers: counts.total_users,
      pendingApprovals: counts.pending_approvals,
      activeTrials: counts.active_trials,
      paidLearners: counts.paid_learners,
      expiredLearners: counts.expired_learners,
    };
    return res.render('admin/dashboard', { ...base, title: 'Admin dashboard', data });
  } catch (error) {
    return next(error);
  }
};

exports.users = (req, res) =>
  res.render('admin/users', { ...base, title: 'Users & approvals', data: mock.getAdminUsers() });

exports.content = (req, res) =>
  res.render('admin/content', { ...base, title: 'Content management', items: mock.getContentItems() });

exports.assessments = (req, res) =>
  res.render('admin/assessments', { ...base, title: 'Assessment management', items: mock.getAssessmentItems() });

exports.releases = (req, res) =>
  res.render('admin/releases', { ...base, title: 'Release management', releases: mock.getReleases() });

exports.auditLogs = (req, res) =>
  res.render('admin/audit-logs', { ...base, title: 'Audit log', logs: mock.getAuditLogs() });

exports.settings = (req, res) =>
  res.render('admin/settings', { ...base, title: 'Settings', settings: mock.getAdminSettings() });
