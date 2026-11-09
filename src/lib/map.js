import { formatDateTime } from './format.js'

export async function fetchMapData(lat, lon, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/mapa?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
  if (!response.ok) throw new Error(`Mapa respondeu ${response.status}`)
  return response.json()
}

export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

export const SEVERITY_LABEL = { vermelho: 'vermelho', laranja: 'laranja', amarelo: 'amarelo', desconhecido: 'do INMET' }

// Frase que responde à pergunta do mapa: "estou numa área de aviso e o que tem perto de mim?"
export function describeMap(data, place, radiusKm = 50) {
  const areas = data?.areas
  let headline
  let level = null
  if (areas == null) {
    headline = 'Não foi possível consultar as áreas de aviso agora. Confira no portal do INMET.'
  } else {
    const inside = areas.filter((area) => area.inside)
    if (inside.length > 0) {
      const top = inside[0]
      const label = SEVERITY_LABEL[top.severity] || 'do INMET'
      const until = top.end ? ` até ${formatDateTime(top.end)}` : ''
      level = top.severity === 'desconhecido' ? null : top.severity
      headline = top.when === 'hoje' || !top.when
        ? `Você está dentro de uma área de aviso ${label}${until}.`
        : `A sua área tem um aviso ${label} previsto${until}.`
    } else if (areas.length > 0) {
      const many = areas.length > 1
      headline = `Há ${areas.length} ${many ? 'áreas de aviso' : 'área de aviso'} por perto, mas o seu local não está dentro ${many ? 'delas' : 'dela'}.`
    } else {
      level = 'sem'
      headline = 'Nenhuma área de aviso por perto agora.'
    }
  }

  let firesLine = null
  let firesCount = null
  const points = data?.fires?.points
  if (points) {
    const near = place ? points.filter(([lat, lon]) => distanceKm(place.lat, place.lon, lat, lon) <= radiusKm).length : points.length
    firesCount = near
    firesLine = near === 0 ? `Nenhum foco de calor em ${radiusKm} km.` : `${near} ${near === 1 ? 'foco de calor' : 'focos de calor'} em ${radiusKm} km.`
  }
  return { headline, level, firesLine, firesCount }
}

// Identifica uma área (o INMET manda um id por aviso).
export const areaKey = (area, index) => String(area.id ?? `a${index}`)

export const LEVEL_NAME = { vermelho: 'Vermelho', laranja: 'Laranja', amarelo: 'Amarelo', desconhecido: 'INMET' }

// ---------- Chuva prevista nas próximas 24 h (grade de pontos ao redor do local) ----------

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
export const RAIN_STEP = 0.6 // graus entre os pontos (~66 km)
const RAIN_CELLS = 4 // 4 pontos para cada lado do local: grade de 9 x 9, uns 265 km para cada lado

const r3 = (n) => Math.round(n * 1000) / 1000

export function buildRainGrid(lat, lon, step = RAIN_STEP, cells = RAIN_CELLS) {
  const points = []
  for (let i = -cells; i <= cells; i++) {
    for (let j = -cells; j <= cells; j++) {
      const pointLat = lat + i * step
      if (Math.abs(pointLat) <= 90) points.push({ lat: r3(pointLat), lon: r3(lon + j * step) })
    }
  }
  return points
}

// A resposta tem um item por ponto (ou um só objeto, se houver um único ponto).
export function parseRain(points, response) {
  const list = Array.isArray(response) ? response : [response]
  return points.map((point, index) => {
    const hours = list[index]?.hourly?.precipitation || []
    const mm = hours.reduce((sum, value) => sum + (Number(value) || 0), 0)
    return { lat: point.lat, lon: point.lon, mm: Math.round(mm * 10) / 10 }
  })
}

export async function fetchRain(lat, lon, fetchImpl = fetch) {
  const points = buildRainGrid(lat, lon)
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    hourly: 'precipitation',
    forecast_hours: '24',
    timezone: 'auto',
  })
  const response = await fetchImpl(`${FORECAST_URL}?${params}`)
  if (!response.ok) throw new Error(`Chuva respondeu ${response.status}`)
  return { cells: parseRain(points, await response.json()), step: RAIN_STEP }
}

// Faixas de chuva em 24 h (mm). A de baixo não é desenhada, para o mapa não ficar todo colorido.
export const RAIN_BINS = [
  { min: 60, key: 'extrema', label: '60 mm ou mais', color: '#54278f' },
  { min: 30, key: 'muito-forte', label: '30 a 60 mm', color: '#6a51a3' },
  { min: 15, key: 'forte', label: '15 a 30 mm', color: '#2171b5' },
  { min: 5, key: 'moderada', label: '5 a 15 mm', color: '#4292c6' },
  { min: 1, key: 'fraca', label: '1 a 5 mm', color: '#9ecae1' },
]

export function rainBin(mm) {
  return RAIN_BINS.find((bin) => mm >= bin.min) || null
}

// Chuva no ponto mais próximo do local e o maior valor da região.
export function summarizeRain(rain, place) {
  const cells = rain?.cells
  if (!cells || cells.length === 0) return null
  let here = cells[0]
  let best = Infinity
  for (const cell of cells) {
    const d = distanceKm(place.lat, place.lon, cell.lat, cell.lon)
    if (d < best) {
      best = d
      here = cell
    }
  }
  const max = cells.reduce((top, cell) => (cell.mm > top.mm ? cell : top), cells[0])
  return { here: here.mm, max: max.mm }
}

export function formatMm(mm) {
  return `${(Math.round(mm * 10) / 10).toLocaleString('pt-BR')} mm`
}

// Resumo das áreas: quantas, de que nível e quantas atingem o local.
export function summarizeAreas(areas) {
  const list = areas || []
  const by = { vermelho: 0, laranja: 0, amarelo: 0 }
  for (const area of list) if (area.severity in by) by[area.severity] += 1
  return { total: list.length, by, inside: list.filter((area) => area.inside).length }
}

// ---------- Campo de chuva (para o mapa de calor) ----------

// Organiza os pontos da grade numa tabela, para poder estimar a chuva entre eles.
export function buildRainField(cells, step = RAIN_STEP) {
  if (!cells || cells.length === 0) return null
  const lats = [...new Set(cells.map((cell) => cell.lat))].sort((a, b) => a - b)
  const lons = [...new Set(cells.map((cell) => cell.lon))].sort((a, b) => a - b)
  const values = lats.map(() => lons.map(() => 0))
  for (const cell of cells) values[lats.indexOf(cell.lat)][lons.indexOf(cell.lon)] = cell.mm
  return { lats, lons, values, step }
}

// Chuva estimada em qualquer ponto da região, entre os pontos da grade (interpolação).
// Devolve null para pontos mais de meio passo fora da grade.
export function rainAt(field, lat, lon) {
  if (!field) return null
  const { lats, lons, values, step } = field
  const half = step / 2
  if (lat < lats[0] - half || lat > lats[lats.length - 1] + half || lon < lons[0] - half || lon > lons[lons.length - 1] + half) return null
  if (lats.length < 2 || lons.length < 2) return values[0][0]
  const la = Math.min(Math.max(lat, lats[0]), lats[lats.length - 1])
  const lo = Math.min(Math.max(lon, lons[0]), lons[lons.length - 1])
  const i = Math.min(lats.length - 2, Math.floor((la - lats[0]) / (lats[1] - lats[0])))
  const j = Math.min(lons.length - 2, Math.floor((lo - lons[0]) / (lons[1] - lons[0])))
  const fy = (la - lats[i]) / (lats[i + 1] - lats[i])
  const fx = (lo - lons[j]) / (lons[j + 1] - lons[j])
  const top = values[i][j] * (1 - fx) + values[i][j + 1] * fx
  const bottom = values[i + 1][j] * (1 - fx) + values[i + 1][j + 1] * fx
  return Math.round((top * (1 - fy) + bottom * fy) * 10) / 10
}

// ---------- O que existe no ponto tocado ----------

function inRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(lon, lat, rings) {
  if (!rings || rings.length === 0 || !inRing(lon, lat, rings[0])) return false
  for (let k = 1; k < rings.length; k++) if (inRing(lon, lat, rings[k])) return false // buraco
  return true
}

// Ponto dentro de um Polygon ou MultiPolygon do GeoJSON (coordenadas [lon, lat]).
export function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') return inPolygon(lon, lat, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => inPolygon(lon, lat, polygon))
  return false
}

// O que há no ponto tocado, só das camadas que estão ligadas: áreas de aviso que o cobrem, um foco de
// calor bem em cima e a chuva prevista (quando chega a 1 mm). Lista vazia: não há nada a mostrar.
export function whatIsHere({ lat, lon, areas = [], field = null, fireNearby = false, show = { areas: true, rain: true, fires: true } }) {
  const items = []
  if (show.areas) {
    for (const area of areas) if (pointInGeometry(lon, lat, area.geometry)) items.push({ kind: 'area', area })
  }
  if (show.fires && fireNearby) items.push({ kind: 'fire' })
  if (show.rain) {
    const mm = rainAt(field, lat, lon)
    const bin = mm == null ? null : rainBin(mm)
    if (bin) items.push({ kind: 'rain', mm, label: bin.label })
  }
  return items
}
