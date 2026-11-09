import test from 'node:test'
import assert from 'node:assert/strict'
import { subsystemForState, parseEar, summarizeEar } from '../server/reservatorios.js'
import { reservoirStatus, droughtStatus } from '../src/lib/environment.js'

test('reservatórios: estado vira subsistema do ONS', () => {
  assert.equal(subsystemForState('São Paulo'), 'SE')
  assert.equal(subsystemForState('Estado de São Paulo'), 'SE')
  assert.equal(subsystemForState('RS'), 'S')
  assert.equal(subsystemForState('Ceará'), 'NE')
  assert.equal(subsystemForState('Pará'), 'N')
  assert.equal(subsystemForState('Narnia'), null)
  assert.equal(subsystemForState(''), null)
})

test('reservatórios: lê o CSV do ONS e compara com a semana e o ano anteriores', () => {
  const csv = [
    'id_subsistema;nom_subsistema;ear_data;ear_max_subsistema;ear_verif_subsistema_mwmes;ear_verif_subsistema_percentual',
    'SE;SUDESTE;2026-11-01;200;60;30.0',
    'S ;SUL;2026-11-08;200;80;80.0',
    'SE;SUDESTE;2026-11-08;200;50;25.0',
  ].join('\n')
  const rows = parseEar(csv, 'SE')
  assert.equal(rows.length, 2)
  const previous = parseEar('id_subsistema;ear_data;ear_verif_subsistema_percentual\nSE;2025-11-08;50.5', 'SE')
  assert.deepEqual(summarizeEar(rows, previous), { date: '2026-11-08', percent: 25, weekAgoPercent: 30, lastYearPercent: 50.5 })
  assert.equal(summarizeEar([]), null)
  assert.deepEqual(parseEar('a;b\n1;2', 'SE'), [])
})

test('reservatórios: níveis pelo volume armazenado', () => {
  assert.equal(reservoirStatus({ percent: 12, name: 'Sul' }).level.key, 'vermelho')
  assert.equal(reservoirStatus({ percent: 28, name: 'Sul' }).level.key, 'laranja')
  assert.equal(reservoirStatus({ percent: 42, name: 'Sul' }).level.key, 'amarelo')
  const ok = reservoirStatus({ percent: 70, name: 'Sul', weekAgoPercent: 66, lastYearPercent: 50 })
  assert.equal(ok.level.key, 'sem')
  assert.match(ok.value, /subindo/)
  assert.match(ok.value, /ano passado: 50%/)
  assert.equal(reservoirStatus(null), null)
})

test('seca: chuva dos últimos 90 dias contra a média', () => {
  // 4 anos de histórico com 3 mm por dia.
  const time = []
  const normal = []
  for (let i = 0; i < 365 * 4; i++) {
    time.push(new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10))
    normal.push(3)
  }
  const dry = normal.map((v, i) => (i >= normal.length - 90 ? 0.4 : v))
  const wet = normal.map((v, i) => (i >= normal.length - 90 ? 6 : v))
  assert.equal(droughtStatus({ daily: { time, precipitation_sum: dry } }).level.key, 'vermelho')
  assert.equal(droughtStatus({ daily: { time, precipitation_sum: normal } }).level.label, 'Chuva normal')
  assert.equal(droughtStatus({ daily: { time, precipitation_sum: wet } }).level.label, 'Chuva acima')
  // Região de seca normal (média baixa) não deve alarmar.
  const arid = normal.map(() => 0.1)
  assert.equal(droughtStatus({ daily: { time, precipitation_sum: arid } }).level.label, 'Seco normal')
  // Poucos dados: sem resposta.
  assert.equal(droughtStatus({ daily: { time: time.slice(0, 50), precipitation_sum: normal.slice(0, 50) } }), null)
})

test('ar e UV em linguagem comum', async () => {
  const { airAdvice, uvAdvice } = await import('../src/lib/levels.js')
  assert.equal(airAdvice(10).care, null)
  assert.equal(airAdvice(70).headline, 'Evite esforço ao ar livre')
  assert.match(airAdvice(70).care, /asma/)
  assert.equal(airAdvice(150).headline, 'Evite sair de casa')
  assert.equal(airAdvice(null), null)
  assert.equal(uvAdvice(1), 'Sem risco para a maioria das pessoas')
  assert.equal(uvAdvice(4), 'Use protetor solar')
  assert.equal(uvAdvice(12), 'Evite o sol entre 10h e 16h')
  assert.equal(uvAdvice(null), null)
})

test('rotas conhecidas e tela 404', async () => {
  const { isKnownRoute } = await import('../src/lib/routes.js')
  for (const path of ['/', '/index.html', '/teste', '/teste/', '/teste/laranja', '/teste/amarelo', '/teste/vermelho']) {
    assert.equal(isKnownRoute(path), true, path)
  }
  for (const path of ['/xyz', '/teste/outro', '/teste/laranja/extra', '/ajuda', '/api/nada']) {
    assert.equal(isKnownRoute(path), false, path)
  }
})

test('rota de doação é conhecida', async () => {
  const { isDonateRoute, isKnownRoute } = await import('../src/lib/routes.js')
  assert.equal(isDonateRoute('/apoie'), true)
  assert.equal(isDonateRoute('/apoie/'), true)
  assert.equal(isDonateRoute('/apoie/x'), false)
  assert.equal(isKnownRoute('/apoie'), true)
  assert.equal(isKnownRoute('/doe'), false)
})
