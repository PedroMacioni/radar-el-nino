import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPixPayload, cleanText, crc16, normalizeAmount } from '../src/lib/pix.js'

// Lê os campos "id + tamanho + valor" para conferir se o código está bem formado.
function parse(payload) {
  const fields = {}
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    const length = Number(payload.slice(i + 2, i + 4))
    assert.ok(Number.isInteger(length), `tamanho inválido no campo ${id}`)
    fields[id] = payload.slice(i + 4, i + 4 + length)
    i += 4 + length
  }
  assert.equal(i, payload.length, 'sobrou ou faltou texto no código')
  return fields
}

// Chave e nome fictícios, só para teste.
const SAMPLE = { key: 'teste@exemplo.com', name: 'Projeto Radar', city: 'São Paulo' }

test('CRC16 bate com o valor de referência do padrão CCITT-FALSE', () => {
  assert.equal(crc16('123456789'), '29B1')
})

test('código Pix: campos fixos, recebedor e CRC válido', () => {
  const payload = buildPixPayload(SAMPLE)
  const f = parse(payload)
  assert.equal(f['00'], '01')
  assert.equal(f['01'], '11')
  assert.equal(f['52'], '0000')
  assert.equal(f['53'], '986')
  assert.equal(f['58'], 'BR')
  assert.equal(f['59'], 'PROJETO RADAR')
  assert.equal(f['60'], 'SAO PAULO')
  assert.equal(f['62'], '0503***')
  assert.equal(f['54'], undefined)
  assert.ok(f['26'].startsWith('0014BR.GOV.BCB.PIX01'))
  assert.ok(f['26'].endsWith('teste@exemplo.com'))
  // O CRC cobre tudo até "6304".
  assert.equal(payload.slice(-8, -4), '6304')
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)))
})

test('código Pix com valor', () => {
  const f = parse(buildPixPayload({ ...SAMPLE, amount: 10.5 }))
  assert.equal(f['54'], '10.50')
  assert.equal(parse(buildPixPayload({ ...SAMPLE, amount: '25' }))['54'], '25.00')
  assert.equal(parse(buildPixPayload({ ...SAMPLE, amount: '7,5' }))['54'], '7.50')
})

test('valores inválidos viram código sem valor', () => {
  for (const amount of [0, 0.5, -3, 20000, 'abc', NaN, null, undefined]) {
    assert.equal(parse(buildPixPayload({ ...SAMPLE, amount }))['54'], undefined, String(amount))
  }
  assert.equal(normalizeAmount('1'), 1)
  assert.equal(normalizeAmount(10000), 10000)
})

test('nome e cidade respeitam limites e acentos', () => {
  assert.equal(cleanText('Associação Nordestina de Apoio à Defesa', 25), 'ASSOCIACAO NORDESTINA DE')
  assert.equal(cleanText('São José dos Campos', 15), 'SAO JOSE DOS CA')
  const f = parse(buildPixPayload({ key: 'a@b.co', name: '', city: '' }))
  assert.equal(f['59'], 'RECEBEDOR')
  assert.equal(f['60'], 'BRASIL')
})

test('sem chave não gera código', () => {
  assert.throws(() => buildPixPayload({ key: '  ', name: 'X', city: 'Y' }))
})
