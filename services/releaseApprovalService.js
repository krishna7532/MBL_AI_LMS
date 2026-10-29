'use strict';

async function syncReleaseApprovals(transaction, releaseId, actorId) {
  const release = await transaction.content_releases.findUnique({
    where: { id: releaseId },
    select: {
      status: true,
      notes_approval_status: true,
      assessment_approval_status: true,
      revision_notes: {
        select: { approval_status: true },
      },
      assessments: {
        select: { status: true },
      },
    },
  });
  if (!release) return;

  const notesApprovalStatus = release.revision_notes.length
    ? release.revision_notes.every((note) => note.approval_status === 'approved')
      ? 'approved'
      : 'draft'
    : 'n/a';
  const assessmentApprovalStatus = release.assessments.length
    ? release.assessments.every((assessment) => assessment.status === 'approved')
      ? 'approved'
      : 'draft'
    : 'n/a';
  const approvalsComplete =
    (notesApprovalStatus === 'approved' || notesApprovalStatus === 'n/a') &&
    assessmentApprovalStatus === 'approved';
  const canApproveRelease = !['published', 'retired', 'superseded'].includes(release.status);
  const status = approvalsComplete && canApproveRelease ? 'approved' : release.status;

  if (
    release.notes_approval_status === notesApprovalStatus &&
    release.assessment_approval_status === assessmentApprovalStatus &&
    release.status === status
  ) {
    return;
  }

  await transaction.content_releases.update({
    where: { id: releaseId },
    data: {
      notes_approval_status: notesApprovalStatus,
      assessment_approval_status: assessmentApprovalStatus,
      status,
    },
  });
  await transaction.audit_events.create({
    data: {
      actor_id: actorId,
      action: 'content_release.approvals_updated',
      target_type: 'content_release',
      target_id: releaseId,
      before_data: {
        notes_approval_status: release.notes_approval_status,
        assessment_approval_status: release.assessment_approval_status,
        status: release.status,
      },
      after_data: {
        notes_approval_status: notesApprovalStatus,
        assessment_approval_status: assessmentApprovalStatus,
        status,
      },
      reason: null,
    },
  });
}

module.exports = { syncReleaseApprovals };
