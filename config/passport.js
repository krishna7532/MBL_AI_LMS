const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();
const prisma = require('./db');
const userQueries = require('../query/userQueries');
const googleAuthService = require('../services/googleAuthService');

// Converts database user details to the session-safe Passport user object.
function mapUser(row) {
  const consentMap = {};
  for (const consent of Array.isArray(row.consents) ? row.consents : []) {
    consentMap[consent.consent_type] = {
      version: consent.policy_version,
      date: consent.accepted_at,
    };
  }

  const activeTrial = Array.isArray(row.trials) && row.trials.length
    ? row.trials[0]
    : null;

  const activeSubscription = Array.isArray(row.subscriptions) && row.subscriptions.length
    ? row.subscriptions[0]
    : null;

  const trial = activeTrial
    ? {
        startDate: activeTrial.starts_at,
        endDate: activeTrial.ends_at,
        daysRemaining: Math.max(
          0,
          Math.ceil((new Date(activeTrial.ends_at) - new Date()) / (1000 * 60 * 60 * 24))
        ),
        isActive: new Date() >= new Date(activeTrial.starts_at) && new Date() < new Date(activeTrial.ends_at),
      }
    : {
        startDate: null,
        endDate: null,
        daysRemaining: 0,
        isActive: false,
      };

  const emptyConsent = { version: '—', date: null };

  return {
    id: row.id,
    googleSubject: row.google_subject,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    accountState: row.account_state,
    createdAt: row.created_at,
    trial,
    consents: {
      terms: consentMap.terms || emptyConsent,
      privacy: consentMap.privacy || emptyConsent,
      leaderboard: consentMap.leaderboard || emptyConsent,
      marketing: consentMap.marketing || emptyConsent,
    },
    leaderboardAlias: row.leaderboard_profiles?.handle || null,
    leaderboardOptIn: row.leaderboard_profiles?.status === 'opted_in',
    subscriptionActive: Boolean(
      activeSubscription &&
      new Date() >= new Date(activeSubscription.starts_at) &&
      new Date() < new Date(activeSubscription.ends_at)
    ),
  };
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    // Resolves Google identity against the application user database.
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { user, isNewUser } = await googleAuthService.resolveGoogleAccount(
          profile,
          prisma,
          userQueries
        );
        return done(null, {
          ...mapUser(user),
          isNewUser,
        });
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  // Stores only the stable user ID in the session.
  done(null, user.id);
});

// Reloads current user roles and entitlements for each authenticated request.
passport.deserializeUser(async (userId, done) => {
  try {
    const result = await userQueries.getUserById(prisma, userId);
    done(null, result ? mapUser(result) : null);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;