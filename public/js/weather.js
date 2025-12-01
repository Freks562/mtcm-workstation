/**
 * Weather Dashboard JavaScript
 */

// State
let currentCity = '';
let currentUnits = 'metric';
let alertPrecipMm = 10;
let bookmarks = [];
let forecastChart = null;

// DOM Elements
const cityInput = document.getElementById('city-input');
const unitsSelect = document.getElementById('units-select');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const bookmarkBtn = document.getElementById('bookmark-btn');
const alertInput = document.getElementById('alert-threshold');
const bookmarksList = document.getElementById('bookmarks-list');
const currentWeatherSection = document.getElementById('current-weather');
const forecastSection = document.getElementById('forecast-section');
const chartSection = document.getElementById('chart-section');
const errorMessage = document.getElementById('error-message');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  loadBookmarks();
  renderBookmarks();
  
  try {
    // Load config from server
    const config = await fetchConfig();
    currentCity = config.defaultCity;
    currentUnits = config.defaultUnits;
    alertPrecipMm = config.alertPrecipMm;
    
    cityInput.value = currentCity;
    unitsSelect.value = currentUnits;
    alertInput.value = alertPrecipMm;
    
    // Fetch weather for default city
    await fetchWeatherData(currentCity);
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
  
  // Event listeners
  searchBtn.addEventListener('click', handleSearch);
  locationBtn.addEventListener('click', handleUseLocation);
  bookmarkBtn.addEventListener('click', handleBookmark);
  alertInput.addEventListener('change', handleAlertChange);
  unitsSelect.addEventListener('change', handleUnitsChange);
  cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
}

// API Calls
async function fetchConfig() {
  const response = await fetch('/api/weather/config');
  if (!response.ok) throw new Error('Failed to fetch config');
  return response.json();
}

async function fetchWeather(params) {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`/api/weather?${queryString}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch weather');
  }
  return response.json();
}

async function fetchForecast(params) {
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(`/api/forecast?${queryString}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch forecast');
  }
  return response.json();
}

// Event Handlers
async function handleSearch() {
  const city = cityInput.value.trim();
  if (!city) {
    showError('Please enter a city name');
    return;
  }
  await fetchWeatherData(city);
}

async function handleUseLocation() {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser');
    return;
  }
  
  locationBtn.disabled = true;
  locationBtn.textContent = 'Getting location...';
  
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
    
    const { latitude: lat, longitude: lon } = position.coords;
    await fetchWeatherDataByCoords(lat, lon);
  } catch (error) {
    showError('Unable to get your location. Please allow location access.');
  } finally {
    locationBtn.disabled = false;
    locationBtn.textContent = '📍 Use My Location';
  }
}

function handleBookmark() {
  if (!currentCity) {
    showError('No city to bookmark');
    return;
  }
  
  const normalizedCity = currentCity.toLowerCase();
  if (!bookmarks.find(b => b.toLowerCase() === normalizedCity)) {
    bookmarks.push(currentCity);
    saveBookmarks();
    renderBookmarks();
  }
}

function handleAlertChange() {
  alertPrecipMm = parseFloat(alertInput.value) || 10;
  // Re-render forecast cards with new threshold
  const forecastCards = document.querySelectorAll('.forecast-card');
  forecastCards.forEach(card => {
    const precipValue = parseFloat(card.dataset.precip) || 0;
    if (precipValue >= alertPrecipMm) {
      card.classList.add('alert');
    } else {
      card.classList.remove('alert');
    }
  });
}

async function handleUnitsChange() {
  currentUnits = unitsSelect.value;
  if (currentCity) {
    await fetchWeatherData(currentCity);
  }
}

// Data Fetching
async function fetchWeatherData(city) {
  hideError();
  showLoading();
  
  try {
    const params = { city, units: currentUnits };
    const [weather, forecast] = await Promise.all([
      fetchWeather(params),
      fetchForecast(params)
    ]);
    
    currentCity = weather.name;
    cityInput.value = currentCity;
    
    renderCurrentWeather(weather);
    renderForecast(forecast);
    renderChart(forecast);
  } catch (error) {
    showError(error.message);
    hideWeatherSections();
  } finally {
    hideLoading();
  }
}

async function fetchWeatherDataByCoords(lat, lon) {
  hideError();
  showLoading();
  
  try {
    const params = { lat, lon, units: currentUnits };
    const [weather, forecast] = await Promise.all([
      fetchWeather(params),
      fetchForecast(params)
    ]);
    
    currentCity = weather.name;
    cityInput.value = currentCity;
    
    renderCurrentWeather(weather);
    renderForecast(forecast);
    renderChart(forecast);
  } catch (error) {
    showError(error.message);
    hideWeatherSections();
  } finally {
    hideLoading();
  }
}

// Rendering
function renderCurrentWeather(data) {
  const tempUnit = currentUnits === 'metric' ? '°C' : '°F';
  const speedUnit = currentUnits === 'metric' ? 'm/s' : 'mph';
  
  document.getElementById('location-name').textContent = `${data.name}, ${data.sys.country}`;
  document.getElementById('weather-description').textContent = data.weather[0].description;
  document.getElementById('current-temp').textContent = `${Math.round(data.main.temp)}${tempUnit}`;
  document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
  document.getElementById('weather-icon').alt = data.weather[0].description;
  
  document.getElementById('feels-like').textContent = `${Math.round(data.main.feels_like)}${tempUnit}`;
  document.getElementById('humidity').textContent = `${data.main.humidity}%`;
  document.getElementById('wind-speed').textContent = `${data.wind.speed} ${speedUnit}`;
  document.getElementById('clouds').textContent = `${data.clouds.all}%`;
  
  currentWeatherSection.classList.add('visible');
}

function renderForecast(data) {
  const forecastCards = document.getElementById('forecast-cards');
  const tempUnit = currentUnits === 'metric' ? '°C' : '°F';
  
  forecastCards.innerHTML = data.days.map(day => {
    const date = new Date(day.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isAlert = day.precip_mm >= alertPrecipMm;
    
    return `
      <div class="forecast-card ${isAlert ? 'alert' : ''}" data-precip="${day.precip_mm}">
        <div class="day">${dayName}</div>
        <div class="date">${dateStr}</div>
        <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.description}">
        <div class="temps">
          <span class="temp-max">${Math.round(day.temp_max)}${tempUnit}</span>
          <span class="temp-min">${Math.round(day.temp_min)}${tempUnit}</span>
        </div>
        <div class="precip">💧 ${day.precip_mm} mm</div>
        <div class="clouds">☁️ ${day.clouds_avg}%</div>
      </div>
    `;
  }).join('');
  
  forecastSection.classList.add('visible');
}

function renderChart(data) {
  const ctx = document.getElementById('weather-chart').getContext('2d');
  const tempUnit = currentUnits === 'metric' ? '°C' : '°F';
  
  const labels = data.days.map(day => {
    const date = new Date(day.date);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  });
  
  // Destroy existing chart if any
  if (forecastChart) {
    forecastChart.destroy();
  }
  
  forecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: `Max Temp (${tempUnit})`,
          data: data.days.map(d => d.temp_max),
          borderColor: '#dc3545',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y-temp',
          order: 1
        },
        {
          type: 'line',
          label: `Min Temp (${tempUnit})`,
          data: data.days.map(d => d.temp_min),
          borderColor: '#007bff',
          backgroundColor: 'rgba(0, 123, 255, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y-temp',
          order: 2
        },
        {
          type: 'bar',
          label: 'Precipitation (mm)',
          data: data.days.map(d => d.precip_mm),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          yAxisID: 'y-precip',
          order: 3
        },
        {
          type: 'line',
          label: 'Clouds (%)',
          data: data.days.map(d => d.clouds_avg),
          borderColor: '#6c757d',
          backgroundColor: 'rgba(108, 117, 125, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          yAxisID: 'y-clouds',
          order: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top'
        },
        title: {
          display: true,
          text: '5-Day Weather Forecast'
        }
      },
      scales: {
        'y-temp': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: `Temperature (${tempUnit})`
          }
        },
        'y-precip': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Precipitation (mm)'
          },
          grid: {
            drawOnChartArea: false
          },
          min: 0
        },
        'y-clouds': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Clouds (%)'
          },
          grid: {
            drawOnChartArea: false
          },
          min: 0,
          max: 100,
          display: false
        }
      }
    }
  });
  
  chartSection.classList.add('visible');
}

// Bookmarks
function loadBookmarks() {
  const stored = localStorage.getItem('weather-bookmarks');
  bookmarks = stored ? JSON.parse(stored) : [];
}

function saveBookmarks() {
  localStorage.setItem('weather-bookmarks', JSON.stringify(bookmarks));
}

function renderBookmarks() {
  bookmarksList.innerHTML = '';
  
  if (bookmarks.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No bookmarked cities yet';
    bookmarksList.appendChild(emptyState);
    return;
  }
  
  bookmarks.forEach(city => {
    const chip = document.createElement('div');
    chip.className = 'bookmark-chip';
    
    const citySpan = document.createElement('span');
    citySpan.textContent = city;
    chip.appendChild(citySpan);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-bookmark';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBookmark(city);
    });
    chip.appendChild(removeBtn);
    
    chip.addEventListener('click', () => selectBookmark(city));
    bookmarksList.appendChild(chip);
  });
}

function selectBookmark(city) {
  cityInput.value = city;
  fetchWeatherData(city);
}

function removeBookmark(city) {
  bookmarks = bookmarks.filter(b => b !== city);
  saveBookmarks();
  renderBookmarks();
}

// Utility
function showLoading() {
  document.body.classList.add('loading-state');
}

function hideLoading() {
  document.body.classList.remove('loading-state');
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('visible');
}

function hideError() {
  errorMessage.classList.remove('visible');
}

function hideWeatherSections() {
  currentWeatherSection.classList.remove('visible');
  forecastSection.classList.remove('visible');
  chartSection.classList.remove('visible');
}
