const express = require('express');
const router = express.Router();
const config = require('../config');
const weatherService = require('../services/weather');

/**
 * GET /api/weather
 * Get current weather for a city or coordinates
 * Query params: city OR (lat, lon), units (optional)
 */
router.get('/weather', async (req, res) => {
  try {
    const { city, lat, lon, units } = req.query;
    
    if (!city && (lat === undefined || lon === undefined)) {
      return res.status(400).json({ 
        error: 'Either city or lat/lon coordinates are required' 
      });
    }
    
    const params = { units };
    if (city) {
      params.city = city;
    } else {
      params.lat = parseFloat(lat);
      params.lon = parseFloat(lon);
    }
    
    const weather = await weatherService.getCurrentWeather(params);
    res.json(weather);
  } catch (error) {
    console.error('Weather API error:', error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'City not found' });
    }
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

/**
 * GET /api/forecast
 * Get 5-day forecast for a city or coordinates (aggregated daily)
 * Query params: city OR (lat, lon), units (optional)
 */
router.get('/forecast', async (req, res) => {
  try {
    const { city, lat, lon, units } = req.query;
    
    if (!city && (lat === undefined || lon === undefined)) {
      return res.status(400).json({ 
        error: 'Either city or lat/lon coordinates are required' 
      });
    }
    
    const params = { units };
    if (city) {
      params.city = city;
    } else {
      params.lat = parseFloat(lat);
      params.lon = parseFloat(lon);
    }
    
    const forecast = await weatherService.getForecast(params);
    res.json(forecast);
  } catch (error) {
    console.error('Forecast API error:', error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'City not found' });
    }
    res.status(500).json({ error: 'Failed to fetch forecast data' });
  }
});

/**
 * GET /api/weather/config
 * Get default weather configuration
 */
router.get('/weather/config', (req, res) => {
  res.json({
    defaultCity: config.weatherDefaults.city,
    defaultUnits: config.weatherDefaults.units,
    alertPrecipMm: config.weatherDefaults.alertPrecipMm
  });
});

module.exports = router;
