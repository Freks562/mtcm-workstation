// Weather Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const citySearch = document.getElementById('city-search');
  const searchBtn = document.getElementById('search-btn');
  const locateBtn = document.getElementById('locate-btn');
  const currentWeatherEl = document.getElementById('current-weather');
  const forecastGrid = document.getElementById('forecast-grid');
  const bookmarksGrid = document.getElementById('bookmarks-grid');
  
  // Search by city
  searchBtn?.addEventListener('click', () => {
    const city = citySearch.value.trim();
    if (city) {
      fetchWeather({ city });
    }
  });
  
  // Enter key search
  citySearch?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const city = citySearch.value.trim();
      if (city) {
        fetchWeather({ city });
      }
    }
  });
  
  // Use geolocation
  locateBtn?.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      locateBtn.textContent = 'Locating...';
      locateBtn.disabled = true;
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeather({ lat: latitude, lon: longitude });
          locateBtn.textContent = '📍 Use My Location';
          locateBtn.disabled = false;
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to get your location. Please search by city instead.');
          locateBtn.textContent = '📍 Use My Location';
          locateBtn.disabled = false;
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });
  
  // Bookmark click handlers
  bookmarksGrid?.addEventListener('click', (e) => {
    const bookmarkCard = e.target.closest('.bookmark-card');
    const deleteBtn = e.target.closest('.delete-bookmark');
    
    if (deleteBtn && bookmarkCard) {
      e.stopPropagation();
      deleteBookmark(bookmarkCard.dataset.id);
    } else if (bookmarkCard) {
      const { lat, lon } = bookmarkCard.dataset;
      if (lat && lon) {
        fetchWeather({ lat, lon });
      }
    }
  });
  
  // Fetch weather data
  async function fetchWeather({ lat, lon, city }) {
    try {
      showLoading(currentWeatherEl);
      
      let url = '/weather/current?';
      if (lat && lon) {
        url += `lat=${lat}&lon=${lon}`;
      } else if (city) {
        url += `city=${encodeURIComponent(city)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch weather');
      }
      
      renderCurrentWeather(data);
      fetchForecast({ lat: data.location.lat, lon: data.location.lon });
    } catch (err) {
      currentWeatherEl.innerHTML = `<div class="weather-error"><p>Error: ${err.message}</p></div>`;
    }
  }
  
  // Fetch forecast
  async function fetchForecast({ lat, lon }) {
    try {
      const response = await fetch(`/weather/forecast?lat=${lat}&lon=${lon}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch forecast');
      }
      
      renderForecast(data);
    } catch (err) {
      forecastGrid.innerHTML = `<div class="weather-error"><p>Error: ${err.message}</p></div>`;
    }
  }
  
  // Render current weather
  function renderCurrentWeather(data) {
    const iconUrl = data.current.icon 
      ? `https://openweathermap.org/img/wn/${data.current.icon}@2x.png` 
      : '';
    
    currentWeatherEl.innerHTML = `
      <div class="current-weather-content">
        <div class="weather-location">
          <h2>${data.location.name}, ${data.location.country}</h2>
          <button class="btn btn-sm btn-outline save-bookmark" 
                  data-lat="${data.location.lat}" 
                  data-lon="${data.location.lon}"
                  data-name="${data.location.name}"
                  data-country="${data.location.country}">
            ★ Save
          </button>
        </div>
        <div class="weather-main">
          ${iconUrl ? `<img src="${iconUrl}" alt="${data.current.description}" class="weather-icon">` : ''}
          <div class="weather-temp">${data.current.temp}°F</div>
        </div>
        <div class="weather-desc">${data.current.description}</div>
        <div class="weather-details">
          <div class="detail">
            <span class="label">Feels like</span>
            <span class="value">${data.current.feelsLike}°F</span>
          </div>
          <div class="detail">
            <span class="label">Humidity</span>
            <span class="value">${data.current.humidity}%</span>
          </div>
          <div class="detail">
            <span class="label">Wind</span>
            <span class="value">${data.current.windSpeed} mph</span>
          </div>
          <div class="detail">
            <span class="label">Visibility</span>
            <span class="value">${data.current.visibility || 'N/A'} mi</span>
          </div>
        </div>
      </div>
    `;
    
    // Add save bookmark handler
    const saveBtn = currentWeatherEl.querySelector('.save-bookmark');
    saveBtn?.addEventListener('click', () => {
      addBookmark({
        name: saveBtn.dataset.name,
        lat: saveBtn.dataset.lat,
        lon: saveBtn.dataset.lon,
        country: saveBtn.dataset.country
      });
    });
  }
  
  // Render forecast
  function renderForecast(data) {
    if (!data.forecast || data.forecast.length === 0) {
      forecastGrid.innerHTML = '<p class="weather-placeholder">No forecast data available</p>';
      return;
    }
    
    forecastGrid.innerHTML = data.forecast.map(day => {
      const iconUrl = day.icon 
        ? `https://openweathermap.org/img/wn/${day.icon}.png` 
        : '';
      
      return `
        <div class="forecast-day">
          <div class="forecast-date">${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          ${iconUrl ? `<img src="${iconUrl}" alt="${day.condition}" class="forecast-icon">` : ''}
          <div class="forecast-temps">
            <span class="temp-high">${day.tempHigh}°</span>
            <span class="temp-low">${day.tempLow}°</span>
          </div>
          <div class="forecast-condition">${day.condition || ''}</div>
        </div>
      `;
    }).join('');
  }
  
  // Add bookmark
  async function addBookmark({ name, lat, lon, country }) {
    try {
      const response = await fetch('/weather/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lat, lon, country })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save bookmark');
      }
      
      // Add to UI
      const noBookmarks = bookmarksGrid.querySelector('.no-bookmarks');
      if (noBookmarks) noBookmarks.remove();
      
      const bookmarkCard = document.createElement('div');
      bookmarkCard.className = 'bookmark-card';
      bookmarkCard.dataset.id = data.id;
      bookmarkCard.dataset.lat = lat;
      bookmarkCard.dataset.lon = lon;
      bookmarkCard.innerHTML = `
        <span class="bookmark-name">${name}</span>
        <button class="btn btn-sm btn-danger delete-bookmark">×</button>
      `;
      bookmarksGrid.appendChild(bookmarkCard);
      
      alert('Location saved!');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
  
  // Delete bookmark
  async function deleteBookmark(id) {
    try {
      const response = await fetch(`/weather/bookmarks/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete bookmark');
      }
      
      // Remove from UI
      const card = bookmarksGrid.querySelector(`[data-id="${id}"]`);
      if (card) card.remove();
      
      // Show empty message if no bookmarks
      if (bookmarksGrid.querySelectorAll('.bookmark-card').length === 0) {
        bookmarksGrid.innerHTML = '<p class="no-bookmarks">No saved locations yet</p>';
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }
  
  // Show loading state
  function showLoading(element) {
    element.innerHTML = '<div class="weather-loading"><p>Loading weather data...</p></div>';
  }
});
