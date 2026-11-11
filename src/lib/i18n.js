import { useSyncExternalStore } from 'react'
import { EN } from './en.js'

// Dois idiomas: português (o texto original, que serve de chave) e inglês (dicionário em en.js).
// A função t recebe o texto em português e devolve o do idioma atual; sem tradução, devolve o próprio português.
export const LANGS = ['pt', 'en']
const KEY = 'elnino:lang'
const LOCALES = { pt: 'pt-BR', en: 'en-US' }

function stored() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

// Ordem: ?lang=en na endereço, escolha salva, idioma do navegador. Fora do navegador (testes), português.
function detect() {
  if (typeof window === 'undefined') return 'pt'
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang')
    if (LANGS.includes(fromUrl)) {
      try { localStorage.setItem(KEY, fromUrl) } catch { /* sem armazenamento: vale só nesta visita */ }
      return fromUrl
    }
  } catch { /* endereço ilegível: segue */ }
  const saved = stored()
  if (LANGS.includes(saved)) return saved
  const browser = String((typeof navigator !== 'undefined' && navigator.language) || 'pt').toLowerCase()
  return browser.startsWith('pt') ? 'pt' : 'en'
}

let current = detect()
const listeners = new Set()

export const getLang = () => current
export const locale = () => LOCALES[current]

export function setLang(next) {
  if (!LANGS.includes(next) || next === current) return
  current = next
  try { localStorage.setItem(KEY, next) } catch { /* sem armazenamento: vale só nesta visita */ }
  syncDocument()
  listeners.forEach((listener) => listener())
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Faz o componente redesenhar quando o idioma muda.
export function useLang() {
  return useSyncExternalStore(subscribe, getLang, () => 'pt')
}

// Trechos como {name} são trocados pelos valores do segundo argumento. Sem tradução em inglês, cai no português.
export function t(text, vars) {
  let out = current === 'en' && EN[text] != null ? EN[text] : text
  if (vars) out = out.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name])))
  return out
}

// Atualiza o <html lang>, o título e a descrição da página.
export function syncDocument() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = current === 'en' ? 'en' : 'pt-BR'
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', t('Previsão do tempo, avisos oficiais e como pedir ajuda na sua cidade durante o El Niño.'))
}

syncDocument()
