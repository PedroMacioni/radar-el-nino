export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// "2026-11-09" -> data local, sem mudar de dia por causa do fuso.
export function parseDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function dayTitle(isoDate) {
  return capitalize(parseDate(isoDate).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
}

export function weekdayShort(isoDate) {
  return capitalize(parseDate(isoDate).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''))
}

export function dayNumber(isoDate) {
  return String(parseDate(isoDate).getDate())
}

export function formatTemp(value) {
  return value == null ? '–' : `${Math.round(value)}°`
}

export function formatPercent(value) {
  return value == null ? '–' : `${Math.round(value)}%`
}

export function formatDateTime(part) {
  if (!part) return ''
  const [, month, day] = part.date.split('-')
  return `${day}/${month}${part.time ? ` ${part.time}` : ''}`
}

export function formatSavedAt(isoString) {
  const date = new Date(isoString)
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Milímetros de chuva com vírgula: 14,5 mm.
export function formatMm(value) {
  return value == null ? '–' : `${(Math.round(value * 10) / 10).toLocaleString('pt-BR')} mm`
}

// "2026-11-10" -> "10/11"
export function dayMonth(isoDate) {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}
