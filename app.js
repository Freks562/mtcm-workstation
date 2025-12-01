require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const leadRoutes = require('./src/routes/lead');
const contactRoutes = require('./src/routes/contact');
const adminRoutes = require('./src/routes/admin');
const { requestLogger } = require('./src/middleware/requestLogger');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Request logging middleware
app.use(requestLogger);

// Trust proxy for accurate IP detection behind load balancers
app.set('trust proxy', 1);

// Routes
app.use('/lead', leadRoutes);
app.use('/contact', contactRoutes);
app.use('/admin', adminRoutes);

// Home route
app.get('/', (req, res) => {
  res.render('index', { title: 'MTCM Portal' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error', { 
    title: 'Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    title: 'Not Found',
    message: 'Page not found'
  });
});

// Only start server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
