'use strict';

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
    },
  });

exports.getUserForApplication = async (prisma, userId) => {
  await prisma.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

  return prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, account_state: true },
  });
};

exports.updateUserApplication = async (prisma, phone, userId) =>
  prisma.users.update({
    where: { id: userId },
    data: { phone, account_state: 'pending_approval', updated_at: new Date() },
  });
