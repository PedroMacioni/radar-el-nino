import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setLang } from '../src/lib/i18n.js'
import { translateInmet, translateTitle } from '../src/lib/inmet.js'

// Textos reais publicados pelo INMET.
const RISKS = [
  'Chuva entre 20 a 30 mm/h ou até 50 mm/dia. Baixo risco de alagamentos e pequenos deslizamentos, em cidades com tais áreas de risco.',
  'Chuva entre 20 e 30 mm/h ou até 50 mm/dia, ventos intensos (40-60 km/h). Baixo risco de corte de energia elétrica, queda de galhos de árvores, alagamentos e de descargas elétricas.',
  'Chuva entre 20 e 30 mm/h ou até 50 mm/dia, ventos intensos (40-60 km/h), e queda de granizo. Baixo risco de corte de energia elétrica, estragos em plantações, queda de galhos de árvores e de alagamentos.',
  'Chuva entre 30 a 60 mm/h ou 50 a 100 mm/dia. Risco de alagamentos, deslizamentos de encostas, transbordamentos de rios, em cidades com tais áreas de risco.',
]
const TIPS = [
  'Evite enfrentar o mau tempo. ',
  'Observe alteração nas encostas. ',
  'Evite usar aparelhos eletrônicos ligados à tomada. ',
  'Obtenha mais informações junto à Defesa Civil (telefone 199) e ao Corpo de Bombeiros (telefone 193).',
  'Em caso de rajadas de vento: (não se abrigue debaixo de árvores, pois há leve risco de queda e descargas elétricas e não estacione veículos próximos a torres de transmissão e placas de propaganda). ',
  'Se possível, desligue aparelhos elétricos e quadro geral de energia. ',
  'Em caso de situação de inundação, ou similar, proteja seus pertences da água envoltos em sacos plásticos. ',
]
const PORTUGUESE = /\b(de|da|em|ou|com|para|queda|risco|chuva|ventos|evite|obtenha|alagamentos|caso)\b/i

test('em português os textos do INMET passam sem mudar', () => {
  assert.equal(translateTitle('Tempestade'), 'Tempestade')
  assert.equal(translateInmet(RISKS[0]), RISKS[0])
})

test('em inglês, títulos, riscos e instruções reais do INMET são traduzidos por inteiro', () => {
  setLang('en')
  try {
    assert.equal(translateTitle('Tempestade'), 'Storm')
    assert.equal(translateTitle('Chuvas Intensas'), 'Heavy Rain')
    assert.equal(translateTitle('Acumulado de Chuva'), 'Accumulated Rain')
    assert.equal(translateTitle('Declínio de Temperatura'), 'Temperature Drop')
    assert.equal(translateTitle('Fenômeno novo'), 'Fenômeno novo')
    for (const text of [...RISKS, ...TIPS]) {
      const out = translateInmet(text)
      assert.doesNotMatch(out, PORTUGUESE, out)
    }
    assert.equal(
      translateInmet(RISKS[2]),
      'Rain of 20 to 30 mm/h or up to 50 mm/day, strong winds (40-60 km/h), and hail. Low risk of power outages, crop damage, falling tree branches and flooding.',
    )
    assert.equal(
      translateInmet(RISKS[0]),
      'Rain of 20 to 30 mm/h or up to 50 mm/day. Low risk of flooding and small landslides, in cities with such risk areas.',
    )
    assert.equal(translateInmet(TIPS[0]), 'Avoid going out in the bad weather.')
    assert.equal(
      translateInmet('Chuva acima de 100 mm em 24 h e ventos de até 100 km/h. Risco de alagamentos, deslizamentos e queda de árvores.'),
      'Rain above 100 mm in 24 h and winds of up to 100 km/h. Risk of flooding, landslides and falling trees.',
    )
  } finally {
    setLang('pt')
  }
})

test('lista do INMET vira um texto só e texto desconhecido fica como veio', () => {
  setLang('en')
  try {
    assert.equal(translateInmet(['Evite enfrentar o mau tempo. ', 'Observe alteração nas encostas. ']), 'Avoid going out in the bad weather. Watch for changes on hillsides.')
    assert.equal(translateInmet('Temperatura acima da média por 3 dias.'), 'Temperatura acima da média por 3 dias.')
    assert.equal(translateInmet(null), null)
  } finally {
    setLang('pt')
  }
})
