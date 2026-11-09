// Função serverless (Vercel). Rota: /api/reservatorios?estado=São Paulo
import { handleReservoirs } from '../server/reservatorios.js'

export default async function handler(req, res) {
  const { status, body, headers } = await handleReservoirs(req.query || {})
  for (const [key, value] of Object.entries(headers || {})) res.setHeader(key, value)
  res.status(status).json(body)
}
