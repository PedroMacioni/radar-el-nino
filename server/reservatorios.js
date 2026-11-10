// Reservatórios das hidrelétricas (ONS, energia armazenada por subsistema).
// Usada pela função serverless (api/reservatorios.js) e pelo servidor de
// desenvolvimento (vite.config.js). O ONS não libera CORS, por isso a leitura
// é feita aqui.

const BASE = 'https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/ear_subsistema_di'

export const SUBSYSTEMS = {
  SE: 'Sudeste/Centro-Oeste',
  S: 'Sul',
  NE: 'Nordeste',
  N: 'Norte',
}

// Subsistema do ONS de cada estado (aproximado: o sistema é interligado).
const BY_UF = {
  SP: 'SE', MG: 'SE', RJ: 'SE', ES: 'SE', GO: 'SE', DF: 'SE', MT: 'SE', MS: 'SE', AC: 'SE', RO: 'SE',
  PR: 'S', SC: 'S', RS: 'S',
  BA: 'NE', SE: 'NE', AL: 'NE', PE: 'NE', PB: 'NE', RN: 'NE', CE: 'NE', PI: 'NE',
  AM: 'N', AP: 'N', PA: 'N', RR: 'N', TO: 'N', MA: 'N',
}

const UF_BY_NAME = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}

const normalize = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// Aceita "São Paulo", "SP" ou "Estado de São Paulo".
export function subsystemForState(state) {
  const clean = normalize(state).replace(/^estado d[eo] /, '')
  const uf = clean.length === 2 ? clean.toUpperCase() : UF_BY_NAME[clean]
  return (uf && BY_UF[uf]) || null
}

// Linhas do CSV (separador ";") do subsistema, em ordem de data.
export function parseEar(csv, id) {
  const lines = csv.split(/\r?\n/)
  const header = (lines[0] || '').split(';').map((h) => h.trim())
  const iId = header.indexOf('id_subsistema')
  const iDate = header.indexOf('ear_data')
  const iPct = header.indexOf('ear_verif_subsistema_percentual')
  if (iId < 0 || iDate < 0 || iPct < 0) return []
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';')
    if ((cols[iId] || '').trim() !== id) continue
    const percent = Number(cols[iPct])
    if (Number.isFinite(percent)) rows.push({ date: cols[iDate].trim(), percent })
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : 1))
}

function shiftDays(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function summarizeEar(rows, lastYearRows = []) {
  if (rows.length === 0) return null
  const latest = rows[rows.length - 1]
  const weekAgo = rows.find((r) => r.date === shiftDays(latest.date, -7))
  const lastYear = lastYearRows.find((r) => r.date === `${Number(latest.date.slice(0, 4)) - 1}${latest.date.slice(4)}`)
  const round = (n) => Math.round(n * 10) / 10
  return {
    date: latest.date,
    percent: round(latest.percent),
    weekAgoPercent: weekAgo ? round(weekAgo.percent) : null,
    lastYearPercent: lastYear ? round(lastYear.percent) : null,
  }
}

async function loadYear(year, fetchImpl) {
  const response = await fetchImpl(`${BASE}/EAR_DIARIO_SUBSISTEMA_${year}.csv`)
  if (!response.ok) throw new Error(`ONS respondeu ${response.status}`)
  return response.text()
}

export async function handleReservoirs(query, fetchImpl = fetch, now = new Date()) {
  const id = subsystemForState(query.estado)
  if (!id) return { status: 404, body: { error: 'Estado não reconhecido' } }
  const year = now.getUTCFullYear()
  try {
    // No começo do ano o arquivo novo pode não existir ou ter poucos dias: o ano anterior completa
    // a leitura (e a comparação de 7 dias). Só falha se nenhum dos dois puder ser lido.
    const [current, previous] = await Promise.all([
      loadYear(year, fetchImpl).catch(() => ''),
      loadYear(year - 1, fetchImpl).catch(() => ''),
    ])
    if (!current && !previous) throw new Error('ONS sem arquivos')
    const previousRows = previous ? parseEar(previous, id) : []
    // Cada arquivo traz um ano só e já vem em ordem de data, então basta juntar.
    const rows = [...previousRows, ...(current ? parseEar(current, id) : [])]
    const summary = summarizeEar(rows, previousRows)
    if (!summary) return { status: 502, body: { error: 'Sem dados do ONS' } }
    return {
      status: 200,
      headers: { 'cache-control': 'public, s-maxage=21600, stale-while-revalidate=43200' },
      body: { subsystem: id, name: SUBSYSTEMS[id], ...summary },
    }
  } catch {
    return { status: 502, body: { error: 'Não foi possível ler os dados do ONS' } }
  }
}
