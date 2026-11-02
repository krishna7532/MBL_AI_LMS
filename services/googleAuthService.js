'use strict';

// Validates Google profile details and retrieves or creates the matching user.
async function resolveGoogleAccount(profile, prisma, userQueries) {
  const googleSubject = profile.id;
  const email = profile.emails && profile.emails[0] && profile.emails[0].value;
  const name = profile.displayName || [
    profile.name && profile.name.givenName,
    profile.name && profile.name.familyName,
  ].filter(Boolean).join(' ');

  if (!googleSubject || !email || !name) {
    throw new Error('Google did not provide the required subject, name, and email.');
  }

  const existingUser = await userQueries.getUserByGoogleSubject(prisma, googleSubject);
  const savedUser = await userQueries.upsertGoogleUser(prisma, googleSubject, name, email);
  const user = await userQueries.getUserById(prisma, savedUser.id);
  if (!user) {
    throw new Error('The authenticated Google account has no database user record.');
  }

  return { user, isNewUser: !existingUser };
}

module.exports = { resolveGoogleAccount };
