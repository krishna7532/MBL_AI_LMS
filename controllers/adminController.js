'use strict';

/**
 * STAGE 1: display-only admin screens. No role check exists yet, and none of the
 * buttons persist anything. Server-side RBAC and audit logging are Stage 2 (PRD §4, §12.4).
 */
const mock = require('../services/mockService');
const adminQueries = require('../query/adminQueries');
const pool=require('../config/db');
const transactionQueries=require('../query/transactionQueries');

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

exports.users =async (req, res) =>{
  const data = await mock.getAdminUsers();
  res.render('admin/users', { ...base, title: 'Users & approvals', data });
};

exports.decision=async(req,res,next)=>{
  const userId = req.params.userId;
  const decision = req.body && req.body.decision;
  const submittedReason = req.body && req.body.reason;
  const reason = typeof submittedReason === 'string' ? submittedReason.trim() : '';

  let client;
  let transactionOpen = false;
  try{
    if (decision !== 'approved' && decision !== 'rejected') {
      const error = new Error('Choose either approve or reject for this application.');
      error.status = 400;
      throw error;
    }

    let adminId = req.user && req.user.id;
    if (!adminId) {
      const adminResult = await adminQueries.getAdmin();
      adminId = adminResult.rows[0] && adminResult.rows[0].id;
    }
    if (!adminId) {
      const error = new Error('No admin account is available to record this decision.');
      error.status = 500;
      throw error;
    }

    client=await pool.connect();
    await transactionQueries.begin(client);
    transactionOpen = true;

    const result = await adminQueries.decidePendingUser(
      client,
      userId,
      adminId,
      decision,
      reason
    );

    await transactionQueries.commit(client);
    transactionOpen = false;

    return res.json({
      success: true,
      decision,
      message: decision === 'approved'
        ? 'Applicant approved and 14-day trial started.'
        : 'Application rejected.',
      trial: result.trial,
    });
  }catch(error){
    if (client && transactionOpen) {
      try {
        await transactionQueries.rollback(client);
      } catch (rollbackError) {
        console.error('Failed to roll back applicant decision transaction:', rollbackError);
      }
    }
    return next(error);
  } finally {
    if (client) client.release();
  }
};

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
