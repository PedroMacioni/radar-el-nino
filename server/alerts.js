// Lógica dos avisos do INMET. Usada pela função serverless (api/alertas.js)
// e pelo servidor de desenvolvimento (vite.config.js).

export const INMET_ACTIVE_URL = 'https://apiprevmet3.inmet.gov.br/avisos/ativos'

// Ray casting. As coordenadas do GeoJSON vêm como [longitude, latitude].
export function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function pointInPolygon(lon, lat, rings) {
  if (!rings || rings.length === 0) return false
  if (!pointInRing(lon, lat, rings[0])) return false
  // Os demais anéis são buracos.
  for (let k = 1; k < rings.length; k++) {
    if (pointInRing(lon, lat, rings[k])) return false
  }
  return true
}

export function pointInGeometry(lon, lat, geometry) {
  if (!geometry || !geometry.type) return false
  if (geometry.type === 'Polygon') return pointInPolygon(lon, lat, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon))
  }
  return false
}

export function parseGeometry(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// O formato exato do campo de severidade não está documentado publicamente.
// Procuramos o nível em alguns campos de texto prováveis. Se não achar, devolve
// 'desconhecido' e a interface manda a pessoa ao portal do INMET.
export function severityFromRaw(raw) {
  const text = [raw.severidade, raw.nivel, raw.cor, raw.severity, raw.aviso_severidade]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase()
  if (text.includes('grande perigo') || text.includes('vermelho')) return 'vermelho'
  if (text.includes('perigo potencial') || text.includes('amarelo')) return 'amarelo'
  if (text.includes('perigo') || text.includes('laranja')) return 'laranja'
  return 'desconhecido'
}

export const SEVERITY_ORDER = { vermelho: 0, laranja: 1, amarelo: 2, desconhecido: 3 }

export function normalizeWarning(raw, when) {
  const title = raw.descricao || raw.fenomeno || raw.nome || raw.titulo || null
  return {
    id: raw.id_aviso ?? raw.id,
    when,
    severity: severityFromRaw(raw),
    title,
    details: raw.riscos || raw.observacao || raw.instrucoes || null,
    start: raw.data_inicio ? { date: String(raw.data_inicio).slice(0, 10), time: raw.hora_inicio || null } : null,
    end: raw.data_fim ? { date: String(raw.data_fim).slice(0, 10), time: raw.hora_fim || null } : null,
  }
}

// `data` tem o formato { hoje: [...], futuro?: [...] }.
export function warningsForPoint(data, lat, lon) {
  const result = []
  for (const [when, list] of Object.entries(data || {})) {
    if (!Array.isArray(list)) continue
    for (const raw of list) {
      const geometry = parseGeometry(raw.poligono)
      if (pointInGeometry(lon, lat, geometry)) result.push(normalizeWarning(raw, when))
    }
  }
  return result.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

export function parseCoordinates(query) {
  // Number('') vale 0: texto vazio não pode virar o ponto 0,0.
  if (String(query.lat ?? '').trim() === '' || String(query.lon ?? '').trim() === '') return null
  const lat = Number(query.lat)
  const lon = Number(query.lon)
  const valid = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  return valid ? { lat, lon } : null
}

// Devolve { status, body, headers } para ser usado por qualquer servidor.
export async function handleAlerts(query, fetchImpl = fetch) {
  const point = parseCoordinates(query)
  if (!point) return { status: 400, body: { error: 'Informe lat e lon válidos.' } }
  try {
    const response = await fetchImpl(INMET_ACTIVE_URL, { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`INMET respondeu ${response.status}`)
    const data = await response.json()
    return {
      status: 200,
      headers: { 'cache-control': 's-maxage=300, stale-while-revalidate=600' },
      body: { warnings: warningsForPoint(data, point.lat, point.lon), source: 'INMET', fetchedAt: new Date().toISOString() },
    }
  } catch (error) {
    console.error('Falha ao consultar o INMET:', error)
    return { status: 502, body: { error: 'Não foi possível consultar os avisos do INMET agora.' } }
  }
}
