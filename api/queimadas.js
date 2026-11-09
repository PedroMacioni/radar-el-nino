// Função serverless (Vercel). Rota: /api/queimadas?lat=-22.9&lon=-47.06
import { handleFires } from '../server/queimadas.js'

export default async function handler(req, res) {
  const { status, body, headers } = await handleFires(req.query || {})
  for (const [key, value] of Object.entries(headers || {})) res.setHeader(key, value)
  res.status(status).json(body)
}
