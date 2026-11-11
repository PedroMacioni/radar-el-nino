import { getLang, locale } from './i18n.js'

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// "2026-11-09" -> data local, sem mudar de dia por causa do fuso.
export function parseDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function dayTitle(isoDate) {
  return capitalize(parseDate(isoDate).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }))
}

export function weekdayShort(isoDate) {
  return capitalize(parseDate(isoDate).toLocaleDateString(locale(), { weekday: 'short' }).replace('.', ''))
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

// "14h" em português, "14:00" em inglês.
export function formatHour(hour) {
  const hh = String(hour).padStart(2, '0')
  return getLang() === 'en' ? `${hh}:00` : `${hh}h`
}

// "10/11" em português, "Nov 10" em inglês (a ordem dia/mês muda de país para país).
function shortDate(month, day) {
  if (getLang() === 'en') return parseDate(`2000-${month}-${day}`).toLocaleDateString(locale(), { month: 'short', day: 'numeric' })
  return `${day}/${month}`
}

export function formatDateTime(part) {
  if (!part) return ''
  const [, month, day] = part.date.split('-')
  return `${shortDate(month, day)}${part.time ? ` ${part.time}` : ''}`
}

export function formatSavedAt(isoString) {
  const date = new Date(isoString)
  return date.toLocaleString(locale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Número no formato do idioma: 14,5 em português, 14.5 em inglês.
export function formatNumber(value) {
  return value.toLocaleString(locale())
}

// Milímetros de chuva: 14,5 mm.
export function formatMm(value) {
  return value == null ? '–' : `${formatNumber(Math.round(value * 10) / 10)} mm`
}

// "2026-11-10" -> "10/11"
export function dayMonth(isoDate) {
  const [, month, day] = isoDate.split('-')
  return shortDate(month, day)
}
