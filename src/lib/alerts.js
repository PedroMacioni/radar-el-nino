import { coordsQuery } from './geo.js'

// Chama a rota /api/alertas (função serverless ou servidor de desenvolvimento).
export async function fetchAlerts(lat, lon, fetchImpl = fetch) {
  const response = await fetchImpl(`/api/alertas?${coordsQuery(lat, lon)}`)
  if (!response.ok) throw new Error(`Avisos respondeu ${response.status}`)
  const data = await response.json()
  return data.warnings || []
}

// Um aviso salvo só vale até o fim do prazo dele. Sem prazo, mantém.
export function stillValid(warning, now = new Date()) {
  if (!warning.end || !warning.end.date) return true
  const end = new Date(`${warning.end.date}T${warning.end.time || '23:59'}`)
  return Number.isNaN(end.getTime()) || end.getTime() >= now.getTime()
}

// Identifica um aviso para saber, numa atualização, se surgiu algum novo.
export const warningKey = (warning) => `${warning.severity}|${warning.title || ''}`

// Devolve os avisos que não estavam na consulta anterior (previousKeys é um Set).
export function findNewWarnings(previousKeys, warnings) {
  if (!previousKeys) return []
  return warnings.filter((warning) => !previousKeys.has(warningKey(warning)))
}
