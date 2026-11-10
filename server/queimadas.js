// Focos de calor do INPE perto de um ponto. Usada pela função serverless
// (api/queimadas.js) e pelo servidor de desenvolvimento (vite.config.js).
// O arquivo diário do Brasil tem alguns MB, por isso a leitura é feita aqui e
// o navegador recebe só a contagem (ou, no mapa, só os pontos próximos).

import { parseCoordinates } from './alerts.js'

export const RADIUS_KM = 50
const BASE = 'https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil'

export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

// Lê o CSV (colunas "lat" e "lon") e devolve os focos com a distância até o ponto.
function readFires(csv, lat, lon, maxKm) {
  const lines = csv.split('\n')
  const header = (lines[0] || '').trim().split(',')
  const iLat = header.indexOf('lat')
  const iLon = header.indexOf('lon')
  if (iLat < 0 || iLon < 0) return null
  const found = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const fLat = Number(cols[iLat])
    const fLon = Number(cols[iLon])
    if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) continue
    // Descarte rápido antes da conta mais cara.
    if (Math.abs(fLat - lat) > maxKm / 100 + 1 || Math.abs(fLon - lon) > maxKm / 100 + 1.5) continue
    found.push({ lat: fLat, lon: fLon, km: distanceKm(lat, lon, fLat, fLon) })
  }
  return found
}

// Conta os focos dentro do raio e acha o mais próximo.
export function countFires(csv, lat, lon, radiusKm = RADIUS_KM) {
  const fires = readFires(csv, lat, lon, Math.max(radiusKm, 100))
  if (!fires) return null
  let nearest = null
  let count = 0
  for (const fire of fires) {
    if (nearest == null || fire.km < nearest) nearest = fire.km
    if (fire.km <= radiusKm) count++
  }
  return { count, nearestKm: nearest == null ? null : Math.round(nearest) }
}

// Pontos para o mapa: os mais próximos dentro do raio, com no máximo `limit` itens.
export function listFires(csv, lat, lon, radiusKm = 100, limit = 300) {
  const fires = readFires(csv, lat, lon, radiusKm)
  if (!fires) return null
  return fires
    .filter((fire) => fire.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((fire) => [Math.round(fire.lat * 1000) / 1000, Math.round(fire.lon * 1000) / 1000])
}

const dayKey = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`

// Tenta o arquivo de hoje (parcial) e, se não existir ainda, o de ontem.
async function downloadFiresCsv(fetchImpl, now) {
  for (const back of [0, 1]) {
    const day = dayKey(new Date(now.getTime() - back * 86400000))
    try {
      const response = await fetchImpl(`${BASE}/focos_diario_br_${day}.csv`)
      if (!response.ok) continue
      return { csv: await response.text(), date: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` }
    } catch {
      // tenta o dia anterior
    }
  }
  return null
}

// O arquivo do Brasil inteiro tem vários MB e é igual para todo mundo. Cada instância guarda a
// última cópia por 20 minutos e, enquanto uma leitura está em andamento, as outras esperam por ela.
const CACHE_MS = 20 * 60 * 1000
const cache = { at: 0, promise: null }

export async function loadFiresCsv(fetchImpl = fetch, now = new Date()) {
  // Só o fetch real usa o cache; nos testes, cada chamada com um fetch falso é independente.
  if (fetchImpl !== fetch) return downloadFiresCsv(fetchImpl, now)
  if (!cache.promise || Date.now() - cache.at > CACHE_MS) {
    cache.at = Date.now()
    cache.promise = downloadFiresCsv(fetchImpl, now).then((loaded) => {
      if (!loaded) cache.promise = null
      return loaded
    }, (error) => {
      cache.promise = null
      throw error
    })
  }
  return cache.promise
}

export async function handleFires(query, fetchImpl = fetch, now = new Date()) {
  const point = parseCoordinates(query)
  if (!point) return { status: 400, body: { error: 'Informe lat e lon válidos.' } }
  const loaded = await loadFiresCsv(fetchImpl, now)
  const result = loaded && countFires(loaded.csv, point.lat, point.lon)
  if (!result) return { status: 502, body: { error: 'Não foi possível ler os focos do INPE' } }
  return {
    status: 200,
    headers: { 'cache-control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    body: { ...result, radiusKm: RADIUS_KM, date: loaded.date },
  }
}
