// Função serverless (Vercel). Rota: /api/alertas?lat=-22.9&lon=-47.06
import { handleAlerts } from '../server/alerts.js'

export default async function handler(req, res) {
  const { status, body, headers } = await handleAlerts(req.query || {})
  for (const [key, value] of Object.entries(headers || {})) res.setHeader(key, value)
  res.status(status).json(body)
}
