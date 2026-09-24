const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      // profile contains: id, displayName, emails, photos
      // Look up or create the user in your database here
      const user = {
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        photo: profile.photos[0].value,
      };

      // Example placeholder — replace with real DB lookup:
      // let existingUser = await User.findOne({ googleId: profile.id });
      // if (!existingUser) existingUser = await User.create(user);

      return done(null, user);
    }
  )
);

// Store user in session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Retrieve user from session
passport.deserializeUser((user, done) => {
  done(null, user);
});

module.exports = passport;