'use strict';

/**
 * STAGE 1: display-only admin screens. No role check exists yet, and none of the
 * buttons persist anything. Server-side RBAC and audit logging are Stage 2 (PRD §4, §12.4).
 */
const mock = require('../services/mockService');
const adminQueries = require('../query/adminQueries');

const base = { pageStyles: ['admin'], pageScripts: ['admin'] };

exports.dashboard = async (req, res, next) => {
  try {
    const statsResult = await adminQueries.getDashboardStats();

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
