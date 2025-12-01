# mtcm-portal

Weather Dashboard Portal - A full-featured weather dashboard with 5-day forecasts, charts, and location bookmarking.

## Features

- **Current Weather**: View current weather conditions for any city
- **5-Day Forecast**: See daily aggregated forecasts with min/max temperatures
- **Interactive Charts**: Visualize temperature trends, precipitation, and cloud cover using Chart.js
- **Location Support**: Use your current location or search by city name
- **City Bookmarks**: Save your favorite cities for quick access
- **Unit Switching**: Toggle between metric (°C) and imperial (°F) units
- **Precipitation Alerts**: Set custom thresholds to highlight days with high precipitation

## Setup

### Prerequisites

- Node.js 18+
- OpenWeatherMap API key (get one at https://openweathermap.org/api)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Freks562/mtcm-portal.git
cd mtcm-portal
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Edit `.env` and add your OpenWeatherMap API key:
```
OPENWEATHERMAP_API_KEY=your_api_key_here
WEATHER_DEFAULT_CITY=London
WEATHER_DEFAULT_UNITS=metric
WEATHER_ALERT_PRECIP_MM=10
PORT=3000
```

5. Start the server:
```bash
npm start
```

6. Open http://localhost:3000/weather in your browser

## API Endpoints

### GET /api/weather

Get current weather data for a city or coordinates.

**Query Parameters:**
- `city` - City name (e.g., "London")
- `lat` - Latitude (alternative to city)
- `lon` - Longitude (alternative to city)
- `units` - Temperature units: "metric" or "imperial" (default: from config)

**Response:** OpenWeatherMap weather data with 5-minute cache

### GET /api/forecast

Get 5-day forecast with daily aggregation.

**Query Parameters:**
- `city` - City name
- `lat` - Latitude (alternative to city)
- `lon` - Longitude (alternative to city)
- `units` - Temperature units: "metric" or "imperial"

**Response:**
```json
{
  "city": { "name": "London", "country": "GB" },
  "days": [
    {
      "date": "2024-01-15",
      "temp_min": 5,
      "temp_max": 12,
      "precip_mm": 3.5,
      "clouds_avg": 65,
      "icon": "10d",
      "description": "light rain"
    }
  ]
}
```

### GET /api/weather/config

Get default weather configuration from environment variables.

**Response:**
```json
{
  "defaultCity": "London",
  "defaultUnits": "metric",
  "alertPrecipMm": 10
}
```

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENWEATHERMAP_API_KEY` | API key for OpenWeatherMap | Required |
| `WEATHER_DEFAULT_CITY` | Default city for initial load | London |
| `WEATHER_DEFAULT_UNITS` | Default units (metric/imperial) | metric |
| `WEATHER_ALERT_PRECIP_MM` | Precipitation alert threshold in mm | 10 |
| `PORT` | Server port | 3000 |