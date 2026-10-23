'use strict';

exports.getActiveConsents = async (prisma, userId) =>
  prisma.consents.findMany({
    where: {
      user_id: userId,
      consent_type: { in: ['terms', 'privacy'] },
      withdrawn_at: null,
    },
    select: { consent_type: true },
  });

exports.insertConsent = async (prisma, userId, consentType, policyVersion) =>
  prisma.consents.create({
    data: {
      user_id: userId,
      consent_type: consentType,
      policy_version: policyVersion,
      accepted_at: new Date(),
    },
  });
