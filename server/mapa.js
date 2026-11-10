// Dados do mapa: áreas de aviso do INMET e focos de calor do INPE perto de um ponto.
// Usada pela função serverless (api/mapa.js) e pelo servidor de desenvolvimento (vite.config.js).
import { INMET_ACTIVE_URL, SEVERITY_ORDER, normalizeWarning, parseCoordinates, parseGeometry, pointInGeometry } from './alerts.js'
import { listFires, loadFiresCsv } from './queimadas.js'

// Só entram avisos cujas áreas chegam a ~550 km do ponto.
const NEAR_DEGREES = 5
const MAX_AREAS = 30
const MAX_FIRES = 400

// O INMET manda `riscos` e `instrucoes` como lista de textos (às vezes como texto simples).
function toList(value) {
  const list = Array.isArray(value) ? value : value ? [value] : []
  return list.map((item) => String(item).replace(/\s+/g, ' ').trim()).filter(Boolean)
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

// `municipios` é um texto enorme ("Nome - UF (código),Nome - UF (código),…"). Para o mapa,
// basta saber quantos são e em quais estados, o que evita mandar dezenas de KB ao celular.
export function summarizeMunicipalities(text) {
  const raw = typeof text === 'string' ? text : ''
  const count = (raw.match(/\(\d{5,7}\)/g) || []).length
  const states = {}
  for (const match of raw.matchAll(/ - ([A-Z]{2}) \(/g)) states[match[1]] = (states[match[1]] || 0) + 1
  const ufs = Object.entries(states).sort((a, b) => b[1] - a[1]).map(([uf]) => uf)
  return { count, states: ufs.slice(0, 8), moreStates: Math.max(0, ufs.length - 8) }
}
export const FIRE_RADIUS_KM = 250

// Percorre todos os pontos [lon, lat] de um Polygon ou MultiPolygon.
function* positions(geometry) {
  if (!geometry) return
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  for (const polygon of polygons) for (const ring of polygon) for (const position of ring) yield position
}

export function geometryBounds(geometry) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const [lon, lat] of positions(geometry)) {
    if (lon < minLon) minLon = lon
    if (lon > maxLon) maxLon = lon
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return minLon === Infinity ? null : [minLon, minLat, maxLon, maxLat]
}

export function boundsNear(bounds, lat, lon, degrees = NEAR_DEGREES) {
  if (!bounds) return false
  const [minLon, minLat, maxLon, maxLat] = bounds
  return maxLon >= lon - degrees && minLon <= lon + degrees && maxLat >= lat - degrees && minLat <= lat + degrees
}

// Douglas-Peucker: tira pontos que quase não mudam o desenho (tolerância em graus).
export function simplifyRing(ring, tolerance = 0.004) {
  if (ring.length <= 4) return ring
  const keep = new Array(ring.length).fill(false)
  keep[0] = keep[ring.length - 1] = true
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()
    const [ax, ay] = ring[start]
    const [bx, by] = ring[end]
    const dx = bx - ax
    const dy = by - ay
    const length = Math.hypot(dx, dy)
    let maxDistance = 0
    let index = -1
    for (let i = start + 1; i < end; i++) {
      const [px, py] = ring[i]
      const distance = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * px - dx * py + bx * ay - by * ax) / length
      if (distance > maxDistance) {
        maxDistance = distance
        index = i
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = true
      stack.push([start, index], [index, end])
    }
  }
  const simplified = ring.filter((_, i) => keep[i])
  return simplified.length >= 4 ? simplified : ring
}

const roundPosition = ([lon, lat]) => [Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]

export function simplifyGeometry(geometry, tolerance = 0.004) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const simplified = polygons.map((polygon) => polygon.map((ring) => simplifyRing(ring, tolerance).map(roundPosition)))
  return geometry.type === 'Polygon' ? { type: 'Polygon', coordinates: simplified[0] } : { type: 'MultiPolygon', coordinates: simplified }
}

// `data` tem o formato { hoje: [...], futuro?: [...] }.
export function areasNear(data, lat, lon) {
  const areas = []
  for (const [when, list] of Object.entries(data || {})) {
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      const geometry = parseGeometry(raw.poligono)
      if (!geometry || !boundsNear(geometryBounds(geometry), lat, lon)) continue
      const warning = normalizeWarning(raw, when)
      areas.push({
        id: warning.id,
        when,
        severity: warning.severity,
        title: warning.title,
        start: warning.start,
        end: warning.end,
        risks: clip(toList(raw.riscos).join(' '), 360) || null,
        tips: toList(raw.instrucoes).slice(0, 4).map((tip) => clip(tip, 200)),
        reach: summarizeMunicipalities(raw.municipios),
        inside: pointInGeometry(lon, lat, geometry),
        geometry: simplifyGeometry(geometry),
      })
    }
  }
  return areas
    .sort((a, b) => Number(b.inside) - Number(a.inside) || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_AREAS)
}

export async function handleMap(query, fetchImpl = fetch, now = new Date()) {
  const point = parseCoordinates(query)
  if (!point) return { status: 400, body: { error: 'Informe lat e lon válidos.' } }

  const [alertsResult, firesResult] = await Promise.allSettled([
    fetchImpl(INMET_ACTIVE_URL, { headers: { accept: 'application/json' } }).then((response) => {
      if (!response.ok) throw new Error(`INMET respondeu ${response.status}`)
      return response.json()
    }),
    loadFiresCsv(fetchImpl, now),
  ])

  // Cada fonte falha sozinha: um item malformado do INMET não pode derrubar os focos do INPE.
  const attempt = (work) => {
    try {
      return work()
    } catch (error) {
      console.error('Falha ao montar os dados do mapa:', error)
      return null
    }
  }
  const areas = alertsResult.status === 'fulfilled' ? attempt(() => areasNear(alertsResult.value, point.lat, point.lon)) : null
  const loaded = firesResult.status === 'fulfilled' ? firesResult.value : null
  const points = loaded ? attempt(() => listFires(loaded.csv, point.lat, point.lon, FIRE_RADIUS_KM, MAX_FIRES)) : null

  if (areas == null && points == null) {
    return { status: 502, body: { error: 'Não foi possível consultar os dados do mapa agora.' } }
  }
  return {
    status: 200,
    headers: { 'cache-control': 's-maxage=300, stale-while-revalidate=600' },
    body: {
      areas,
      fires: points == null ? null : { points, radiusKm: FIRE_RADIUS_KM, date: loaded.date },
    },
  }
}
