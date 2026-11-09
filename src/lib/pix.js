// Código Pix "copia e cola" (BR Code estático), o mesmo que vai dentro do QR Code.
// Formato: campos "id + tamanho (2 dígitos) + valor", terminando com o CRC16.

// CRC16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), exigido pelo Pix.
export function crc16(text) {
  let crc = 0xffff
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`

// Nome e cidade do recebedor: sem acento, em maiúsculas e dentro do limite do Pix.
export function cleanText(text, max) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim()
}

// Valor opcional entre R$ 1 e R$ 10.000. Fora disso, o código vai sem valor.
export function normalizeAmount(amount) {
  const value = typeof amount === 'string' ? Number(amount.replace(',', '.')) : amount
  if (!Number.isFinite(value) || value < 1 || value > 10000) return null
  return Math.round(value * 100) / 100
}

export function buildPixPayload({ key, name, city, amount = null, txid = '***' }) {
  const pixKey = String(key || '').trim()
  if (!pixKey) throw new Error('A chave Pix é obrigatória')
  const value = normalizeAmount(amount)
  const account = field('00', 'BR.GOV.BCB.PIX') + field('01', pixKey)
  const body =
    field('00', '01') +
    field('01', '11') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (value == null ? '' : field('54', value.toFixed(2))) +
    field('58', 'BR') +
    field('59', cleanText(name, 25) || 'RECEBEDOR') +
    field('60', cleanText(city, 15) || 'BRASIL') +
    field('62', field('05', String(txid).slice(0, 25) || '***'))
  const withCrcId = `${body}6304`
  return withCrcId + crc16(withCrcId)
}
