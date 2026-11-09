const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export async function fetchForecast(lat, lon, fetchImpl = fetch) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,precipitation,uv_index,apparent_temperature',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
    past_days: '1',
    wind_speed_unit: 'kmh',
  })
  const response = await fetchImpl(`${FORECAST_URL}?${params}`)
  if (!response.ok) throw new Error(`Open-Meteo respondeu ${response.status}`)
  return response.json()
}

export async function fetchAir(lat, lon, fetchImpl = fetch) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'european_aqi,pm2_5,pm10',
    timezone: 'auto',
  })
  const response = await fetchImpl(`${AIR_URL}?${params}`)
  if (!response.ok) throw new Error(`Open-Meteo (ar) respondeu ${response.status}`)
  return response.json()
}

// Agrupa as horas em dias. `hourly.time` tem o formato "2026-11-09T14:00" no fuso do local.
// Dias anteriores a `today` (o dia extra de past_days) ficam de fora.
export function buildDays(hourly, today) {
  const days = new Map()
  hourly.time.forEach((time, index) => {
    const date = time.slice(0, 10)
    if (date < today) return
    if (!days.has(date)) days.set(date, [])
    days.get(date).push({
      time,
      hour: Number(time.slice(11, 13)),
      temp: hourly.temperature_2m[index],
      feels: hourly.apparent_temperature?.[index] ?? null,
      rainChance: hourly.precipitation_probability?.[index] ?? null,
      precip: hourly.precipitation?.[index] ?? null,
      uv: hourly.uv_index?.[index] ?? null,
    })
  })
  return [...days.entries()].map(([date, hours]) => ({ date, hours }))
}

export const PERIODS = [
  { name: 'Madrugada', range: '00h às 05h', from: 0 },
  { name: 'Manhã', range: '06h às 11h', from: 6 },
  { name: 'Tarde', range: '12h às 17h', from: 12 },
  { name: 'Noite', range: '18h às 23h', from: 18 },
]

export function splitPeriods(hours) {
  return PERIODS.map((period) => ({
    ...period,
    hours: hours.filter((h) => h.hour >= period.from && h.hour < period.from + 6),
  }))
}

// Soma da chuva nas 24 horas até a hora atual (inclusive).
export function rainLast24h(hourly, nowTime) {
  const end = hourly.time.indexOf(nowTime)
  if (end < 0) return null
  let total = 0
  let counted = 0
  for (let i = Math.max(0, end - 23); i <= end; i++) {
    const value = hourly.precipitation?.[i]
    if (value != null) {
      total += value
      counted++
    }
  }
  return counted === 0 ? null : Math.round(total * 10) / 10
}

// "2026-11-09T14:25" -> "2026-11-09T14:00"
export function currentHourKey(currentTime) {
  return `${currentTime.slice(0, 13)}:00`
}

export function valueAtHour(hourly, key, nowTime) {
  const index = hourly.time.indexOf(nowTime)
  return index < 0 ? null : hourly[key]?.[index] ?? null
}

export function summarize(forecast, air) {
  const today = forecast.current.time.slice(0, 10)
  const nowKey = currentHourKey(forecast.current.time)
  const days = buildDays(forecast.hourly, today)
  const sunIndex = forecast.daily.time.indexOf(today)
  return {
    today,
    nowHour: Number(forecast.current.time.slice(11, 13)),
    updatedAt: forecast.current.time.slice(11, 16),
    days,
    now: {
      temp: forecast.current.temperature_2m,
      feels: forecast.current.apparent_temperature,
      humidity: forecast.current.relative_humidity_2m,
      wind: forecast.current.wind_speed_10m,
      rain24h: rainLast24h(forecast.hourly, nowKey),
      uv: valueAtHour(forecast.hourly, 'uv_index', nowKey),
    },
    sun: sunIndex < 0 ? null : {
      rise: forecast.daily.sunrise[sunIndex].slice(11, 16),
      set: forecast.daily.sunset[sunIndex].slice(11, 16),
    },
    air: air?.current ? { eaqi: air.current.european_aqi ?? null, pm25: air.current.pm2_5 ?? null } : null,
  }
}
