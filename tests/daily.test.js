import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeDay, weatherGroup } from '../src/lib/daily.js'
import { buildDays } from '../src/lib/weather.js'
import { dayMonth } from '../src/lib/format.js'

const day = (fn) => Array.from({ length: 24 }, (_, hour) => ({ hour, temp: 20, rainChance: 0, precip: 0, code: 0, ...fn(hour) }))

test('código de tempo da Open-Meteo vira um grupo', () => {
  assert.equal(weatherGroup(0), 'limpo')
  assert.equal(weatherGroup(2), 'parcial')
  assert.equal(weatherGroup(3), 'nublado')
  assert.equal(weatherGroup(45), 'neblina')
  assert.equal(weatherGroup(53), 'garoa')
  assert.equal(weatherGroup(61), 'chuva')
  assert.equal(weatherGroup(82), 'chuva-forte')
  assert.equal(weatherGroup(95), 'trovoada')
  assert.equal(weatherGroup(99), 'trovoada')
  assert.equal(weatherGroup(null), null)
  assert.equal(weatherGroup(1234), null)
})

test('resumo do dia: máxima, mínima, chance e volume de chuva', () => {
  const s = summarizeDay(day((h) => ({ temp: 15 + h / 2, rainChance: h === 14 ? 80 : 10, precip: h === 14 ? 6.04 : h === 15 ? 0.46 : 0 })))
  assert.equal(s.max, 26.5)
  assert.equal(s.min, 15)
  assert.equal(s.rainMax, 80)
  assert.equal(s.rainTotal, 6.5)
})

test('o tempo do dia é o mais grave que dura, e trovoada vale com 1 hora', () => {
  // Uma hora de chuva não faz dia de chuva; duas horas fazem.
  assert.equal(summarizeDay(day((h) => ({ code: h === 15 ? 63 : 1 }))).weather, 'parcial')
  assert.equal(summarizeDay(day((h) => ({ code: h === 15 || h === 16 ? 63 : 1 }))).weather, 'chuva')
  assert.equal(summarizeDay(day((h) => ({ code: h === 15 ? 95 : 3 }))).weather, 'trovoada')
  // Só conta entre 6h e 21h: chuva de madrugada não define o dia.
  assert.equal(summarizeDay(day((h) => ({ code: h < 4 ? 65 : 0 }))).weather, 'limpo')
  assert.equal(summarizeDay(day(() => ({ code: 3 }))).weatherLabel, 'Nublado')
  assert.equal(summarizeDay(day((h) => ({ code: h > 12 ? 82 : 3 }))).weather, 'chuva-forte')
})

test('sem código de tempo (dados antigos), deduz da chuva', () => {
  const none = (extra) => day((h) => ({ code: null, ...extra(h) }))
  assert.equal(summarizeDay(none(() => ({}))).weather, 'limpo')
  assert.equal(summarizeDay(none((h) => ({ rainChance: 35 }))).weather, 'nublado')
  assert.equal(summarizeDay(none((h) => ({ rainChance: 70, precip: h === 14 ? 4 : 0 }))).weather, 'chuva')
  assert.equal(summarizeDay(none((h) => ({ precip: h < 4 ? 8 : 0 }))).weather, 'chuva-forte')
})

test('dia sem dados não quebra', () => {
  const s = summarizeDay(day(() => ({ temp: null, rainChance: null, precip: null, code: null })))
  assert.equal(s.max, null)
  assert.equal(s.min, null)
  assert.equal(s.rainMax, null)
  assert.equal(s.rainTotal, 0)
  assert.equal(s.weather, 'limpo')
})

test('buildDays guarda o código de tempo de cada hora', () => {
  const hourly = { time: ['2026-11-10T00:00', '2026-11-10T01:00'], temperature_2m: [20, 19], weather_code: [3, null] }
  const [first] = buildDays(hourly, '2026-11-10')
  assert.equal(first.hours[0].code, 3)
  assert.equal(first.hours[1].code, null)
  // Previsão salva antes desta versão não tem o campo: vira null.
  assert.equal(buildDays({ time: ['2026-11-10T00:00'], temperature_2m: [20] }, '2026-11-10')[0].hours[0].code, null)
})

test('data curta dos cartões', () => {
  assert.equal(dayMonth('2026-11-10'), '10/11')
  assert.equal(dayMonth('2026-01-05'), '05/01')
})

test('previsão de teste traz um tempo variado ao longo dos 7 dias', async () => {
  const { buildDemoForecast } = await import('../src/lib/demo.js')
  const { summarize } = await import('../src/lib/weather.js')
  const days = summarize(buildDemoForecast(new Date(2026, 10, 10, 15, 0)), null).days
  const weather = days.map((d) => summarizeDay(d.hours).weather)
  assert.equal(days.length, 7)
  assert.ok(days[0].hours.every((h) => h.code != null), 'toda hora tem código de tempo')
  assert.ok(['trovoada', 'chuva-forte'].includes(weather[0]), `hoje deve ser forte, veio ${weather[0]}`)
  assert.ok(new Set(weather).size >= 3, `deve variar, veio ${weather.join(',')}`)
  const last = summarizeDay(days[6].hours)
  assert.ok(['limpo', 'parcial'].includes(last.weather))
  assert.ok(summarizeDay(days[0].hours).rainMax >= 90)
})
