import { WeatherData } from '../types';

const API_KEY = (import.meta as any).env.VITE_OPENWEATHERMAP_API_KEY;
const WEATHER_CACHE = new Map<string, { data: WeatherData | null; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const getCacheKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

const generateFarmingInsights = (lat: number, lon: number, temp: number, humidity: number, precipitation: number): WeatherData['insights'] => {
  // Determine soil moisture based on humidity and precipitation
  let soilMoistureStatus: 'dry' | 'moderate' | 'wet' = 'moderate';
  if (humidity < 40 || precipitation === 0) soilMoistureStatus = 'dry';
  else if (humidity > 75 || precipitation > 10) soilMoistureStatus = 'wet';

  // Region-specific rainfall patterns for Tanzania
  const isHighlandRegion = lat > -6; // Northern regions
  const rainfallPattern = isHighlandRegion ? 'Unyevu mzuri' : 'Msimu wa baridi';

  return {
    bestPlantingMonth: isHighlandRegion ? 'Novemba - Januari' : 'Disemba - Machi',
    estimatedRainfall: rainfallPattern,
    soilMoistureStatus,
    farmingAdvice: 
      soilMoistureStatus === 'dry' 
        ? 'Msimu ni kavu. Mwagilia mimea yako asubuhi na jioni. Tumia kaburi la mabaki.'
        : soilMoistureStatus === 'wet'
        ? 'Msimu ni wenye unyevu. Hakikisha mifereji ni wazi. Kuzaa sasa kungeziwa kusababisha ugonjwa.'
        : 'Hali ni nzuri kwa kupanda. Endelea na mpango wa upandaji.'
  };
};

const generateAdvancedAlerts = (currentData: any, forecastData: any, insights: WeatherData['insights']): WeatherData['alerts'] => {
  const alerts: WeatherData['alerts'] = [];
  const temp = currentData.main?.temp || 0;
  const humidity = currentData.main?.humidity || 0;
  const windSpeed = currentData.wind?.speed || 0;
  const mainWeather = currentData.weather?.[0]?.main || '';
  const rainProbability = (forecastData.list?.[0]?.pop || 0) * 100;

  if (mainWeather === 'Thunderstorm') {
    alerts.push({
      event: 'Tishio Kubwa la Mvua',
      description: 'Kuna tishio la mvua kubwa na radi.',
      severity: 'high',
    });
  } else if (rainProbability > 70) {
    alerts.push({
      event: 'Tishio la Mvua',
      description: 'Kuna 70%+ uwezekano wa mvua.',
      severity: 'medium',
    });
  }

  if (temp > 38) {
    alerts.push({
      event: 'Jua Kali Sana',
      description: 'Joto limefikia ' + Math.round(temp) + '°C.',
      severity: 'high',
    });
  } else if (temp > 35) {
    alerts.push({
      event: 'Joto Kali',
      description: 'Joto liko la kufanya kazi.',
      severity: 'medium'
    });
  }

  if (humidity < 30) {
    alerts.push({
      event: 'Tishio la Ukame',
      description: 'Unyevu ni chini sana.',
      severity: 'high',
    });
  }

  if (windSpeed > 8) {
    alerts.push({
      event: 'Upepo Kali',
      description: 'Kuna upepo mkali (' + Math.round(windSpeed) + ' m/s).',
      severity: 'medium',
    });
  }

  return alerts;
};

export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData | null> => {
  if (!API_KEY) {
    console.warn("OpenWeatherMap API Key MISSING!", API_KEY);
    return null;
  }

  const cacheKey = getCacheKey(lat, lon);
  const cached = WEATHER_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached weather data');
    return cached.data;
  }

  try {
    console.log('Fetching weather from API for:', lat, lon);
    
    // Current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sw`
    );
    
    if (!currentRes.ok) {
      console.error('Weather API error:', currentRes.status, currentRes.statusText);
      return null;
    }
    
    const currentData = await currentRes.json();
    console.log('Current weather response:', currentData);

    if (!currentData?.weather?.[0]) {
      console.error("Invalid weather data received:", currentData);
      return null;
    }

    // Forecast
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=sw`
    );
    
    if (!forecastRes.ok) {
      console.error('Forecast API error:', forecastRes.status);
      return null;
    }
    
    const forecastData = await forecastRes.json();
    console.log('Forecast response:', forecastData);

    // Hourly
    const hourly = (forecastData.list || []).slice(0, 8).map((item: any) => ({
      time: new Date(item.dt * 1000).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      temp: Math.round(item.main?.temp || 0),
      icon: item.weather?.[0]?.icon || '01d',
      precipitation: item.rain?.['3h'] || 0,
    }));

    // Daily data
    const daily: WeatherData['daily'] = [];
    const uniqueDays = new Map<string, any>();
    (forecastData.list || []).forEach((item: any, idx: number) => {
      if (idx % 8 === 0) { // Every 24 hours
        const date = new Date(item.dt * 1000).toLocaleDateString('sw-TZ');
        if (!uniqueDays.has(date)) {
          uniqueDays.set(date, item);
        }
      }
    });

    uniqueDays.forEach((item: any, date: string) => {
      daily.push({
        date,
        tempMax: Math.round(item.main?.temp_max || 0),
        tempMin: Math.round(item.main?.temp_min || 0),
        description: item.weather[0]?.description || 'Hakuna',
        icon: item.weather[0]?.icon || '01d',
        precipitationProbability: Math.round((item.pop || 0) * 100),
        precipitationAmount: item.rain?.['3h'] || 0,
      });
    });

    const insights = generateFarmingInsights(
      lat, lon,
      currentData.main?.temp || 0,
      currentData.main?.humidity || 0,
      hourly[0]?.precipitation || 0
    );

    const alerts = generateAdvancedAlerts(currentData, forecastData, insights);

    const weatherData: WeatherData = {
      current: {
        temp: Math.round(currentData.main?.temp || 0),
        description: currentData.weather[0].description || 'Hakuna',
        icon: currentData.weather[0].icon || '01d',
        humidity: currentData.main?.humidity || 0,
        windSpeed: Math.round(currentData.wind?.speed || 0),
        pressure: currentData.main?.pressure || 0,
        feelsLike: Math.round(currentData.main?.feels_like || 0),
      },
      daily: daily.slice(0, 5),
      hourly,
      alerts,
      insights,
    };

    console.log('Final weather data:', weatherData);
    WEATHER_CACHE.set(cacheKey, { data: weatherData, timestamp: Date.now() });
    return weatherData;
  } catch (error) {
    console.error("Weather fetch error:", error);
    return null;
  }
};
