import { isDemoRoute } from './demo.js'

const here = () => (typeof window !== 'undefined' ? window.location.pathname : '/')

// Tela de doação.
export function isDonateRoute(pathname = here()) {
  return /^\/apoie\/?$/.test(pathname)
}

// Endereços que o app conhece: a página inicial, a doação e as de teste. Qualquer outro mostra a tela 404.
export function isKnownRoute(pathname = here()) {
  return pathname === '/' || pathname === '/index.html' || isDonateRoute(pathname) || isDemoRoute(pathname)
}
