require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  openWeatherApiKey: process.env.OPENWEATHERMAP_API_KEY,
  weatherDefaults: {
    city: process.env.WEATHER_DEFAULT_CITY || 'London',
    units: process.env.WEATHER_DEFAULT_UNITS || 'metric',
    alertPrecipMm: parseFloat(process.env.WEATHER_ALERT_PRECIP_MM) || 10
  },
  cacheTtlMs: 5 * 60 * 1000 // 5 minutes
};
