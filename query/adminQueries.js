'use strict';

const prisma = require('../config/db');

const pendingApprovalWhere = {
  account_state: 'pending_approval',
  // consents: { some: { consent_type: 'terms', withdrawn_at: null } },
  // AND: [{ consents: { some: { consent_type: 'privacy', withdrawn_at: null } } }],
};

exports.getDashboardStats = async () => {
  const [totalUsers, pendingApprovals, activeTrials, paidLearners, expiredLearners] =
    await Promise.all([
      prisma.users.count(),
      prisma.users.count({ where: pendingApprovalWhere }),
      prisma.users.count({ where: { account_state: 'trial_active' } }),
      prisma.users.count({ where: { account_state: 'paid_active' } }),
      prisma.users.count({ where: { account_state: 'trial_expired' } }),
    ]);

  return {
    total_users: totalUsers,
    pending_approvals: pendingApprovals,
    active_trials: activeTrials,
    paid_learners: paidLearners,
    expired_learners: expiredLearners,
  };
};

exports.getPendingApprovals = async () =>
  prisma.users.findMany({
    where: pendingApprovalWhere,
    orderBy: { created_at: 'asc' },
  });

exports.getAdmin = async () =>
  prisma.users.findFirst({
    where: { role: 'admin_publisher' },
    select: { id: true },
  });

exports.getAllUser = async () =>
  prisma.users.findMany({
    where: { role: { notIn: ['admin_publisher', 'content_editor'] } },
    orderBy: { created_at: 'asc' },
    include: {
      trials: {
        where: { state: 'active' },
        orderBy: { ends_at: 'desc' },
        take: 1,
      },
      subscriptions: {
        where: { status: 'active' },
        orderBy: { ends_at: 'desc' },
        take: 1,
        include: { plans: true },
      },
      leaderboard_profiles: true,
    },
  });

exports.decidePendingUser = async (prismaTransaction, userId, adminId, decision, reason) => {
  const nextAccountState = decision === 'approved' ? 'trial_active' : 'rejected';
  const updateResult = await prismaTransaction.users.updateMany({
    where: { id: userId, account_state: 'pending_approval' },
    data: {
      account_state: nextAccountState,
      ...(decision === 'approved' ? { role: 'approved_trial_learner' } : {}),
      updated_at: new Date(),
    },
  });

  if (!updateResult.count) {
    const user = await prismaTransaction.users.findUnique({
      where: { id: userId },
      select: { id: true, account_state: true },
    });
    if (!user) {
      const error = new Error('The applicant could not be found.');
      error.status = 404;
      throw error;
    }

    const error = new Error('The applicant is no longer awaiting approval.');
    error.status = 409;
    throw error;
  }

  let trial = null;
  if (decision === 'approved') {
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    trial = await prismaTransaction.trials.create({
      data: { user_id: userId, starts_at: startsAt, ends_at: endsAt, state: 'active' },
      select: { starts_at: true, ends_at: true },
    });
  }

  await prismaTransaction.access_approvals.create({
    data: {
      user_id: userId,
      admin_id: adminId,
      decision,
      reason: reason || null,
    },
  });

  return { status: 'ok', trial };
};
