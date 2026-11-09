import test from 'node:test'
import assert from 'node:assert/strict'
import { areasNear, boundsNear, geometryBounds, handleMap, simplifyGeometry, simplifyRing, summarizeMunicipalities } from '../server/mapa.js'
import { listFires } from '../server/queimadas.js'
import { describeMap } from '../src/lib/map.js'

const SQUARE = { type: 'Polygon', coordinates: [[[-47.5, -23.3], [-46.6, -23.3], [-46.6, -22.5], [-47.5, -22.5], [-47.5, -23.3]]] }
const FAR_SQUARE = { type: 'Polygon', coordinates: [[[-40, -10], [-39, -10], [-39, -9], [-40, -9], [-40, -10]]] }
const POINT = { lat: -22.9, lon: -47.06 }

const raw = (id, severidade, geometry, extra = {}) => ({
  id_aviso: id, descricao: 'Chuvas intensas', severidade, poligono: JSON.stringify(geometry), data_fim: '2026-11-10', hora_fim: '12:00', ...extra,
})

test('limites de uma área e proximidade', () => {
  assert.deepEqual(geometryBounds(SQUARE), [-47.5, -23.3, -46.6, -22.5])
  assert.equal(geometryBounds(null), null)
  assert.equal(boundsNear(geometryBounds(SQUARE), POINT.lat, POINT.lon), true)
  assert.equal(boundsNear(geometryBounds(FAR_SQUARE), POINT.lat, POINT.lon), false)
})

test('simplificar o desenho tira pontos de sobra e mantém o contorno fechado', () => {
  const ring = [[0, 0], [1, 0.0001], [2, 0], [3, 0.0001], [4, 0], [4, 4], [0, 4], [0, 0]]
  const out = simplifyRing(ring, 0.004)
  assert.ok(out.length < ring.length)
  assert.deepEqual(out[0], out[out.length - 1])
  assert.ok(out.some(([x, y]) => x === 4 && y === 4), 'os cantos continuam')
  const multi = simplifyGeometry({ type: 'MultiPolygon', coordinates: [SQUARE.coordinates, FAR_SQUARE.coordinates] })
  assert.equal(multi.type, 'MultiPolygon')
  assert.equal(multi.coordinates.length, 2)
})

test('áreas por perto: só as próximas, as de dentro primeiro, e mais graves antes', () => {
  const data = {
    hoje: [raw(1, 'amarelo', SQUARE), raw(2, 'vermelho', FAR_SQUARE), raw(3, 'laranja', SQUARE)],
    futuro: [raw(4, 'vermelho', { type: 'Polygon', coordinates: [[[-46, -22], [-45.5, -22], [-45.5, -21.5], [-46, -21.5], [-46, -22]]] })],
  }
  const areas = areasNear(data, POINT.lat, POINT.lon)
  assert.deepEqual(areas.map((a) => a.id), [3, 1, 4])
  assert.equal(areas[0].inside, true)
  assert.equal(areas[1].inside, true)
  assert.equal(areas[2].inside, false)
  assert.equal(areas[2].when, 'futuro')
  assert.equal(areas[0].severity, 'laranja')
  assert.deepEqual(areas[0].end, { date: '2026-11-10', time: '12:00' })
  assert.ok(areas[0].geometry.coordinates[0].length >= 4)
  assert.deepEqual(areasNear(null, POINT.lat, POINT.lon), [])
})

test('focos para o mapa: dentro do raio, do mais perto ao mais longe, com limite', () => {
  const csv = ['id,lat,lon,x', '1,-22.95,-47.10,a', '2,-22.90,-47.06,a', '3,-22.00,-47.06,a', '4,-23.20,-47.06,a', '5,abc,def,a'].join('\n')
  const near = listFires(csv, POINT.lat, POINT.lon, 100)
  assert.deepEqual(near, [[-22.9, -47.06], [-22.95, -47.1], [-23.2, -47.06]])
  assert.equal(listFires(csv, POINT.lat, POINT.lon, 100, 2).length, 2)
  assert.equal(listFires('a,b\n1,2', POINT.lat, POINT.lon), null)
})

function fakeFetch({ inmet, fires }) {
  return async (url) => {
    if (String(url).includes('apiprevmet3')) {
      if (!inmet) throw new Error('INMET fora do ar')
      return { ok: true, json: async () => inmet }
    }
    if (!fires) return { ok: false, status: 404 }
    return { ok: true, text: async () => fires }
  }
}

test('handleMap: junta áreas e focos, e aceita uma das fontes falhar', async () => {
  const now = new Date(Date.UTC(2026, 10, 9, 15))
  const inmet = { hoje: [raw(1, 'laranja', SQUARE)] }
  const fires = 'id,lat,lon\n1,-22.95,-47.10'

  const both = await handleMap({ lat: '-22.9', lon: '-47.06' }, fakeFetch({ inmet, fires }), now)
  assert.equal(both.status, 200)
  assert.equal(both.body.areas.length, 1)
  assert.deepEqual(both.body.fires.points, [[-22.95, -47.1]])
  assert.equal(both.body.fires.radiusKm, 250)
  assert.equal(both.body.fires.date, '2026-11-09')

  const onlyFires = await handleMap({ lat: '-22.9', lon: '-47.06' }, fakeFetch({ inmet: null, fires }), now)
  assert.equal(onlyFires.status, 200)
  assert.equal(onlyFires.body.areas, null)
  assert.equal(onlyFires.body.fires.points.length, 1)

  const onlyAreas = await handleMap({ lat: '-22.9', lon: '-47.06' }, fakeFetch({ inmet, fires: null }), now)
  assert.equal(onlyAreas.status, 200)
  assert.equal(onlyAreas.body.fires, null)

  const none = await handleMap({ lat: '-22.9', lon: '-47.06' }, fakeFetch({ inmet: null, fires: null }), now)
  assert.equal(none.status, 502)
  assert.equal((await handleMap({ lat: 'x', lon: '1' }, fakeFetch({}), now)).status, 400)
})

test('frase do mapa: dentro, perto, nenhuma, erro e focos', () => {
  const area = (extra) => ({ inside: false, severity: 'laranja', when: 'hoje', end: { date: '2026-11-10', time: '12:00' }, ...extra })
  const inside = describeMap({ areas: [area({ inside: true })], fires: { points: [[-22.95, -47.1], [-20, -40]] } }, POINT)
  assert.equal(inside.headline, 'Você está dentro de uma área de aviso laranja até 10/11 12:00.')
  assert.equal(inside.level, 'laranja')
  assert.equal(inside.firesLine, '1 foco de calor em 50 km.')

  const future = describeMap({ areas: [area({ inside: true, when: 'futuro', severity: 'vermelho' })] }, POINT)
  assert.match(future.headline, /previsto/)

  const near = describeMap({ areas: [area(), area()] }, POINT)
  assert.equal(near.headline, 'Há 2 áreas de aviso por perto, mas o seu local não está dentro delas.')
  assert.equal(describeMap({ areas: [area()] }, POINT).headline, 'Há 1 área de aviso por perto, mas o seu local não está dentro dela.')

  const none = describeMap({ areas: [], fires: { points: [] } }, POINT)
  assert.equal(none.headline, 'Nenhuma área de aviso por perto agora.')
  assert.equal(none.level, 'sem')
  assert.equal(none.firesLine, 'Nenhum foco de calor em 50 km.')

  const failed = describeMap({ areas: null, fires: null }, POINT)
  assert.match(failed.headline, /Não foi possível/)
  assert.equal(failed.firesLine, null)
})

test('mapa de teste: áreas de vários níveis, previsto, riscos, focos e chuva', async () => {
  const { buildDemoMap, buildDemoRain } = await import('../src/lib/demo.js')
  const place = { lat: -22.9, lon: -47.06 }
  const demo = buildDemoMap(place, 'vermelho', new Date(2026, 10, 9))
  assert.deepEqual(demo.areas.map((a) => a.severity), ['vermelho', 'amarelo', 'vermelho', 'amarelo'])
  assert.equal(demo.areas[0].inside, true)
  assert.equal(demo.areas.filter((a) => a.inside).length, 1)
  assert.equal(demo.areas[3].when, 'futuro')
  assert.ok(demo.areas.every((a) => a.risks && a.tips.length > 0 && a.reach.count > 0))
  assert.equal(demo.fires.points.length, 16)
  const laranja = buildDemoMap(place, 'laranja')
  assert.deepEqual(laranja.areas.map((a) => a.severity), ['laranja', 'amarelo', 'amarelo'])
  assert.equal(buildDemoMap({ lat: 0, lon: 0 }, 'amarelo').areas[1].severity, 'laranja')
  assert.match(describeMap(demo, place).headline, /dentro de uma área de aviso vermelho/)

  const rain = buildDemoRain(place, 'vermelho')
  assert.equal(rain.cells.length, 81)
  const center = rain.cells[40]
  const edge = rain.cells[0]
  assert.ok(center.mm > 60, 'o centro tem chuva extrema no cenário vermelho')
  assert.ok(center.mm > edge.mm, 'a chuva diminui com a distância')
  assert.ok(buildDemoRain(place, 'amarelo').cells[40].mm < center.mm)
})

test('resumo dos municípios: conta, estados e não manda a lista inteira', () => {
  const text = 'Campinas - SP (3509502),Valinhos - SP (3556206),Poços de Caldas - MG (3151800),Abaíra - BA (2900108)'
  assert.deepEqual(summarizeMunicipalities(text), { count: 4, states: ['SP', 'MG', 'BA'], moreStates: 0 })
  assert.deepEqual(summarizeMunicipalities(null), { count: 0, states: [], moreStates: 0 })
  const many = Array.from({ length: 12 }, (_, i) => `Cidade ${i} - ${String.fromCharCode(65 + i)}${String.fromCharCode(65 + i)} (${1000000 + i})`).join(',')
  const big = summarizeMunicipalities(many)
  assert.equal(big.count, 12)
  assert.equal(big.states.length, 8)
  assert.equal(big.moreStates, 4)
})

test('área traz riscos, instruções e alcance, como o INMET manda', () => {
  const geometry = { type: 'Polygon', coordinates: [[[-47.5, -23.3], [-46.6, -23.3], [-46.6, -22.5], [-47.5, -22.5], [-47.5, -23.3]]] }
  const data = { hoje: [{
    id_aviso: 9, descricao: 'Tempestade', severidade: 'Perigo Potencial', poligono: JSON.stringify(geometry),
    data_inicio: '2026-11-09T00:00:00.000Z', hora_inicio: '09:27', data_fim: '2026-11-09T00:00:00.000Z', hora_fim: '23:59',
    riscos: ['Chuva entre 20 e 30 mm/h.   ', 'Baixo risco de alagamentos.'],
    instrucoes: ['Evite usar aparelhos ligados à tomada. ', 'Ligue 199.', '', 'a', 'b', 'c'],
    municipios: 'Campinas - SP (3509502),Valinhos - SP (3556206)',
  }] }
  const [area] = areasNear(data, -22.9, -47.06)
  assert.equal(area.severity, 'amarelo')
  assert.equal(area.title, 'Tempestade')
  assert.equal(area.risks, 'Chuva entre 20 e 30 mm/h. Baixo risco de alagamentos.')
  assert.deepEqual(area.tips.slice(0, 2), ['Evite usar aparelhos ligados à tomada.', 'Ligue 199.'])
  assert.equal(area.tips.length, 4)
  assert.deepEqual(area.reach, { count: 2, states: ['SP'], moreStates: 0 })
  assert.deepEqual(area.start, { date: '2026-11-09', time: '09:27' })
  // Sem riscos nem instruções: campos vazios, sem quebrar.
  const bare = areasNear({ hoje: [{ id_aviso: 1, severidade: 'Perigo', poligono: JSON.stringify(geometry) }] }, -22.9, -47.06)[0]
  assert.equal(bare.risks, null)
  assert.deepEqual(bare.tips, [])
  assert.equal(bare.reach.count, 0)
})

test('grade de chuva: 9 x 9 pontos ao redor do local, e leitura da resposta', async () => {
  const { buildRainGrid, parseRain, rainBin, summarizeRain, summarizeAreas, formatMm } = await import('../src/lib/map.js')
  const grid = buildRainGrid(-22.9, -47.06)
  assert.equal(grid.length, 81)
  assert.ok(grid.some((p) => p.lat === -22.9 && p.lon === -47.06), 'o centro é o próprio local')
  assert.equal(buildRainGrid(89.9, 0).every((p) => Math.abs(p.lat) <= 90), true)

  const response = grid.map((_, i) => ({ hourly: { precipitation: i === 40 ? [10, 5.5, null, 4.25] : [0.2, 0.3] } }))
  const cells = parseRain(grid, response)
  assert.equal(cells[40].mm, 19.8)
  assert.equal(cells[0].mm, 0.5)
  assert.equal(parseRain([grid[0]], { hourly: { precipitation: [1, 2] } })[0].mm, 3)
  assert.equal(parseRain(grid, []).every((c) => c.mm === 0), true)

  const summary = summarizeRain({ cells }, { lat: -22.9, lon: -47.06 })
  assert.equal(summary.here, 19.8)
  assert.equal(summary.max, 19.8)
  assert.equal(summarizeRain({ cells: [] }, { lat: 0, lon: 0 }), null)

  assert.equal(rainBin(0.4), null)
  assert.equal(rainBin(1).key, 'fraca')
  assert.equal(rainBin(14.9).key, 'moderada')
  assert.equal(rainBin(15).key, 'forte')
  assert.equal(rainBin(59).key, 'muito-forte')
  assert.equal(rainBin(120).key, 'extrema')
  assert.equal(formatMm(12.34), '12,3 mm')

  const counts = summarizeAreas([{ severity: 'vermelho', inside: true }, { severity: 'amarelo', inside: false }, { severity: 'amarelo', inside: false }])
  assert.deepEqual(counts, { total: 3, by: { vermelho: 1, laranja: 0, amarelo: 2 }, inside: 1 })
  assert.deepEqual(summarizeAreas(null), { total: 0, by: { vermelho: 0, laranja: 0, amarelo: 0 }, inside: 0 })
})

test('chuva estimada entre os pontos da grade', async () => {
  const { buildRainField, rainAt, RAIN_STEP } = await import('../src/lib/map.js')
  assert.equal(buildRainField([]), null)
  const cells = []
  // 3 x 3: chuva = 10 vezes a coluna (0, 10, 20 mm), igual em todas as linhas.
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ lat: 1 + i * RAIN_STEP, lon: 2 + j * RAIN_STEP, mm: j * 10 })
  const field = buildRainField(cells)
  assert.equal(rainAt(field, 1, 2), 0)
  assert.equal(rainAt(field, 1 + RAIN_STEP, 2 + RAIN_STEP), 10)
  assert.equal(rainAt(field, 1, 2 + RAIN_STEP * 0.5), 5)
  assert.equal(rainAt(field, 1 + RAIN_STEP * 2, 2 + RAIN_STEP * 1.5), 15)
  // Até meio passo fora da grade usa o valor da borda; além disso, não há dado.
  assert.equal(rainAt(field, 1 - RAIN_STEP * 0.4, 2 + RAIN_STEP * 2), 20)
  assert.equal(rainAt(field, 1 - RAIN_STEP, 2), null)
  assert.equal(rainAt(null, 1, 2), null)
})

test('rota /teste/extremo: é de teste, é vermelha e tem mais de tudo', async () => {
  const { isDemoRoute, isExtremeDemo, demoLevel, buildDemoMap, buildDemoRain } = await import('../src/lib/demo.js')
  const { isKnownRoute } = await import('../src/lib/routes.js')
  assert.equal(isDemoRoute('/teste/extremo'), true)
  assert.equal(isDemoRoute('/teste/extremo/'), true)
  assert.equal(isKnownRoute('/teste/extremo'), true)
  assert.equal(isExtremeDemo('/teste/extremo'), true)
  assert.equal(isExtremeDemo('/teste'), false)
  assert.equal(isExtremeDemo('/teste/vermelho'), false)
  assert.equal(demoLevel('/teste/extremo', ''), 'vermelho')

  const place = { lat: -22.9, lon: -47.06 }
  const normal = buildDemoMap(place, 'vermelho', new Date(2026, 10, 9))
  const extreme = buildDemoMap(place, 'vermelho', new Date(2026, 10, 9), true)
  assert.ok(extreme.areas.length > normal.areas.length)
  assert.ok(extreme.areas.filter((a) => a.severity === 'vermelho').length >= 3)
  assert.equal(new Set(extreme.areas.map((a) => a.id)).size, extreme.areas.length, 'ids únicos')
  assert.equal(extreme.areas.filter((a) => a.inside).length, 1)
  assert.equal(extreme.fires.points.length, 44)
  assert.ok(buildDemoRain(place, 'vermelho', true).cells[40].mm > buildDemoRain(place, 'vermelho').cells[40].mm)
})

test('ponto dentro de polígono, com buraco e multipolígono', async () => {
  const { pointInGeometry } = await import('../src/lib/map.js')
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
  const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
  assert.equal(pointInGeometry(5, 5, { type: 'Polygon', coordinates: [square] }), true)
  assert.equal(pointInGeometry(15, 5, { type: 'Polygon', coordinates: [square] }), false)
  assert.equal(pointInGeometry(5, 5, { type: 'Polygon', coordinates: [square, hole] }), false)
  const far = [[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]
  const multi = { type: 'MultiPolygon', coordinates: [[square], [far]] }
  assert.equal(pointInGeometry(25, 25, multi), true)
  assert.equal(pointInGeometry(15, 15, multi), false)
  assert.equal(pointInGeometry(1, 1, null), false)
})

test('clique no mapa: mostra o que é e fica quieto quando não há nada', async () => {
  const { whatIsHere, buildRainField, RAIN_STEP } = await import('../src/lib/map.js')
  const geometry = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] }
  const areas = [{ id: 1, severity: 'laranja', title: 'Chuvas', geometry }]
  const cells = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cells.push({ lat: i * RAIN_STEP, lon: j * RAIN_STEP, mm: 20 })
  const field = buildRainField(cells)
  const all = { areas: true, rain: true, fires: true }

  // Em cima de uma área, de chuva e de um foco: os três, nessa ordem.
  const full = whatIsHere({ lat: 0.4, lon: 0.4, areas, field, fireNearby: true, show: all })
  assert.deepEqual(full.map((item) => item.kind), ['area', 'fire', 'rain'])
  assert.equal(full[0].area.title, 'Chuvas')
  assert.equal(full[2].mm, 20)
  assert.equal(full[2].label, '15 a 30 mm')

  // Fora de tudo: nada (nenhum balão).
  assert.deepEqual(whatIsHere({ lat: 50, lon: 50, areas, field, show: all }), [])
  assert.deepEqual(whatIsHere({ lat: 50, lon: 50 }), [])

  // Chuva fraca (menos de 1 mm) não conta como informação.
  const dry = buildRainField(cells.map((cell) => ({ ...cell, mm: 0.4 })))
  assert.deepEqual(whatIsHere({ lat: 0.4, lon: 0.4, field: dry, show: all }), [])

  // Camada desligada não aparece no balão.
  const onlyRain = whatIsHere({ lat: 0.4, lon: 0.4, areas, field, fireNearby: true, show: { areas: false, rain: true, fires: false } })
  assert.deepEqual(onlyRain.map((item) => item.kind), ['rain'])
  assert.deepEqual(whatIsHere({ lat: 0.4, lon: 0.4, areas, field, fireNearby: true, show: { areas: false, rain: false, fires: false } }), [])
})
