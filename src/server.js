require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');
const passport = require('passport');

const logger = require('./services/logger');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { configurePassport } = require('./config/passport');
const { sessionConfig } = require('./config/session');

// Import routes
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const weatherRoutes = require('./routes/weather');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');
const federalRoutes = require('./routes/federal');

const app = express();

// Trust proxy for deployment behind reverse proxies
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
      fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
      scriptSrc: ['\'self\'', 'https://www.google.com', 'https://www.gstatic.com'],
      frameSrc: ['https://www.google.com'],
      imgSrc: ['\'self\'', 'data:', 'https:'],
      connectSrc: ['\'self\'', 'https://api.openweathermap.org']
    }
  }
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session(sessionConfig()));

// Passport authentication
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(createRateLimiter());

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/weather', weatherRoutes);
app.use('/contact', contactRoutes);
app.use('/admin', adminRoutes);
app.use('/federal', federalRoutes);

// Home route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'MTCM Portal',
    description: 'Mountaintop Technology Comm - Secure SDVOSB Portal'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Not Found',
    message: 'The page you are looking for does not exist.',
    error: { status: 404 }
  });
});

// Error handler
app.use((err, req, res, _next) => {
  logger.error('Application error:', err);
  res.status(err.status || 500).render('error', {
    title: 'Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

const PORT = process.env.PORT || 3000;

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`MTCM Portal server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
