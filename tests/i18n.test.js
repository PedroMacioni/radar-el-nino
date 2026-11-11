import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EN } from '../src/lib/en.js'
import { collectKeys, extractKeys } from './i18n-keys.js'

// Textos que chegam ao t() por uma variável (listas de dados), por isso o código não mostra o literal.
const INDIRECT = [
  // menu
  'Início', 'Mapa', 'Pedir ajuda',
  // faixa de emergência
  'Alerta vermelho · grande perigo', 'Aviso amarelo · atenção', 'Aviso laranja · perigo',
  'Vá para um local seguro e alto.', 'Afaste-se de rios, encostas e fios caídos.', 'Siga as orientações da Defesa Civil.',
  'Acompanhe a previsão e os avisos.', 'Em risco imediato, ligue 199.',
  'Evite áreas de alagamento e encostas.', 'Acompanhe os avisos e deixe o 199 à mão.',
  // canais sem internet
  'SMS', 'WhatsApp', 'Ligação · Defesa Civil',
  'Envie o seu CEP. É grátis.', 'Mande uma mensagem e receba os avisos do seu CEP.', 'Pedir socorro ou informar risco.',
  'Enviar SMS', 'Abrir WhatsApp', 'Ligar para 199',
  'Funciona sem internet', 'Precisa de internet', 'Emergência',
  // números e rodapé
  'Defesa Civil', 'Bombeiros', 'SAMU', 'Polícia', 'Polícia Militar',
  'Enchente, deslizamento, risco', 'Resgate e incêndio', 'Urgência de saúde', 'Segurança',
  'Avisos oficiais de tempo severo', 'Previsão, qualidade do ar, vazão dos rios e histórico de chuva', 'Focos de calor (queimadas)',
  'Volume dos reservatórios das hidrelétricas', 'Situação do El Niño', 'Garantia-Safra', 'Busca por CEP', 'Nome da cidade a partir da sua localização',
  // cartões
  'Open-Meteo (GloFAS), previsão por modelo', 'ONS, volume da região', 'Open-Meteo (ERA5), chuva contra a média', 'INPE Queimadas, focos de hoje',
  // mapa
  'Todos', 'Hoje', 'Próximos dias', 'Áreas de aviso', 'Chuva em 24 h', 'Focos de calor',
  // previsão
  'Madrugada', 'Manhã', 'Tarde', 'Noite', '00h às 05h', '06h às 11h', '12h às 17h', '18h às 23h',
  'Céu limpo', 'Parcialmente nublado', 'Nublado', 'Neblina', 'Garoa', 'Chuva', 'Chuva forte', 'Trovoada',
  'Sem aviso', 'Amarelo', 'Laranja', 'Vermelho', 'perigo potencial', 'perigo', 'grande perigo',
  // doação
  'Copiar código Pix (copia e cola)', 'Código copiado', 'Copiar chave', 'Chave copiada',
  'Sua doação mantém tudo no ar e ajuda a melhorar a previsão, os avisos e os guias.',
  // ajuda
  'Fiquei sem casa', 'Se a água ou um deslizamento atingiu a sua moradia.', 'Agora', 'Depois',
  'Ligue 199 ou procure a Defesa Civil da prefeitura. É ela que abre os abrigos temporários',
  'Vá ao CRAS do município com os documentos de todos da família. É a porta de entrada para o Cadastro Único e para programas sociais',
  'Saque do FGTS por calamidade', 'Para quem mora em área atingida e tem saldo no FGTS.', 'Quem pode',
  'Trabalhador com saldo que mora em município com emergência ou calamidade reconhecida pelo governo federal',
  'Como', 'O pedido é feito pelo app FGTS, depois que o município é reconhecido', 'Valor', 'Tem limite definido em lei. Confira no app ou na Caixa',
  'Paga R$ 1.200 em parcela única ao agricultor familiar que perde a safra por seca ou excesso de chuva.',
  'Quem tem o CAF ativo e atualizado e mora em município que aderiu ao programa',
  'A inscrição é feita pelo sindicato ou pela entidade que fez o seu CAF. Depois é preciso pagar o boleto de R$ 24 dentro do prazo',
  'Prazo', 'Muda por estado e por ano. Pergunte na prefeitura, no sindicato ou na Emater do seu município',
  'Proagro (lavoura financiada)', 'Cobre perdas de lavouras financiadas com crédito rural, por exemplo por seca ou excesso de chuva.',
  'Quem financiou a lavoura em um banco com crédito rural e contratou o Proagro', 'Avise o banco logo que perceber a perda. Os prazos são curtos',
  'Água: carro-pipa e cisterna', 'O guia por município (quem pode pedir, o que levar e onde ir) ainda está em preparo.',
  'Por enquanto', 'Procure a Defesa Civil ou a secretaria de agricultura da sua prefeitura',
  'Saúde depois da enchente', 'Evite andar em água de enchente ou em lama.', 'Atenção',
  'Febre, dor no corpo (principalmente nas panturrilhas) ou olhos amarelados nos dias seguintes ao contato com a água: procure uma unidade de saúde e conte do contato',
  'Urgência', 'Ligue 192 (SAMU)',
]

test('todo texto passado a t() tem tradução em inglês', () => {
  const used = new Set([...collectKeys('src'), ...INDIRECT])
  const missing = [...used].filter((key) => !(key in EN))
  assert.deepEqual(missing, [])
})

test('o dicionário em inglês não tem entradas sem uso', () => {
  const used = new Set([...collectKeys('src'), ...INDIRECT])
  const unused = Object.keys(EN).filter((key) => !used.has(key))
  assert.deepEqual(unused, [])
})

test('os trechos {nome} do português aparecem também no inglês', () => {
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(',')
  const bad = Object.entries(EN).filter(([pt, en]) => placeholders(pt) !== placeholders(en)).map(([pt]) => pt)
  assert.deepEqual(bad, [])
})

test('o extrator acha os dois lados de um ternário e ignora o objeto de valores', () => {
  assert.deepEqual(extractKeys("t(a ? 'um' : 'dois', { x: 'ignorado' })"), ['um', 'dois'])
  assert.deepEqual(extractKeys("const unit = 'x'; t('só este')"), ['só este'])
})

test('sem navegador o idioma é português e t() devolve o texto original', async () => {
  const { t, getLang, locale } = await import('../src/lib/i18n.js')
  assert.equal(getLang(), 'pt')
  assert.equal(locale(), 'pt-BR')
  assert.equal(t('Previsão hora a hora'), 'Previsão hora a hora')
  assert.equal(t('Atualizado às {time}', { time: '10:30' }), 'Atualizado às 10:30')
})

test('em inglês, t() traduz, troca os valores e cai no português quando falta tradução', async () => {
  const { t, setLang, getLang, locale } = await import('../src/lib/i18n.js')
  setLang('en')
  try {
    assert.equal(getLang(), 'en')
    assert.equal(locale(), 'en-US')
    assert.equal(t('Previsão hora a hora'), 'Hourly forecast')
    assert.equal(t('Atualizado às {time}', { time: '10:30' }), 'Updated at 10:30')
    assert.equal(t('texto que não existe'), 'texto que não existe')
  } finally {
    setLang('pt')
  }
})

test('formatos de data, hora e número seguem o idioma', async () => {
  const { setLang } = await import('../src/lib/i18n.js')
  const { dayMonth, formatDateTime, formatHour, formatMm } = await import('../src/lib/format.js')
  assert.equal(dayMonth('2026-11-10'), '10/11')
  assert.equal(formatHour(7), '07h')
  assert.equal(formatMm(14.5), '14,5 mm')
  setLang('en')
  try {
    assert.equal(dayMonth('2026-11-10'), 'Nov 10')
    assert.equal(formatDateTime({ date: '2026-11-10', time: '18:00' }), 'Nov 10 18:00')
    assert.equal(formatHour(7), '07:00')
    assert.equal(formatMm(14.5), '14.5 mm')
  } finally {
    setLang('pt')
  }
})

test('os textos que vêm das libs mudam de idioma junto', async () => {
  const { setLang } = await import('../src/lib/i18n.js')
  const { airLevel, uvAdvice } = await import('../src/lib/levels.js')
  const { summarizeDay } = await import('../src/lib/daily.js')
  const { describeMap } = await import('../src/lib/map.js')
  assert.equal(airLevel(10).label, 'Boa')
  setLang('en')
  try {
    assert.equal(airLevel(10).label, 'Good')
    assert.equal(uvAdvice(4), 'Wear sunscreen')
    const day = summarizeDay([{ hour: 9, temp: 20, rainChance: 0, precip: 0, code: 0 }, { hour: 10, temp: 22, rainChance: 0, precip: 0, code: 0 }])
    assert.equal(day.weatherLabel, 'Clear sky')
    assert.equal(describeMap({ areas: [] }, null).headline, 'No warning area nearby right now.')
  } finally {
    setLang('pt')
  }
})
