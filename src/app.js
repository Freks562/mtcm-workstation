const express = require('express');
const path = require('path');
const config = require('./config');
const weatherRoutes = require('./routes/weather');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', weatherRoutes);

// Serve the weather page
app.get('/weather', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/weather.html'));
});

// Home page redirects to weather
app.get('/', (req, res) => {
  res.redirect('/weather');
});

module.exports = app;
