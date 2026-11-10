// Dados simulados da rota /teste: um dia de chuva extrema com aviso vermelho.
// Funcionam sem internet e não mexem em nada salvo no aparelho.
import { RAIN_STEP, buildRainGrid, distanceKm } from './map.js'

export const DEMO_PLACE = { id: 'demo', name: 'São Paulo', state: 'São Paulo', lat: -23.55, lon: -46.63 }

export function isDemoRoute(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  return /^\/teste(\/(vermelho|laranja|amarelo|extremo))?\/?$/.test(pathname)
}

const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Intensidade da tempestade por dia (ontem, hoje, amanhã…): começa forte e vai diminuindo.
const INTENSITY = [0.6, 1, 0.8, 0.5, 0.3, 0.15, 0.1, 0.05]

export function buildDemoForecast(now = new Date()) {
  const time = []
  const temperature = []
  const feels = []
  const rainChance = []
  const weatherCode = []
  const precip = []
  const uv = []
  const daily = { time: [], sunrise: [], sunset: [] }

  INTENSITY.forEach((intensity, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index - 1)
    const key = dateKey(day)
    if (index > 0) {
      daily.time.push(key)
      daily.sunrise.push(`${key}T05:18`)
      daily.sunset.push(`${key}T18:25`)
    }
    for (let hour = 0; hour < 24; hour++) {
      const bell = Math.exp(-(((hour - 16) / 4.5) ** 2))
      const t = 23 + 4 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) - 3 * intensity
      time.push(`${key}T${pad(hour)}:00`)
      temperature.push(Math.round(t * 10) / 10)
      feels.push(Math.round((t + 2) * 10) / 10)
      rainChance.push(Math.min(100, Math.round(intensity * (30 + 70 * bell) + (intensity > 0.5 ? 12 : 0))))
      // Código de tempo da Open-Meteo: trovoada nas horas de pico dos dias mais fortes, depois chuva, nublado e sol.
      const chance = rainChance[rainChance.length - 1]
      weatherCode.push(hour >= 13 && hour <= 19 && intensity >= 0.7 && chance >= 70 ? 95 : chance >= 75 ? 82 : chance >= 50 ? 63 : chance >= 30 ? 3 : intensity < 0.2 ? (hour % 5 === 0 ? 2 : 0) : 2)
      precip.push(Math.round(intensity * bell * 16 * 10) / 10)
      uv.push(hour < 6 || hour > 18 ? 0 : Math.round(8 * Math.sin(((hour - 6) / 12) * Math.PI) * (1 - 0.7 * intensity) * 10) / 10)
    }
  })

  const nowIndex = time.indexOf(`${dateKey(now)}T${pad(now.getHours())}:00`)
  return {
    current: {
      time: `${dateKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
      temperature_2m: temperature[nowIndex],
      apparent_temperature: feels[nowIndex],
      relative_humidity_2m: 97,
      wind_speed_10m: 64,
    },
    hourly: {
      time,
      temperature_2m: temperature,
      apparent_temperature: feels,
      precipitation_probability: rainChance,
      weather_code: weatherCode,
      precipitation: precip,
      uv_index: uv,
    },
    daily,
  }
}

export const DEMO_AIR = { current: { european_aqi: 62, pm2_5: 31 } }

// Nível do aviso simulado: /teste (vermelho), /teste/laranja, /teste/amarelo
// (ou, também, /teste?nivel=laranja).
// /teste/extremo: cenário vermelho com mais de tudo, e o mapa já aberto.
export function isExtremeDemo(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  return /^\/teste\/extremo\/?$/.test(pathname)
}

export function demoLevel(
  pathname = typeof window !== 'undefined' ? window.location.pathname : '',
  search = typeof window !== 'undefined' ? window.location.search : '',
) {
  const fromPath = pathname.split('/').filter(Boolean)[1]
  const level = fromPath || new URLSearchParams(search).get('nivel')
  return ['vermelho', 'laranja', 'amarelo'].includes(level) ? level : 'vermelho'
}

const DEMO_TEXT = {
  vermelho: { title: 'Chuvas intensas', details: 'Chuva acima de 100 mm em 24 h e ventos de até 100 km/h. Risco de alagamentos, deslizamentos e queda de árvores.' },
  laranja: { title: 'Chuvas intensas', details: 'Chuva entre 50 e 100 mm em 24 h e ventos de até 60 km/h. Risco de alagamentos pontuais.' },
  amarelo: { title: 'Chuvas intensas', details: '' },
}

export function buildDemoWarnings(now = new Date(), level = demoLevel()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return [
    {
      severity: level,
      ...DEMO_TEXT[level],
      end: { date: dateKey(end), time: '12:00' },
    },
    { severity: level === 'amarelo' ? 'amarelo' : 'laranja', title: 'Ventos costeiros', details: '', end: { date: dateKey(end), time: '18:00' } },
  ]
}

// Rio subindo forte nos próximos dias e alguns focos de calor a distância.
export function buildDemoRiver(now = new Date()) {
  const values = [12, 20, 55, 110, 140, 90, 60, 40]
  const time = values.map((_, i) => dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i - 1)))
  return { daily: { time, river_discharge: values } }
}

export const DEMO_FIRES = { count: 2, nearestKm: 18, radiusKm: 50 }

export const DEMO_RESERVOIRS = { subsystem: 'SE', name: 'Sudeste/Centro-Oeste', percent: 28.4, weekAgoPercent: 31.2, lastYearPercent: 52.7, date: '2026-11-08' }

// Chuva dos últimos 90 dias muito abaixo da média, para o teste mostrar a seca.
export function buildDemoDrought(now = new Date()) {
  const time = []
  const values = []
  for (let i = 365 * 4; i >= 2; i--) {
    time.push(dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)))
    values.push(i <= 92 ? 0.4 : 3)
  }
  return { daily: { time, precipitation_sum: values } }
}

// Mapa de teste: várias áreas de níveis diferentes em volta do local, focos de calor e chuva.
const DEMO_RISKS = {
  vermelho: 'Chuva acima de 100 mm/dia, ventos intensos (60-100 km/h) e queda de granizo. Risco de corte de energia, alagamentos, deslizamentos e queda de árvores.',
  laranja: 'Chuva entre 50 e 100 mm/dia e ventos de até 60 km/h. Risco de alagamentos pontuais e de queda de galhos.',
  amarelo: 'Chuva entre 20 e 30 mm/h ou até 50 mm/dia e ventos de 40-60 km/h. Baixo risco de alagamentos.',
}
const DEMO_TIPS = [
  'Procure um abrigo seguro e evite áreas de alagamento e encostas.',
  'Não se abrigue debaixo de árvores nem perto de fios caídos.',
  'Obtenha mais informações junto à Defesa Civil (telefone 199) e ao Corpo de Bombeiros (telefone 193).',
]

export function buildDemoMap(place, level = 'vermelho', now = new Date(), extreme = false) {
  const square = (lat, lon, half) => ({
    type: 'Polygon',
    coordinates: [[[lon - half, lat - half], [lon + half, lat - half], [lon + half, lat + half], [lon - half, lat + half], [lon - half, lat - half]]],
  })
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const dayAfter = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
  const today = { date: dateKey(now), time: '08:00' }
  const end = { date: dateKey(tomorrow), time: '12:00' }
  const neighbor = level === 'amarelo' ? 'laranja' : 'amarelo'
  const area = (id, when, severity, title, geometry, extra = {}) => ({
    id, when, severity, title, start: today, end, inside: false, geometry,
    risks: DEMO_RISKS[severity], tips: DEMO_TIPS, reach: { count: 12, states: ['SP'], moreStates: 0 }, ...extra,
  })
  const areas = [
    area(1, 'hoje', level, 'Chuvas intensas', square(place.lat, place.lon, 0.3), { inside: true, reach: { count: 41, states: ['SP', 'MG'], moreStates: 0 } }),
    area(2, 'hoje', neighbor, 'Ventos fortes', square(place.lat + 0.1, place.lon + 0.85, 0.35), { reach: { count: 27, states: ['MG', 'SP'], moreStates: 0 } }),
  ]
  if (level === 'vermelho') {
    areas.push(area(3, 'hoje', 'vermelho', 'Vendaval', square(place.lat - 0.15, place.lon - 0.95, 0.3), { reach: { count: 18, states: ['SP'], moreStates: 0 } }))
  }
  if (extreme) {
    areas.push(
      area(5, 'hoje', 'vermelho', 'Chuvas intensas', square(place.lat + 1.25, place.lon - 1.5, 0.4), { reach: { count: 24, states: ['SP', 'MG'], moreStates: 0 } }),
      area(6, 'hoje', 'laranja', 'Vendaval', square(place.lat - 1.7, place.lon + 1.2, 0.4), { reach: { count: 15, states: ['SP', 'RJ'], moreStates: 0 } }),
      area(7, 'hoje', 'laranja', 'Descargas elétricas', square(place.lat + 1.0, place.lon + 1.9, 0.35), { reach: { count: 19, states: ['MG', 'SP'], moreStates: 0 } }),
    )
  }
  areas.push(area(4, 'futuro', 'amarelo', 'Chuvas intensas', square(place.lat + 0.85, place.lon - 0.2, 0.3), {
    start: { date: dateKey(tomorrow), time: '12:00' }, end: { date: dateKey(dayAfter), time: '18:00' }, reach: { count: 33, states: ['SP', 'RJ', 'MG'], moreStates: 0 },
  }))

  const points = []
  const total = extreme ? 44 : 16
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * 2 * Math.PI
    const km = 8 + ((i * 37) % (extreme ? 230 : 80))
    points.push([Math.round((place.lat + (km / 111) * Math.sin(angle)) * 1000) / 1000, Math.round((place.lon + (km / 111) * Math.cos(angle)) * 1000) / 1000])
  }
  return { areas, fires: { points, radiusKm: 100, date: dateKey(now) } }
}

// Chuva de teste: forte em volta do local e diminuindo com a distância, mais forte quanto mais grave o cenário.
export function buildDemoRain(place, level = 'vermelho', extreme = false) {
  const peak = extreme ? 150 : { vermelho: 110, laranja: 65, amarelo: 28 }[level] || 28
  const cells = buildRainGrid(place.lat, place.lon).map((cell, index) => {
    const km = distanceKm(place.lat, place.lon, cell.lat, cell.lon)
    const wobble = 0.8 + 0.2 * Math.sin(index * 1.7)
    return { ...cell, mm: Math.round(peak * Math.exp(-((km / 140) ** 2)) * wobble * 10) / 10 }
  })
  return { cells, step: RAIN_STEP }
}
