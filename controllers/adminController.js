'use strict';

/**
 * STAGE 1: display-only admin screens. No role check exists yet, and none of the
 * buttons persist anything. Server-side RBAC and audit logging are Stage 2 (PRD §4, §12.4).
 */
const mock = require('../services/mockService');

const base = { pageStyles: ['admin'], pageScripts: ['admin'] };

exports.dashboard = (req, res) =>
  res.render('admin/dashboard', { ...base, title: 'Admin dashboard', data: mock.getAdminOverview() });

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
