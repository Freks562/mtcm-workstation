const GoogleStrategy = require('passport-google-oauth20').Strategy;
const logger = require('../services/logger');

// In-memory user store (replace with database in production)
const users = new Map();

function configurePassport(passport) {
  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser((id, done) => {
    const user = users.get(id);
    done(null, user || null);
  });

  // Google OAuth 2.0 Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
      scope: ['profile', 'email']
    }, (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const adminEmails = (process.env.ADMIN_EMAIL || '').split(',').map(e => e.trim().toLowerCase());
        
        const user = {
          id: profile.id,
          googleId: profile.id,
          email: email,
          displayName: profile.displayName,
          firstName: profile.name?.givenName,
          lastName: profile.name?.familyName,
          photo: profile.photos?.[0]?.value,
          isAdmin: adminEmails.includes(email?.toLowerCase()),
          isOwner: adminEmails[0] === email?.toLowerCase(),
          createdAt: new Date(),
          lastLogin: new Date()
        };

        // Update or create user
        const existingUser = users.get(user.id);
        if (existingUser) {
          user.createdAt = existingUser.createdAt;
        }
        users.set(user.id, user);

        logger.info(`User authenticated: ${user.email} (Admin: ${user.isAdmin})`);
        return done(null, user);
      } catch (err) {
        logger.error('Google authentication error:', err);
        return done(err, null);
      }
    }));

    logger.info('Google OAuth strategy configured');
  } else {
    logger.warn('Google OAuth credentials not configured - authentication disabled');
  }
}

// Get user by ID
function getUserById(id) {
  return users.get(id);
}

// Get all users (for admin)
function getAllUsers() {
  return Array.from(users.values());
}

module.exports = {
  configurePassport,
  getUserById,
  getAllUsers
};
