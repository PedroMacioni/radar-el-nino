// Resumo de um dia para os cartões da previsão: máxima, mínima, chance e volume de chuva e o tempo.

// Do menos para o mais grave. O ícone do dia é o mais grave que aparece de verdade durante o dia.
const ORDER = ['limpo', 'parcial', 'nublado', 'neblina', 'garoa', 'chuva', 'chuva-forte', 'trovoada']

export const WEATHER = {
  limpo: { label: 'Céu limpo' },
  parcial: { label: 'Parcialmente nublado' },
  nublado: { label: 'Nublado' },
  neblina: { label: 'Neblina' },
  garoa: { label: 'Garoa' },
  chuva: { label: 'Chuva' },
  'chuva-forte': { label: 'Chuva forte' },
  trovoada: { label: 'Trovoada' },
}

// Código de tempo da Open-Meteo (padrão WMO) para o nosso grupo.
export function weatherGroup(code) {
  if (code == null) return null
  if (code >= 95 && code <= 99) return 'trovoada'
  if ([65, 66, 67, 82].includes(code)) return 'chuva-forte'
  if ([61, 63, 80, 81].includes(code)) return 'chuva'
  if ([51, 53, 55, 56, 57].includes(code)) return 'garoa'
  if ([45, 48].includes(code)) return 'neblina'
  if (code === 3) return 'nublado'
  if (code === 1 || code === 2) return 'parcial'
  if (code === 0) return 'limpo'
  return null
}

// Sem o código (dados antigos salvos no aparelho), o tempo é deduzido da chuva.
function fromRain(rainMax, rainTotal) {
  if (rainTotal >= 20) return 'chuva-forte'
  if (rainTotal >= 2 || (rainMax != null && rainMax >= 60)) return 'chuva'
  if (rainMax != null && rainMax >= 30) return 'nublado'
  return 'limpo'
}

export function summarizeDay(hours) {
  const temps = hours.map((h) => h.temp).filter((v) => v != null)
  const chances = hours.map((h) => h.rainChance).filter((v) => v != null)
  const max = temps.length ? Math.max(...temps) : null
  const min = temps.length ? Math.min(...temps) : null
  const rainMax = chances.length ? Math.max(...chances) : null
  const rainTotal = Math.round(hours.reduce((sum, h) => sum + (h.precip || 0), 0) * 10) / 10

  // Das 6h às 21h. Um grupo só vale se durar 2 horas (trovoada vale com 1), para uma hora de
  // garoa não virar "dia de chuva".
  const counts = {}
  for (const h of hours) {
    if (h.hour < 6 || h.hour > 21) continue
    const group = weatherGroup(h.code)
    if (group) counts[group] = (counts[group] || 0) + 1
  }
  let key = null
  for (const group of [...ORDER].reverse()) {
    if ((counts[group] || 0) >= (group === 'trovoada' ? 1 : 2)) {
      key = group
      break
    }
  }
  if (!key && Object.keys(counts).length > 0) key = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  if (!key) key = fromRain(rainMax, rainTotal)

  return { max, min, rainMax, rainTotal, weather: key, weatherLabel: WEATHER[key].label }
}
