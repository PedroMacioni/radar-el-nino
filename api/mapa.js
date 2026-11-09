// Função serverless (Vercel). Rota: /api/mapa?lat=-22.9&lon=-47.06
import { handleMap } from '../server/mapa.js'

export default async function handler(req, res) {
  const { status, body, headers } = await handleMap(req.query || {})
  for (const [key, value] of Object.entries(headers || {})) res.setHeader(key, value)
  res.status(status).json(body)
}
