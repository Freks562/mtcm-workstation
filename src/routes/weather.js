const express = require('express');
const router = express.Router();
const { createApiRateLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');
const weatherService = require('../services/weather');

// Apply API rate limiting
router.use(createApiRateLimiter());

/**
 * Weather dashboard page
 * GET /weather
 */
router.get('/', requireAuth, (req, res) => {
  res.render('weather/index', {
    title: 'Weather Dashboard - MTCM Portal',
    user: req.user,
    bookmarks: weatherService.getBookmarks(req.user.id)
  });
});

/**
 * Get current weather for a location
 * GET /weather/current
 */
router.get('/current', requireAuth, async (req, res) => {
  try {
    const { lat, lon, city } = req.query;
    
    if (!lat && !lon && !city) {
      return res.status(400).json({ 
        error: 'Location required', 
        message: 'Please provide lat/lon or city name' 
      });
    }

    const weather = await weatherService.getCurrentWeather({ lat, lon, city });
    res.json(weather);
  } catch (err) {
    res.status(err.status || 500).json({ 
      error: 'Weather fetch failed', 
      message: err.message 
    });
  }
});

/**
 * Get weather forecast
 * GET /weather/forecast
 */
router.get('/forecast', requireAuth, async (req, res) => {
  try {
    const { lat, lon, city, days = 5 } = req.query;
    
    if (!lat && !lon && !city) {
      return res.status(400).json({ 
        error: 'Location required', 
        message: 'Please provide lat/lon or city name' 
      });
    }

    const forecast = await weatherService.getForecast({ lat, lon, city, days: parseInt(days) });
    res.json(forecast);
  } catch (err) {
    res.status(err.status || 500).json({ 
      error: 'Forecast fetch failed', 
      message: err.message 
    });
  }
});

/**
 * Get weather alerts
 * GET /weather/alerts
 */
router.get('/alerts', requireAuth, async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ 
        error: 'Location required', 
        message: 'Please provide lat/lon coordinates' 
      });
    }

    const alerts = await weatherService.getAlerts({ lat, lon });
    res.json(alerts);
  } catch (err) {
    res.status(err.status || 500).json({ 
      error: 'Alerts fetch failed', 
      message: err.message 
    });
  }
});

/**
 * Save location bookmark
 * POST /weather/bookmarks
 */
router.post('/bookmarks', requireAuth, (req, res) => {
  try {
    const { name, lat, lon, city, country } = req.body;
    
    if (!name || (!lat && !city)) {
      return res.status(400).json({ 
        error: 'Invalid bookmark', 
        message: 'Please provide name and location' 
      });
    }

    const bookmark = weatherService.addBookmark(req.user.id, {
      name,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      city,
      country
    });
    
    res.status(201).json(bookmark);
  } catch (err) {
    res.status(400).json({ 
      error: 'Bookmark failed', 
      message: err.message 
    });
  }
});

/**
 * Get user's location bookmarks
 * GET /weather/bookmarks
 */
router.get('/bookmarks', requireAuth, (req, res) => {
  const bookmarks = weatherService.getBookmarks(req.user.id);
  res.json(bookmarks);
});

/**
 * Delete a bookmark
 * DELETE /weather/bookmarks/:id
 */
router.delete('/bookmarks/:id', requireAuth, (req, res) => {
  const deleted = weatherService.deleteBookmark(req.user.id, req.params.id);
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Bookmark not found' });
  }
});

/**
 * Geolocate by IP
 * GET /weather/geolocate
 */
router.get('/geolocate', requireAuth, async (req, res) => {
  try {
    const location = await weatherService.geolocateByIP(req.ip);
    res.json(location);
  } catch (err) {
    res.status(500).json({ 
      error: 'Geolocation failed', 
      message: err.message 
    });
  }
});

module.exports = router;
