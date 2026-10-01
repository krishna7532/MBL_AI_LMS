const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const userQueries = require('../query/userQueries');

function mapUser(row) {
  return {
    id: row.id,
    googleSubject: row.google_subject,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    accountState: row.account_state,
    createdAt: row.created_at,
  };
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleSubject = profile.id;
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        const name = profile.displayName || [
          profile.name && profile.name.givenName,
          profile.name && profile.name.familyName,
        ].filter(Boolean).join(' ');

        if (!googleSubject || !email || !name) {
          return done(new Error('Google did not provide the required subject, name, and email.'));
        }

        const result = await userQueries.upsertGoogleUser(googleSubject, name, email);
        console.log(result);
        return done(null, mapUser(result.rows[0]));
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (userId, done) => {
  try {
    const result = await userQueries.getUserById(userId);
    done(null, result.rows[0] ? mapUser(result.rows[0]) : null);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;