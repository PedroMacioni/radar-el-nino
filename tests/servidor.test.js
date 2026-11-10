import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCoordinates } from '../server/alerts.js'
import { countFires, handleFires, loadFiresCsv } from '../server/queimadas.js'
import { handleReservoirs, parseEar, subsystemForState } from '../server/reservatorios.js'
import { handleMap } from '../server/mapa.js'
import { coordsQuery } from '../src/lib/geo.js'

const NOW = new Date('2026-01-03T12:00:00Z')

test('coordenadas vazias ou fora da faixa são recusadas', () => {
  assert.equal(parseCoordinates({ lat: '', lon: '' }), null)
  assert.equal(parseCoordinates({ lat: ' ', lon: '10' }), null)
  assert.equal(parseCoordinates({ lat: '-22.9' }), null)
  assert.equal(parseCoordinates({ lat: '91', lon: '0' }), null)
  assert.deepEqual(parseCoordinates({ lat: '0', lon: '0' }), { lat: 0, lon: 0 })
  assert.deepEqual(parseCoordinates({ lat: '-22.9', lon: '-47.06' }), { lat: -22.9, lon: -47.06 })
})

test('coordsQuery arredonda para 3 casas', () => {
  assert.equal(coordsQuery(-22.906847, -43.172897), 'lat=-22.907&lon=-43.173')
})

const FIRES_CSV = ['lat,lon,satelite', '-22.90,-47.06,X', '-22.95,-47.10,X', '-10.00,-40.00,X'].join('\n')

test('focos: conta só os do raio e acha o mais próximo', () => {
  const result = countFires(FIRES_CSV, -22.9, -47.06)
  assert.equal(result.count, 2)
  assert.equal(result.nearestKm, 0)
  assert.equal(countFires('a,b\n1,2', -22.9, -47.06), null)
})

test('focos: usa o arquivo de ontem quando o de hoje ainda não existe', async () => {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(url)
    return url.includes('20260103') ? { ok: false } : { ok: true, text: async () => FIRES_CSV }
  }
  const loaded = await loadFiresCsv(fetchImpl, NOW)
  assert.equal(loaded.date, '2026-01-02')
  assert.equal(urls.length, 2)
})

test('focos: rota recusa coordenadas vazias e responde 502 sem arquivo', async () => {
  assert.equal((await handleFires({ lat: '', lon: '' })).status, 400)
  const down = async () => ({ ok: false })
  assert.equal((await handleFires({ lat: '-22.9', lon: '-47.06' }, down, NOW)).status, 502)
})

const EAR_HEADER = 'id_subsistema;ear_data;ear_verif_subsistema_percentual'

test('reservatórios: lê só o subsistema pedido, em ordem de data', () => {
  const csv = [EAR_HEADER, 'SE;2026-01-02;50,0', 'N;2026-01-02;10', 'SE;2026-01-01;40'].join('\n')
  assert.deepEqual(parseEar(csv.replace('50,0', '50'), 'SE'), [
    { date: '2026-01-01', percent: 40 },
    { date: '2026-01-02', percent: 50 },
  ])
  assert.equal(subsystemForState('São Paulo'), 'SE')
  assert.equal(subsystemForState('Estado de Pernambuco'), 'NE')
  assert.equal(subsystemForState('Atlântida'), null)
})

test('reservatórios: no começo do ano usa o ano anterior se o arquivo novo não existe', async () => {
  const previous = [EAR_HEADER, 'SE;2025-12-27;30', 'SE;2025-12-31;32', 'SE;2025-01-03;60'].join('\n')
  const fetchImpl = async (url) => (url.includes('_2026') ? { ok: false, status: 404 } : { ok: true, text: async () => previous })
  const { status, body } = await handleReservoirs({ estado: 'SP' }, fetchImpl, NOW)
  assert.equal(status, 200)
  assert.equal(body.date, '2025-12-31')
  assert.equal(body.percent, 32)
})

test('reservatórios: com o arquivo novo curto, a semana anterior vem do ano passado', async () => {
  const current = [EAR_HEADER, 'SE;2026-01-02;35'].join('\n')
  const previous = [EAR_HEADER, 'SE;2025-12-26;31', 'SE;2025-01-02;60'].join('\n')
  const fetchImpl = async (url) => ({ ok: true, text: async () => (url.includes('_2026') ? current : previous) })
  const { body } = await handleReservoirs({ estado: 'SP' }, fetchImpl, NOW)
  assert.equal(body.percent, 35)
  assert.equal(body.weekAgoPercent, 31)
  assert.equal(body.lastYearPercent, 60)
})

test('reservatórios: falha só quando nenhum dos dois arquivos pode ser lido', async () => {
  const down = async () => ({ ok: false, status: 500 })
  assert.equal((await handleReservoirs({ estado: 'SP' }, down, NOW)).status, 502)
  assert.equal((await handleReservoirs({ estado: 'Marte' }, down, NOW)).status, 404)
})

test('mapa: um aviso malformado do INMET não derruba os focos de calor', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('inmet')) return { ok: true, json: async () => ({ hoje: [{ poligono: { type: 'Polygon', coordinates: [null] } }] }) }
    return { ok: true, text: async () => FIRES_CSV }
  }
  const { status, body } = await handleMap({ lat: '-22.9', lon: '-47.06' }, fetchImpl, NOW)
  assert.equal(status, 200)
  assert.equal(body.areas, null)
  assert.equal(body.fires.points.length, 2)
})
