import test from 'node:test'
import assert from 'node:assert/strict'
import {
  handleAlerts, parseCoordinates, parseGeometry, pointInGeometry, pointInRing,
  severityFromRaw, warningsForPoint,
} from '../server/alerts.js'

// Quadrado ao redor de Campinas (lon -47.06, lat -22.9)
const square = [[-48, -24], [-46, -24], [-46, -22], [-48, -22], [-48, -24]]
const hole = [[-47.2, -23], [-46.9, -23], [-46.9, -22.8], [-47.2, -22.8], [-47.2, -23]]

test('ponto dentro e fora de um anel', () => {
  assert.equal(pointInRing(-47.06, -22.9, square), true)
  assert.equal(pointInRing(-47.5, -23.5, square), true)
  assert.equal(pointInRing(-40, -10, square), false)
})

test('polígono com buraco exclui o ponto do buraco', () => {
  const polygon = { type: 'Polygon', coordinates: [square, hole] }
  assert.equal(pointInGeometry(-47.0, -22.9, polygon), false)
  assert.equal(pointInGeometry(-47.6, -23.5, polygon), true)
})

test('MultiPolygon aceita o ponto em qualquer parte', () => {
  const far = [[-60, -5], [-58, -5], [-58, -3], [-60, -3], [-60, -5]]
  const multi = { type: 'MultiPolygon', coordinates: [[far], [square]] }
  assert.equal(pointInGeometry(-59, -4, multi), true)
  assert.equal(pointInGeometry(-47.5, -23.5, multi), true)
  assert.equal(pointInGeometry(-30, 0, multi), false)
})

test('geometria inválida não derruba a consulta', () => {
  assert.equal(parseGeometry('isto não é json'), null)
  assert.equal(parseGeometry(null), null)
  assert.equal(pointInGeometry(0, 0, null), false)
  assert.equal(pointInGeometry(0, 0, { type: 'Point', coordinates: [0, 0] }), false)
})

test('severidade é lida do texto e cai em desconhecido quando não existe', () => {
  assert.equal(severityFromRaw({ severidade: 'Grande Perigo' }), 'vermelho')
  assert.equal(severityFromRaw({ severidade: 'Perigo Potencial' }), 'amarelo')
  assert.equal(severityFromRaw({ severidade: 'Perigo' }), 'laranja')
  assert.equal(severityFromRaw({ cor: 'Amarelo' }), 'amarelo')
  assert.equal(severityFromRaw({ id_condicao_severa: 25 }), 'desconhecido')
})

const sample = {
  hoje: [
    { id_aviso: 1, severidade: 'Perigo Potencial', descricao: 'Chuvas intensas', data_inicio: '2026-11-09T00:00:00.000Z', hora_inicio: '06:00', data_fim: '2026-11-09T00:00:00.000Z', hora_fim: '23:59', poligono: JSON.stringify({ type: 'Polygon', coordinates: [square] }) },
    { id_aviso: 2, severidade: 'Perigo', descricao: 'Tempestade', data_inicio: '2026-11-09T00:00:00.000Z', hora_inicio: '00:00', data_fim: '2026-11-09T00:00:00.000Z', hora_fim: '18:00', poligono: JSON.stringify({ type: 'Polygon', coordinates: [square] }) },
    { id_aviso: 3, severidade: 'Perigo', poligono: JSON.stringify({ type: 'Polygon', coordinates: [[[-60, -5], [-58, -5], [-58, -3], [-60, -3], [-60, -5]]] }) },
  ],
  futuro: [],
}

test('filtra os avisos do ponto e ordena do mais grave para o menos grave', () => {
  const list = warningsForPoint(sample, -22.9, -47.06)
  assert.deepEqual(list.map((w) => w.id), [2, 1])
  assert.equal(list[0].severity, 'laranja')
  assert.equal(list[0].title, 'Tempestade')
  assert.deepEqual(list[0].end, { date: '2026-11-09', time: '18:00' })
})

test('coordenadas inválidas são recusadas', () => {
  assert.equal(parseCoordinates({ lat: 'abc', lon: '1' }), null)
  assert.equal(parseCoordinates({ lat: '91', lon: '1' }), null)
  assert.deepEqual(parseCoordinates({ lat: '-22.9', lon: '-47.06' }), { lat: -22.9, lon: -47.06 })
})

test('handleAlerts: sucesso, entrada inválida e falha do INMET', async () => {
  const ok = await handleAlerts({ lat: '-22.9', lon: '-47.06' }, async () => ({ ok: true, json: async () => sample }))
  assert.equal(ok.status, 200)
  assert.equal(ok.body.warnings.length, 2)

  const bad = await handleAlerts({ lat: 'x', lon: 'y' }, async () => assert.fail('não deveria buscar'))
  assert.equal(bad.status, 400)

  const down = await handleAlerts({ lat: '-22.9', lon: '-47.06' }, async () => ({ ok: false, status: 503 }))
  assert.equal(down.status, 502)

  const broken = await handleAlerts({ lat: '-22.9', lon: '-47.06' }, async () => { throw new Error('rede caiu') })
  assert.equal(broken.status, 502)
})

test('aviso salvo só vale até o fim do prazo', async () => {
  const { stillValid } = await import('../src/lib/alerts.js')
  const now = new Date(2026, 10, 9, 15, 0)
  assert.equal(stillValid({ end: { date: '2026-11-10', time: '12:00' } }, now), true)
  assert.equal(stillValid({ end: { date: '2026-11-09', time: '10:00' } }, now), false)
  assert.equal(stillValid({ end: { date: '2026-11-09', time: '' } }, now), true)
  assert.equal(stillValid({}, now), true)
})

test('detecta avisos novos entre uma atualização e outra', async () => {
  const { findNewWarnings, warningKey } = await import('../src/lib/alerts.js')
  const amarelo = { severity: 'amarelo', title: 'Chuvas' }
  const laranja = { severity: 'laranja', title: 'Chuvas' }
  const vento = { severity: 'amarelo', title: 'Vento' }
  // Primeira consulta (sem histórico): nada é "novo".
  assert.deepEqual(findNewWarnings(null, [amarelo]), [])
  const before = new Set([warningKey(amarelo)])
  assert.deepEqual(findNewWarnings(before, [amarelo]), [])
  // Mesmo aviso que ficou mais grave conta como novo; um aviso diferente também.
  assert.deepEqual(findNewWarnings(before, [laranja, amarelo]), [laranja])
  assert.deepEqual(findNewWarnings(before, [amarelo, vento]), [vento])
  assert.deepEqual(findNewWarnings(before, []), [])
})
