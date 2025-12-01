const request = require('supertest');
const app = require('../src/app');
const cache = require('../src/services/cache');

// Mock axios for API calls
jest.mock('axios');
const axios = require('axios');

// Mock config
jest.mock('../src/config', () => ({
  port: 3000,
  openWeatherApiKey: 'test-api-key',
  weatherDefaults: {
    city: 'London',
    units: 'metric',
    alertPrecipMm: 10
  },
  cacheTtlMs: 5 * 60 * 1000
}));

describe('Weather API Routes', () => {
  beforeEach(() => {
    cache.clear();
    jest.clearAllMocks();
  });

  describe('GET /api/weather/config', () => {
    it('should return weather configuration', async () => {
      const response = await request(app)
        .get('/api/weather/config')
        .expect(200);

      expect(response.body).toEqual({
        defaultCity: 'London',
        defaultUnits: 'metric',
        alertPrecipMm: 10
      });
    });
  });

  describe('GET /api/weather', () => {
    const mockWeatherResponse = {
      data: {
        name: 'London',
        main: { temp: 15, feels_like: 14, humidity: 80 },
        weather: [{ description: 'cloudy', icon: '04d' }],
        wind: { speed: 5 },
        clouds: { all: 75 },
        sys: { country: 'GB' }
      }
    };

    it('should return weather data for a city', async () => {
      axios.get.mockResolvedValue(mockWeatherResponse);

      const response = await request(app)
        .get('/api/weather')
        .query({ city: 'London', units: 'metric' })
        .expect(200);

      expect(response.body.name).toBe('London');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.openweathermap.org/data/2.5/weather',
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'London',
            units: 'metric',
            appid: 'test-api-key'
          })
        })
      );
    });

    it('should return weather data for coordinates', async () => {
      axios.get.mockResolvedValue(mockWeatherResponse);

      const response = await request(app)
        .get('/api/weather')
        .query({ lat: 51.5, lon: -0.1, units: 'metric' })
        .expect(200);

      expect(response.body.name).toBe('London');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.openweathermap.org/data/2.5/weather',
        expect.objectContaining({
          params: expect.objectContaining({
            lat: 51.5,
            lon: -0.1
          })
        })
      );
    });

    it('should return 400 when no city or coordinates provided', async () => {
      const response = await request(app)
        .get('/api/weather')
        .expect(400);

      expect(response.body.error).toBe('Either city or lat/lon coordinates are required');
    });

    it('should return 404 for unknown city', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const response = await request(app)
        .get('/api/weather')
        .query({ city: 'UnknownCity123' })
        .expect(404);

      expect(response.body.error).toBe('City not found');
    });

    it('should use cache for repeated requests', async () => {
      axios.get.mockResolvedValue(mockWeatherResponse);

      // First request
      await request(app)
        .get('/api/weather')
        .query({ city: 'London', units: 'metric' })
        .expect(200);

      // Second request (should use cache)
      await request(app)
        .get('/api/weather')
        .query({ city: 'London', units: 'metric' })
        .expect(200);

      // axios.get should only be called once due to caching
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/forecast', () => {
    const mockForecastResponse = {
      data: {
        city: { name: 'London', country: 'GB' },
        list: [
          {
            dt_txt: '2024-01-15 12:00:00',
            main: { temp: 10 },
            clouds: { all: 50 },
            rain: { '3h': 2 },
            weather: [{ description: 'light rain', icon: '10d' }]
          },
          {
            dt_txt: '2024-01-15 15:00:00',
            main: { temp: 12 },
            clouds: { all: 60 },
            rain: { '3h': 1 },
            weather: [{ description: 'light rain', icon: '10d' }]
          },
          {
            dt_txt: '2024-01-16 12:00:00',
            main: { temp: 8 },
            clouds: { all: 30 },
            weather: [{ description: 'clear', icon: '01d' }]
          }
        ]
      }
    };

    it('should return aggregated forecast data for a city', async () => {
      axios.get.mockResolvedValue(mockForecastResponse);

      const response = await request(app)
        .get('/api/forecast')
        .query({ city: 'London', units: 'metric' })
        .expect(200);

      expect(response.body.city.name).toBe('London');
      expect(response.body.days).toBeInstanceOf(Array);
      expect(response.body.days.length).toBeLessThanOrEqual(5);
      
      // Check aggregation for first day
      const firstDay = response.body.days[0];
      expect(firstDay.date).toBe('2024-01-15');
      expect(firstDay.temp_min).toBe(10);
      expect(firstDay.temp_max).toBe(12);
      expect(firstDay.precip_mm).toBe(3); // 2 + 1
      expect(firstDay.clouds_avg).toBe(55); // (50 + 60) / 2
    });

    it('should return forecast data for coordinates', async () => {
      axios.get.mockResolvedValue(mockForecastResponse);

      const response = await request(app)
        .get('/api/forecast')
        .query({ lat: 51.5, lon: -0.1, units: 'metric' })
        .expect(200);

      expect(response.body.days).toBeInstanceOf(Array);
    });

    it('should return 400 when no city or coordinates provided', async () => {
      const response = await request(app)
        .get('/api/forecast')
        .expect(400);

      expect(response.body.error).toBe('Either city or lat/lon coordinates are required');
    });

    it('should use cache for repeated requests', async () => {
      axios.get.mockResolvedValue(mockForecastResponse);

      // First request
      await request(app)
        .get('/api/forecast')
        .query({ city: 'London', units: 'metric' })
        .expect(200);

      // Second request (should use cache)
      await request(app)
        .get('/api/forecast')
        .query({ city: 'London', units: 'metric' })
        .expect(200);

      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Cache Service', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('should store and retrieve data', () => {
    cache.set('test-key', { data: 'test' });
    expect(cache.get('test-key')).toEqual({ data: 'test' });
  });

  it('should return null for non-existent key', () => {
    expect(cache.get('non-existent')).toBeNull();
  });

  it('should return null for expired data', () => {
    cache.set('expired-key', { data: 'test' }, 1); // 1ms TTL
    
    return new Promise(resolve => {
      setTimeout(() => {
        expect(cache.get('expired-key')).toBeNull();
        resolve();
      }, 10);
    });
  });

  it('should clear all cached data', () => {
    cache.set('key1', { data: 1 });
    cache.set('key2', { data: 2 });
    expect(cache.size()).toBe(2);
    
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
