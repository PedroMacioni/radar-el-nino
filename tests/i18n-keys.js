// Ferramenta dos testes de tradução: acha, no código, os textos em português passados a t('...').
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

// Lê um literal entre aspas simples a partir de `start` (que aponta para a aspa). Devolve [texto, próximo índice].
function readLiteral(source, start) {
  let out = ''
  let i = start + 1
  while (i < source.length && source[i] !== "'") {
    if (source[i] === '\\') {
      out += source[i + 1]
      i += 2
    } else {
      out += source[i]
      i += 1
    }
  }
  return [out, i + 1]
}

// Em cada chamada t(...), pega os literais do primeiro argumento (inclusive os dois lados de um ternário).
export function extractKeys(source) {
  const keys = []
  const call = /(?<![\w.$])t\(/g
  let match
  while ((match = call.exec(source))) {
    let i = match.index + match[0].length
    let depth = 1
    while (i < source.length && depth > 0) {
      const ch = source[i]
      if (ch === "'") {
        const [text, next] = readLiteral(source, i)
        if (depth === 1) keys.push(text)
        i = next
        continue
      }
      if (ch === '(' || ch === '{' || ch === '[') depth += 1
      else if (ch === ')' || ch === '}' || ch === ']') depth -= 1
      else if (ch === ',' && depth === 1) break
      i += 1
    }
  }
  return keys
}

export function collectKeys(root) {
  const keys = new Set()
  for (const file of walk(root).filter((f) => /\.(jsx?|mjs)$/.test(f))) {
    if (file.endsWith('en.js')) continue
    for (const key of extractKeys(readFileSync(file, 'utf8'))) keys.add(key)
  }
  return keys
}
