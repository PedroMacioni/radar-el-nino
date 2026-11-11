import { t } from './i18n.js'

// Cor da temperatura: azul (frio) → verde-água → âmbar → vermelho (calor).
const TEMP_STOPS = [
  [8, [37, 99, 235]],
  [16, [8, 145, 178]],
  [22, [22, 163, 74]],
  [27, [217, 119, 6]],
  [33, [220, 38, 38]],
]

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

export function tempColor(t) {
  if (t == null) return '#4f5b66'
  if (t <= TEMP_STOPS[0][0]) return `rgb(${TEMP_STOPS[0][1].join(',')})`
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i]
    const [t0, c0] = TEMP_STOPS[i - 1]
    if (t <= t1) return `rgb(${mix(c0, c1, (t - t0) / (t1 - t0)).join(',')})`
  }
  return `rgb(${TEMP_STOPS[TEMP_STOPS.length - 1][1].join(',')})`
}

// Chance de chuva: cada faixa tem cor e texto próprios (a cor nunca é a única pista).
export function rainLevel(p) {
  if (p == null) return { key: 'none', label: t('Sem dado'), color: '#c4cbd2', ink: '#4f5b66' }
  if (p < 20) return { key: 'low', label: t('Chuva improvável'), color: '#b6d4ee', ink: '#0f1b26' }
  if (p < 50) return { key: 'some', label: t('Chuva possível'), color: '#6aa9dd', ink: '#0f1b26' }
  if (p < 70) return { key: 'likely', label: t('Chuva provável'), color: '#2f7fc4', ink: '#ffffff' }
  return { key: 'high', label: t('Chuva muito provável'), color: '#14509c', ink: '#ffffff' }
}

// Calcula a geometria do gráfico (temperatura em linha, chance de chuva em barras).
// É uma função pura para poder ser testada sem o navegador.
export function buildChart(hours, { narrow = false, nowHour = null } = {}) {
  const width = narrow ? 350 : 720
  const height = narrow ? 220 : 250
  const x0 = narrow ? 34 : 52
  const step = narrow ? 12.5 : 26
  const top = 30
  const bottom = height - 48
  const plotHeight = bottom - top
  const fontSize = narrow ? 12 : 13

  const temps = hours.map((h) => h.temp).filter((v) => v != null)
  const hasTemps = temps.length > 0
  const min = hasTemps ? Math.floor(Math.min(...temps)) - 1 : 0
  const max = hasTemps ? Math.ceil(Math.max(...temps)) + 1 : 1

  const centerX = (hour) => x0 + step * (hour + 0.5)
  const tempY = (t) => bottom - ((t - min) / (max - min)) * plotHeight

  let linePath = ''
  let pen = 'M'
  const dots = []
  const points = []
  for (const h of hours) {
    if (h.temp == null) {
      pen = 'M'
      continue
    }
    const x = Math.round(centerX(h.hour) * 10) / 10
    const y = Math.round(tempY(h.temp) * 10) / 10
    linePath += `${pen}${x} ${y} `
    pen = 'L'
    points.push({ x, y, hour: h.hour })
    if (h.hour % 3 === 0) dots.push({ x, y, hour: h.hour })
  }

  const bars = hours
    .filter((h) => h.rainChance != null)
    .map((h) => {
      const barHeight = Math.max(0, Math.min(100, h.rainChance)) / 100 * plotHeight
      return { x: x0 + step * h.hour + step * 0.2, y: bottom - barHeight, width: step * 0.6, height: barHeight, hour: h.hour, color: rainLevel(h.rainChance).color }
    })

  // Degradê vertical da linha: a cor acompanha a temperatura de cada altura.
  const gradient = hasTemps
    ? [1, 0.75, 0.5, 0.25, 0].map((f) => ({ offset: 1 - f, color: tempColor(min + (max - min) * f) }))
    : []

  const gridLines = [0, 1, 2, 3].map((i) => top + (i * plotHeight) / 3)
  const xLabels = [0, 3, 6, 9, 12, 15, 18, 21].map((hour) => ({ x: centerX(hour), text: String(hour).padStart(2, '0') }))

  return {
    width, height, x0, xRight: x0 + step * 24, top, bottom, fontSize,
    tempMin: hasTemps ? min : null,
    tempMax: hasTemps ? max : null,
    linePath: linePath.trim(),
    dots, bars, gridLines, xLabels, points, gradient, step,
    centerX,
    nowX: nowHour == null ? null : centerX(nowHour),
  }
}
