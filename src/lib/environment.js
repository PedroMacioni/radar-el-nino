import { coordsQuery } from './geo.js'
import { dayMonth, formatNumber } from './format.js'
import { t } from './i18n.js'

// Rios (vazão prevista) e queimadas (focos de calor) perto do local.

const FLOOD_URL = 'https://flood-api.open-meteo.com/v1/flood'

export async function fetchRiver(lat, lon, fetchImpl = fetch) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'river_discharge',
    past_days: '1',
    forecast_days: '7',
  })
  const response = await fetchImpl(`${FLOOD_URL}?${params}`)
  if (!response.ok) throw new Error(`Vazão respondeu ${response.status}`)
  return response.json()
}

export async function fetchFires(lat, lon, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/queimadas?${coordsQuery(lat, lon)}`)
  if (!response.ok) throw new Error(`Queimadas respondeu ${response.status}`)
  return response.json()
}

// Número no formato do idioma (1 casa decimal abaixo de 100).
const round = (n) => formatNumber(n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)

// A previsão de vazão é um modelo (GloFAS), sem valor de "cheia" por local.
// Por isso o nível olha a tendência: quanto o rio deve subir nos próximos dias.
// Os ganhos mínimos (em m³/s) evitam alarme quando um riacho pequeno só dobra de vazão.
export function riverStatus(river, today) {
  const times = river?.daily?.time
  const values = river?.daily?.river_discharge
  if (!times || !values) return null
  const start = times.indexOf(today)
  if (start < 0 || values[start] == null) return null
  const current = values[start]
  let peak = current
  let peakDate = today
  for (let i = start + 1; i < values.length; i++) {
    if (values[i] != null && values[i] > peak) {
      peak = values[i]
      peakDate = times[i]
    }
  }
  const last = values[values.length - 1]
  const rise = current > 0 ? peak / current : peak > 0 ? Infinity : 1
  const gain = peak - current

  let level
  if (rise >= 3 && gain >= 30) level = { key: 'vermelho', label: t('Subida forte') }
  else if (rise >= 2 && gain >= 10) level = { key: 'laranja', label: t('Subindo rápido') }
  else if (rise >= 1.5 && gain >= 3) level = { key: 'amarelo', label: t('Subindo') }
  else if (last != null && current > 0 && last < current * 0.7) level = { key: 'sem', label: t('Descendo') }
  else level = { key: 'sem', label: t('Estável') }

  const rising = level.key !== 'sem'
  const peakOn = dayMonth(peakDate)
  const value = rising
    ? t('Vazão de {current} m³/s, com pico de {peak} m³/s previsto em {date}', { current: round(current), peak: round(peak), date: peakOn })
    : t('Vazão de {current} m³/s, sem subida forte prevista nos próximos dias', { current: round(current) })
  return {
    level,
    value,
    headline: `${round(rising ? peak : current)} m³/s`,
    lines: rising
      ? [t('Pico previsto em {date}', { date: peakOn }), t('Hoje: {current} m³/s', { current: round(current) })]
      : [t('Vazão de hoje'), t('Sem subida forte prevista')],
  }
}

// Focos de calor num raio de 50 km, no dia mais recente do INPE.
export function fireStatus(fires) {
  if (!fires || typeof fires.count !== 'number') return null
  const radius = fires.radiusKm || 50
  const near = fires.nearestKm
  let level
  if (fires.count === 0) level = { key: 'sem', label: t('Nenhum foco') }
  else if (fires.count <= 3 && (near == null || near > 10)) level = { key: 'amarelo', label: t('Poucos focos') }
  else if (fires.count <= 15) level = { key: 'laranja', label: t('Vários focos') }
  else level = { key: 'vermelho', label: t('Muitos focos') }
  if (fires.count > 3 && fires.count <= 15 && near != null && near <= 5) level = { key: 'vermelho', label: t('Focos perto') }

  const one = fires.count === 1
  const value = fires.count === 0
    ? t('Nenhum foco de calor em {radius} km', { radius }) + (near != null ? ` ${t('(o mais próximo está a {near} km)', { near })}` : '')
    : t(one ? '{count} foco de calor em {radius} km' : '{count} focos de calor em {radius} km', { count: fires.count, radius }) + (near != null ? ` · ${t('o mais próximo a {near} km', { near })}` : '')
  return {
    level,
    value,
    headline: fires.count === 0 ? t('Nenhum foco') : t(one ? '{count} foco' : '{count} focos', { count: fires.count }),
    lines: [t('De calor, em {radius} km', { radius }), near != null ? t('Mais próximo: {near} km', { near }) : t('Nenhum num raio maior')],
  }
}

// ---------- Reservatórios (ONS) ----------

export async function fetchReservoirs(state, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/reservatorios?estado=${encodeURIComponent(state)}`)
  if (!response.ok) throw new Error(`Reservatórios respondeu ${response.status}`)
  return response.json()
}

// Volume armazenado nas hidrelétricas da região (não é o reservatório da sua cidade).
export function reservoirStatus(data) {
  if (!data || typeof data.percent !== 'number') return null
  const p = data.percent
  let level
  if (p < 20) level = { key: 'vermelho', label: t('Crítico') }
  else if (p < 35) level = { key: 'laranja', label: t('Baixo') }
  else if (p < 50) level = { key: 'amarelo', label: t('Atenção') }
  else level = { key: 'sem', label: t('Normal') }

  const parts = [t('Hidrelétricas do {name}: {percent}% cheios', { name: data.name, percent: round(p) })]
  if (data.weekAgoPercent != null) {
    const delta = p - data.weekAgoPercent
    if (Math.abs(delta) >= 1) parts.push(delta > 0 ? t('subindo ({points} pontos em 7 dias)', { points: round(delta) }) : t('caindo ({points} pontos em 7 dias)', { points: round(-delta) }))
  }
  if (data.lastYearPercent != null) parts.push(t('no mesmo dia do ano passado: {percent}%', { percent: round(data.lastYearPercent) }))
  const lines = [t('Hidrelétricas do {name}', { name: data.name })]
  if (data.weekAgoPercent != null && Math.abs(p - data.weekAgoPercent) >= 1) {
    const delta = p - data.weekAgoPercent
    lines.push(t(delta > 0 ? 'Subindo {points} pontos em 7 dias' : 'Caindo {points} pontos em 7 dias', { points: round(Math.abs(delta)) }))
  }
  if (data.lastYearPercent != null) lines.push(t('Ano passado: {percent}%', { percent: round(data.lastYearPercent) }))
  return { level, value: parts.join(' · '), headline: `${round(p)}%`, lines }
}

// ---------- Seca (chuva dos últimos 90 dias contra a média) ----------

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const WINDOW = 90

function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export async function fetchDrought(lat, lon, today, fetchImpl = fetch) {
  // O histórico tem alguns dias de atraso, por isso o fim é dois dias antes de hoje.
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: `${Number(today.slice(0, 4)) - 10}-01-01`,
    end_date: addDays(today, -2),
    daily: 'precipitation_sum',
    timezone: 'auto',
  })
  const response = await fetchImpl(`${ARCHIVE_URL}?${params}`)
  if (!response.ok) throw new Error(`Histórico de chuva respondeu ${response.status}`)
  return response.json()
}

function windowSum(values, end) {
  let sum = 0
  for (let i = end - WINDOW + 1; i <= end; i++) sum += values[i] ?? 0
  return sum
}

// Não é o Monitor de Secas oficial: compara a chuva recente com a média dos
// mesmos 90 dias nos anos anteriores.
export function droughtStatus(archive) {
  const times = archive?.daily?.time
  const values = archive?.daily?.precipitation_sum
  if (!times || !values) return null
  let end = values.length - 1
  while (end >= 0 && values[end] == null) end--
  if (end < WINDOW) return null

  const endDate = times[end]
  const current = windowSum(values, end)
  const past = []
  for (let back = 1; back <= 9; back++) {
    const index = times.indexOf(`${Number(endDate.slice(0, 4)) - back}${endDate.slice(4)}`)
    if (index >= WINDOW) past.push(windowSum(values, index))
  }
  if (past.length < 3) return null
  const average = past.reduce((a, b) => a + b, 0) / past.length
  const ratio = average > 0 ? current / average : 1

  let level
  if (average < 30) level = { key: 'sem', label: t('Seco normal') }
  else if (ratio >= 0.75) level = { key: 'sem', label: ratio > 1.25 ? t('Chuva acima') : t('Chuva normal') }
  else if (ratio >= 0.5) level = { key: 'amarelo', label: t('Chuva abaixo') }
  else if (ratio >= 0.25) level = { key: 'laranja', label: t('Bem abaixo') }
  else level = { key: 'vermelho', label: t('Chuva escassa') }

  return {
    level,
    value: t('Choveu {mm} mm nos últimos {days} dias, {percent}% da média ({avg} mm)', { mm: Math.round(current), days: WINDOW, percent: Math.round(ratio * 100), avg: Math.round(average) }),
    headline: t('{percent}% da média', { percent: Math.round(ratio * 100) }),
    lines: [t('Choveu {mm} mm em {days} dias', { mm: Math.round(current), days: WINDOW }), t('Média: {avg} mm', { avg: Math.round(average) })],
  }
}
