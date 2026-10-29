'use strict';

/**
 * STAGE 1: display-only admin screens. No role check exists yet, and none of the
 * buttons persist anything. Server-side RBAC and audit logging are Stage 2 (PRD §4, §12.4).
 */
const mock = require('../services/mockService');
const adminQueries = require('../query/adminQueries');
const { syncReleaseApprovals } = require('../services/releaseApprovalService');
const prisma = require('../config/db');

const base = { pageStyles: ['admin'], pageScripts: ['admin'] };

exports.dashboard = async (req, res, next) => {
  try {
    const counts = await adminQueries.getDashboardStats();

    const data = await mock.getAdminOverview();
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

exports.users = async (req, res) => {
  const data = await mock.getAdminUsers();
  res.render('admin/users', { ...base, title: 'Users & approvals', data });
};

exports.decision = async (req, res, next) => {
  const userId = req.params.userId;
  const decision = req.body && req.body.decision;
  const submittedReason = req.body && req.body.reason;
  const reason = typeof submittedReason === 'string' ? submittedReason.trim() : '';

  try {
    if (decision !== 'approved' && decision !== 'rejected') {
      const error = new Error('Choose either approve or reject for this application.');
      error.status = 400;
      throw error;
    }

    let adminId = req.user && req.user.id;
    if (!adminId) {
      const adminResult = await adminQueries.getAdmin();
      adminId = adminResult && adminResult.id;
    }
    if (!adminId) {
      const error = new Error('No admin account is available to record this decision.');
      error.status = 500;
      throw error;
    }

    const result = await prisma.$transaction((transaction) =>
      adminQueries.decidePendingUser(
        transaction,
        userId,
        adminId,
        decision,
        reason
      )
    );

    return res.json({
      success: true,
      decision,
      message: decision === 'approved'
        ? 'Applicant approved and 14-day trial started.'
        : 'Application rejected.',
      trial: result.trial,
    });
  } catch (error) {
    return next(error);
  }
};

exports.content = async (req, res, next) => {
  try {
    const items = await mock.getContentItems();
    return res.render('admin/content', { ...base, title: 'Content management', items });
  } catch (error) {
    return next(error);
  }
};
exports.approveNote = async (req, res, next) => {
  try {
    const noteId = req.params.noteId;
    const actorId = req.user ? req.user.id : null;

    await prisma.$transaction(async (transaction) => {
      const note = await transaction.revision_notes.findUnique({
        where: { id: noteId },
        select: {
          approval_status: true,
          release_id: true,
        },
      });
      if (!note) {
        const error = new Error('Revision note not found.');
        error.status = 404;
        throw error;
      }

      if (note.approval_status !== 'approved') {
        await transaction.revision_notes.update({
          where: { id: noteId },
          data: { approval_status: 'approved' },
        });
        await transaction.audit_events.create({
          data: {
            actor_id: actorId,
            action: 'revision_note.approved',
            target_type: 'revision_note',
            target_id: noteId,
            before_data: { approval_status: note.approval_status },
            after_data: { approval_status: 'approved' },
            reason: null,
          },
        });
      }

      await syncReleaseApprovals(transaction, note.release_id, actorId);
    });
    return res.redirect('/admin/content');
  } catch (error) {
    return next(error);
  }
};

exports.assessments = async (req, res, next) => {
  try {
    const items = await mock.getAssessmentItems();
    return res.render('admin/assessments', { ...base, title: 'Assessment management', items });
  } catch (error) {
    return next(error);
  }
};
exports.approveAssessment = async (req, res, next) => {
  try {
    const questionId = req.params.questionId;
    const actorId = req.user ? req.user.id : null;

    await prisma.$transaction(async (transaction) => {
      const question = await transaction.questions.findUnique({
        where: { id: questionId },
        select: { approval_status: true },
      });
      if (!question) {
        const error = new Error('Assessment question not found.');
        error.status = 404;
        throw error;
      }

      await transaction.questions.update({
        where: { id: questionId },
        data: { approval_status: 'approved' },
      });

      if (question.approval_status !== 'approved') {
        await transaction.audit_events.create({
          data: {
            actor_id: actorId,
            action: 'question.approved',
            target_type: 'question',
            target_id: questionId,
            before_data: { approval_status: question.approval_status },
            after_data: { approval_status: 'approved' },
            reason: null,
          },
        });
      }

      const linkedAssessmentItems = await transaction.assessment_items.findMany({
        where: { question_id: questionId },
        select: {
          assessment_id: true,
          assessments: {
            select: { release_id: true },
          },
        },
      });
      const assessmentIds = [
        ...new Set(linkedAssessmentItems.map((item) => item.assessment_id)),
      ];
      const releaseIds = [
        ...new Set(
          linkedAssessmentItems
            .map((item) => item.assessments.release_id)
            .filter(Boolean)
        ),
      ];

      for (const assessmentId of assessmentIds) {
        const items = await transaction.assessment_items.findMany({
          where: { assessment_id: assessmentId },
          select: {
            questions: {
              select: { approval_status: true },
            },
          },
        });
        const allQuestionsApproved =
          items.length > 0 &&
          items.every((item) => item.questions.approval_status === 'approved');

        if (allQuestionsApproved) {
          const result = await transaction.assessments.updateMany({
            where: { id: assessmentId, status: 'draft' },
            data: { status: 'approved' },
          });
          if (result.count > 0) {
            await transaction.audit_events.create({
              data: {
                actor_id: actorId,
                action: 'assessment.approved',
                target_type: 'assessment',
                target_id: assessmentId,
                before_data: { status: 'draft' },
                after_data: { status: 'approved' },
                reason: 'All assessment questions are approved.',
              },
            });
          }
        }
      }

      for (const releaseId of releaseIds) {
        await syncReleaseApprovals(transaction, releaseId, actorId);
      }
    });
    return res.redirect('/admin/assessments');
  } catch (error) {
    if (error.code === 'P2025') {
      error.status = 404;
      error.message = 'Assessment question not found.';
    }
    return next(error);
  }
};
exports.releases = async (req, res, next) => {
  try {
    const releases = await mock.getReleases();
    return res.render('admin/releases', { ...base, title: 'Release management', releases });
  } catch (error) {
    return next(error);
  }
};

exports.auditLogs = async (req, res, next) => {
  try {
    const logs = await mock.getAuditLogs();
    return res.render('admin/audit-logs', { ...base, title: 'Audit log', logs });
  } catch (error) {
    return next(error);
  }
};

exports.settings = (req, res) =>
  res.render('admin/settings', { ...base, title: 'Settings', settings: mock.getAdminSettings() });


exports.contentPreview = async (req, res, next) => {
  try {
    const note = await mock.getRevisionNotePreview(req.params.noteId);
    return res.render('admin/content-preview', {
      ...base,
      title: `Preview: ${note.stableId}`,
      note,
    });
  } catch (error) {
    return next(error);
  }
};

exports.assessmentPreview = async (req, res, next) => {
  try {
    const assessment = await mock.getAssessmentPreview(req.params.assessmentId);
    if (!assessment) {
      const error = new Error('Assessment question not found.');
      error.status = 404;
      throw error;
    }

    return res.render('admin/assessment-preview', {
      ...base,
      title: `Preview: ${assessment.questionId}`,
      assessment,
    });
  } catch (error) {
    return next(error);
  }
};