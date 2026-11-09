import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDays, rainLast24h, splitPeriods, summarize } from '../src/lib/weather.js'
import { buildChart } from '../src/lib/chart.js'
import { airLevel, uvLevel } from '../src/lib/levels.js'
import { isCep, resolveQuery } from '../src/lib/geo.js'

// Três dias de dados horários: 08/11 (dia extra), 09/11 (hoje) e 10/11.
function makeHourly() {
  const time = []
  for (const day of ['2026-11-08', '2026-11-09', '2026-11-10']) {
    for (let h = 0; h < 24; h++) time.push(`${day}T${String(h).padStart(2, '0')}:00`)
  }
  return {
    time,
    temperature_2m: time.map((_, i) => 15 + (i % 24) / 2),
    apparent_temperature: time.map((_, i) => 14 + (i % 24) / 2),
    precipitation_probability: time.map((_, i) => (i % 24) * 4),
    precipitation: time.map((_, i) => (i === 38 ? 2.5 : 0.5)),
    uv_index: time.map((_, i) => ((i % 24) === 12 ? 9 : 0)),
  }
}

const forecast = {
  current: { time: '2026-11-09T14:15', temperature_2m: 24, apparent_temperature: 25, relative_humidity_2m: 60, wind_speed_10m: 12 },
  hourly: makeHourly(),
  daily: { time: ['2026-11-08', '2026-11-09', '2026-11-10'], sunrise: ['2026-11-08T05:20', '2026-11-09T05:19', '2026-11-10T05:18'], sunset: ['2026-11-08T18:30', '2026-11-09T18:31', '2026-11-10T18:32'] },
}

test('buildDays ignora o dia extra e devolve 24 horas por dia', () => {
  const days = buildDays(forecast.hourly, '2026-11-09')
  assert.deepEqual(days.map((d) => d.date), ['2026-11-09', '2026-11-10'])
  assert.equal(days[0].hours.length, 24)
  assert.equal(days[0].hours[14].hour, 14)
})

test('splitPeriods divide o dia em quatro blocos de seis horas', () => {
  const [first] = buildDays(forecast.hourly, '2026-11-09')
  const periods = splitPeriods(first.hours)
  assert.deepEqual(periods.map((p) => p.name), ['Madrugada', 'Manhã', 'Tarde', 'Noite'])
  assert.ok(periods.every((p) => p.hours.length === 6))
  assert.equal(periods[2].hours[0].hour, 12)
})

test('chuva das últimas 24 horas soma até a hora atual', () => {
  // índice 38 = 09/11 14h (24 + 14). Janela: índices 15..38.
  const total = rainLast24h(forecast.hourly, '2026-11-09T14:00')
  assert.equal(total, 24 * 0.5 + 2)
  assert.equal(rainLast24h(forecast.hourly, '2030-01-01T00:00'), null)
})

test('summarize junta agora, dias, sol e ar', () => {
  const s = summarize(forecast, { current: { european_aqi: 45, pm2_5: 12.4 } })
  assert.equal(s.today, '2026-11-09')
  assert.equal(s.nowHour, 14)
  assert.equal(s.updatedAt, '14:15')
  assert.equal(s.days.length, 2)
  assert.deepEqual(s.sun, { rise: '05:19', set: '18:31' })
  assert.equal(s.now.temp, 24)
  assert.deepEqual(s.air, { eaqi: 45, pm25: 12.4 })
  assert.equal(summarize(forecast, null).air, null)
})

test('gráfico fica dentro da área e ignora horas sem dado', () => {
  const [first] = buildDays(forecast.hourly, '2026-11-09')
  const hours = first.hours.map((h, i) => (i === 5 ? { ...h, temp: null, rainChance: null } : h))
  const chart = buildChart(hours, { narrow: false, nowHour: 14 })
  assert.equal(chart.bars.length, 23)
  assert.ok(chart.bars.every((b) => b.y >= chart.top && b.y + b.height <= chart.bottom + 0.001))
  assert.ok(chart.linePath.startsWith('M'))
  assert.ok(chart.linePath.includes(' M'), 'a linha deve ser interrompida onde falta dado')
  assert.ok(chart.nowX > chart.x0 && chart.nowX < chart.xRight)
  assert.equal(chart.points.length, 23)
  assert.ok(chart.bars.every((b) => typeof b.color === 'string'))
  assert.equal(buildChart(hours, { narrow: true }).width, 350)
  const empty = buildChart([], {})
  assert.equal(empty.linePath, '')
  assert.equal(empty.tempMin, null)
})

test('níveis de UV e de ar', () => {
  assert.equal(uvLevel(2).key, 'sem')
  assert.equal(uvLevel(4).label, 'Moderado')
  assert.equal(uvLevel(9).key, 'vermelho')
  assert.equal(uvLevel(12).label, 'Extremo')
  assert.equal(uvLevel(null), null)
  assert.equal(airLevel(15).label, 'Boa')
  assert.equal(airLevel(70).key, 'laranja')
  assert.equal(airLevel(120).label, 'Extremamente ruim')
})

test('reconhece CEP com e sem hífen', () => {
  assert.equal(isCep('13010-000'), true)
  assert.equal(isCep('13010000'), true)
  assert.equal(isCep('Campinas'), false)
  assert.equal(isCep('1301-000'), false)
})

test('resolveQuery por CEP escolhe a cidade do estado certo', async () => {
  const calls = []
  const fakeFetch = async (url) => {
    calls.push(String(url))
    if (String(url).includes('viacep')) return { ok: true, json: async () => ({ localidade: 'Campinas', uf: 'SP' }) }
    return {
      ok: true,
      json: async () => ({ results: [
        { id: 1, name: 'Campinas', admin1: 'Pará', latitude: -1, longitude: -50 },
        { id: 2, name: 'Campinas', admin1: 'São Paulo', latitude: -22.9, longitude: -47.06 },
      ] }),
    }
  }
  const { places } = await resolveQuery('13010-000', fakeFetch)
  assert.equal(places.length, 1)
  assert.equal(places[0].state, 'São Paulo')
  assert.ok(calls[0].includes('13010000'))
})

test('resolveQuery: CEP inexistente e busca vazia', async () => {
  const notFound = async () => ({ ok: true, json: async () => ({ erro: true }) })
  const r = await resolveQuery('00000-000', notFound)
  assert.deepEqual(r.places, [])
  assert.match(r.message, /CEP/)
  assert.deepEqual((await resolveQuery('   ')).places, [])
})

test('rota /teste gera um dia extremo com aviso vermelho', async () => {
  const { buildDemoForecast, buildDemoWarnings, isDemoRoute, DEMO_AIR } = await import('../src/lib/demo.js')
  assert.equal(isDemoRoute('/teste'), true)
  assert.equal(isDemoRoute('/teste/'), true)
  assert.equal(isDemoRoute('/teste/laranja'), true)
  assert.equal(isDemoRoute('/teste/amarelo/'), true)
  assert.equal(isDemoRoute('/teste/outro'), false)
  assert.equal(isDemoRoute('/'), false)
  const { demoLevel } = await import('../src/lib/demo.js')
  assert.equal(demoLevel('/teste', ''), 'vermelho')
  assert.equal(demoLevel('/teste/laranja', ''), 'laranja')
  assert.equal(demoLevel('/teste', '?nivel=amarelo'), 'amarelo')
  const now = new Date(2026, 10, 9, 15, 20)
  const s = summarize(buildDemoForecast(now), DEMO_AIR)
  assert.equal(s.nowHour, 15)
  assert.equal(s.days.length, 7)
  assert.equal(s.days[0].hours.length, 24)
  assert.ok(s.now.rain24h > 50)
  assert.ok(Math.max(...s.days[0].hours.map((h) => h.rainChance)) >= 95)
  assert.equal(buildDemoWarnings(now)[0].severity, 'vermelho')
})

test('queimadas: conta focos no raio e acha o mais próximo', async () => {
  const { countFires, distanceKm } = await import('../server/queimadas.js')
  const csv = ['id,lat,lon,data_hora_gmt', '1,-22.90,-47.06,x', '2,-22.95,-47.10,x', '3,-23.80,-47.06,x', '4,-10,-50,x', '5,abc,def,x'].join('\n')
  const r = countFires(csv, -22.9, -47.06)
  assert.equal(r.count, 2)
  assert.equal(r.nearestKm, 0)
  assert.equal(countFires('a,b\n1,2', -22.9, -47.06), null)
  assert.ok(Math.abs(distanceKm(-22.9, -47.06, -22.9, -46.06) - 102.5) < 1)
})

test('rios e queimadas viram níveis', async () => {
  const { riverStatus, fireStatus } = await import('../src/lib/environment.js')
  const mk = (values) => ({ daily: { time: values.map((_, i) => `2026-11-0${i + 8}`), river_discharge: values } })
  assert.equal(riverStatus(mk([10, 20, 22, 21, 20, 19, 20, 20]), '2026-11-09').level.key, 'sem')
  assert.equal(riverStatus(mk([12, 20, 55, 110, 140, 90, 60, 40]), '2026-11-09').level.key, 'vermelho')
  assert.equal(riverStatus(mk([5, 10, 25, 30, 20, 15, 12, 10]), '2026-11-09').level.key, 'laranja')
  assert.equal(riverStatus(mk([1, 1.1, 2.4, 2, 1.5, 1, 1, 1]), '2026-11-09').level.key, 'sem')
  assert.equal(riverStatus(mk([2, 4, 9, 10, 8, 6, 5, 4]), '2026-11-09').level.key, 'amarelo')
  assert.equal(riverStatus(mk([1, 1, 1, 1, 1, 1, 1, 1]), '2026-12-01'), null)
  assert.equal(fireStatus({ count: 0, nearestKm: 22, radiusKm: 50 }).level.key, 'sem')
  assert.equal(fireStatus({ count: 2, nearestKm: 18, radiusKm: 50 }).level.key, 'amarelo')
  assert.equal(fireStatus({ count: 8, nearestKm: 12, radiusKm: 50 }).level.key, 'laranja')
  assert.equal(fireStatus({ count: 40, nearestKm: 3, radiusKm: 50 }).level.key, 'vermelho')
  assert.equal(fireStatus(null), null)
})
