'use strict';

exports.getActiveConsents = async (client, userId) =>
  client.query(
    `SELECT consent_type
     FROM consents
     WHERE user_id = $1
       AND consent_type IN ('terms', 'privacy')
       AND withdrawn_at IS NULL`,
    [userId]
  );

exports.insertConsent = async (client, userId, consentType, policyVersion) =>
  client.query(
    `INSERT INTO consents (user_id, consent_type, policy_version, accepted_at)
     VALUES ($1, $2, $3, NOW())`,
    [userId, consentType, policyVersion]
  );
