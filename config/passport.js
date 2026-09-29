const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

function buildGoogleUser(profile) {
  const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
  const primaryName = profile.displayName || [profile.name && profile.name.givenName, profile.name && profile.name.familyName].filter(Boolean).join(' ') || 'Google User';
  const givenName = (profile.name && profile.name.givenName) || primaryName.split(' ')[0] || 'Learner';
  const aliasPrefix = (profile.displayName || givenName || 'learner').replace(/\s+/g, '').slice(0, 14) || 'learner';

  return {
    _id: `google_${profile.id}`,
    googleId: profile.id,
    name: primaryName,
    email: email || `${profile.id}@google.local`,
    phone: '',
    role: 'approved_trial_learner',
    accountState: 'trial_active',
    avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
    leaderboardAlias: `${aliasPrefix}_${profile.id.slice(-5)}`,
    leaderboardOptIn: true,
    trial: {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 14,
      isActive: true,
    },
    consents: {
      terms: { accepted: true, version: 'google-oauth', date: new Date().toISOString().slice(0, 10) },
      privacy: { accepted: true, version: 'google-oauth', date: new Date().toISOString().slice(0, 10) },
    },
    createdAt: new Date().toISOString(),
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
        const user = buildGoogleUser(profile);
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user || null);
});

module.exports = passport;  