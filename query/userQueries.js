'use strict';

// Creates or updates a user from Google identity and returns session fields.
exports.upsertGoogleUser = async (prisma, googleSubject, name, email) =>
  prisma.users.upsert({
    where: { google_subject: googleSubject },
    update: { name, email, updated_at: new Date() },
    create: { google_subject: googleSubject, name, email },
    select: {
      id: true,
      google_subject: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      account_state: true,
      created_at: true,
    },
  });

// Finds the application user linked to a Google subject.
exports.getUserByGoogleSubject = async (prisma, googleSubject) =>
  prisma.users.findUnique({
    where: { google_subject: googleSubject },
    select: { id: true },
  });

// Returns the latest recorded rejection reason for a user.
exports.getReason = async (prisma, userId) => {
  if (!userId) return null;

  const approval = await prisma.access_approvals.findFirst({
    where: { user_id: userId, decision: 'rejected' },
    orderBy: { created_at: 'desc' },
    select: { reason: true },
  });

  return approval?.reason ?? null;
};
// Loads account, trial, consent, leaderboard, and subscription details.
exports.getUserById = async (prisma, userId) =>
  prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      google_subject: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      account_state: true,
      created_at: true,
      trials: {
        where: { state: 'active' },
        orderBy: { starts_at: 'desc' },
        take: 1,
        select: { starts_at: true, ends_at: true, state: true },
      },
      consents: {
        where: { withdrawn_at: null },
        select: { consent_type: true, policy_version: true, accepted_at: true },
      },
      leaderboard_profiles: {
        select: { handle: true, status: true },
      },
      subscriptions: {
        where: {
          status: 'active',
          starts_at: { lte: new Date() },
          ends_at: { gt: new Date() },
        },
        orderBy: { ends_at: 'desc' },
        take: 1,
        select: { starts_at: true, ends_at: true, status: true },
      },
    },
  });

// Locks and reads the user before an application is updated.
exports.getUserForApplication = async (prisma, userId) => {
  await prisma.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

  return prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, account_state: true },
  });
};

// Saves the applicant's phone and marks the application pending review.
exports.updateUserApplication = async (prisma, phone, userId) =>
  prisma.users.update({
    where: { id: userId },
    data: { phone, account_state: 'pending_approval', updated_at: new Date() },
  });
