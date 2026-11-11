import { getLang } from './i18n.js'

// Tradução dos textos dos avisos do INMET (títulos, riscos e instruções) para o inglês.
// O INMET escreve esses textos num padrão fixo, então não precisa de serviço de tradução:
// títulos e instruções vêm de uma lista e os riscos de regras que acertam números e listas.
// O que não for reconhecido continua em português, como o órgão publicou.

const TITLES = {
  'acumulado de chuva': 'Accumulated Rain',
  'chuvas intensas': 'Heavy Rain',
  'tempestade': 'Storm',
  'tempestade local/convectiva': 'Local/Convective Storm',
  'baixa umidade': 'Low Humidity',
  'declinio de temperatura': 'Temperature Drop',
  'friagem': 'Cold Snap (Friagem)',
  'geada': 'Frost',
  'onda de calor': 'Heat Wave',
  'onda de frio': 'Cold Wave',
  'ventos costeiros': 'Coastal Winds',
  'ventos fortes': 'Strong Winds',
  'vendaval': 'Gale',
  'ressaca': 'Rough Seas',
  'granizo': 'Hail',
  'descargas eletricas': 'Lightning',
  'nevoeiro': 'Dense Fog',
  'neve': 'Snow',
  'ciclone': 'Cyclone',
  'tornado': 'Tornado',
  'altas temperaturas': 'High Temperatures',
}

// Instruções padronizadas. A chave é a frase sem espaço nas pontas.
const SENTENCES = {
  'Evite enfrentar o mau tempo.': 'Avoid going out in the bad weather.',
  'Observe alteração nas encostas.': 'Watch for changes on hillsides.',
  'Evite usar aparelhos eletrônicos ligados à tomada.': 'Avoid using electronic devices plugged into the outlet.',
  'Obtenha mais informações junto à Defesa Civil (telefone 199) e ao Corpo de Bombeiros (telefone 193).': 'Get more information from Civil Defense (phone 199) and the Fire Department (phone 193).',
  'Em caso de rajadas de vento: (não se abrigue debaixo de árvores, pois há leve risco de queda e descargas elétricas e não estacione veículos próximos a torres de transmissão e placas de propaganda).': 'In case of wind gusts: (do not shelter under trees, as there is a slight risk of them falling and of lightning, and do not park vehicles near transmission towers and billboards).',
  'Se possível, desligue aparelhos elétricos e quadro geral de energia.': 'If possible, switch off electrical appliances and the main power panel.',
  'Em caso de situação de inundação, ou similar, proteja seus pertences da água envoltos em sacos plásticos.': 'In case of flooding or similar, protect your belongings from the water by wrapping them in plastic bags.',
  'Procure um abrigo seguro e evite áreas de alagamento e encostas.': 'Find a safe shelter and avoid flood-prone areas and hillsides.',
  'Não se abrigue debaixo de árvores nem perto de fios caídos.': 'Do not shelter under trees or near fallen power lines.',
}

// Regras para os riscos, na ordem. Cada uma troca um trecho padronizado.
const RULES = [
  [/Chuva entre (\d+) (?:a|e) (\d+) mm\/h/g, 'Rain of $1 to $2 mm/h'],
  [/Chuva entre (\d+) (?:a|e) (\d+) mm\/dia/g, 'Rain of $1 to $2 mm/day'],
  [/Chuva entre (\d+) (?:a|e) (\d+) mm em 24 ?h/g, 'Rain of $1 to $2 mm in 24 h'],
  [/Chuva acima de (\d+) mm em 24 ?h/g, 'Rain above $1 mm in 24 h'],
  [/Chuva acima de (\d+) mm\/dia/g, 'Rain above $1 mm/day'],
  [/Chuva acima de (\d+) mm\/h/g, 'Rain above $1 mm/h'],
  [/ou até (\d+) mm\/dia/g, 'or up to $1 mm/day'],
  [/ou (\d+) a (\d+) mm\/dia/g, 'or $1 to $2 mm/day'],
  [/ventos intensos \((\d+)-(\d+) km\/h\)/g, 'strong winds ($1-$2 km/h)'],
  [/ventos de até (\d+) km\/h/g, 'winds of up to $1 km/h'],
  [/ventos de (\d+)-(\d+) km\/h/g, 'winds of $1-$2 km/h'],
  [/ventos intensos/g, 'strong winds'],
  [/, e queda de granizo/g, ', and hail'],
  [/ e queda de granizo/g, ' and hail'],
  [/queda de granizo/g, 'hail'],
  [/Baixo risco de/g, 'Low risk of'],
  [/Médio risco de/g, 'Moderate risk of'],
  [/(?:Alto|Grande) risco de/g, 'High risk of'],
  [/Risco de/g, 'Risk of'],
  [/corte de energia elétrica/g, 'power outages'],
  [/corte de energia/g, 'power outages'],
  [/estragos em plantações/g, 'crop damage'],
  [/queda de galhos de árvores/g, 'falling tree branches'],
  [/queda de galhos/g, 'falling branches'],
  [/queda de árvores/g, 'falling trees'],
  [/alagamentos pontuais/g, 'localized flooding'],
  [/alagamentos/g, 'flooding'],
  [/pequenos deslizamentos/g, 'small landslides'],
  [/deslizamentos de encostas/g, 'hillside landslides'],
  [/deslizamentos/g, 'landslides'],
  [/transbordamentos de rios/g, 'river overflows'],
  [/enxurradas/g, 'flash floods'],
  [/inundações/g, 'floods'],
  [/descargas elétricas/g, 'lightning'],
  [/, em cidades com tais áreas de risco/g, ', in cities with such risk areas'],
]

const strip = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function translateTitle(title) {
  if (getLang() !== 'en' || typeof title !== 'string') return title
  return TITLES[strip(title)] || title
}

function translateSentence(sentence) {
  const known = SENTENCES[sentence.trim()]
  if (known) return known
  let out = sentence
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  if (out === sentence) return sentence
  // Nas frases de risco o "e" liga os itens da lista.
  return out.replace(/ e de /g, ' and ').replace(/ e (?=[a-z])/g, ' and ')
}

// Texto corrido (riscos, instruções). Aceita lista, como o INMET manda.
export function translateInmet(value) {
  if (getLang() !== 'en') return value
  if (Array.isArray(value)) return value.map(translateInmet).join(' ')
  if (typeof value !== 'string') return value
  return value.split(/(?<=[.!?])\s+/).map((sentence) => translateSentence(sentence.trim())).filter(Boolean).join(' ')
}
