import { useEffect, useState } from 'react'
import { LuHeart, LuHouse, LuLifeBuoy, LuMap } from 'react-icons/lu'
import { APP_NAME } from '../lib/brand.js'

// A ordem aqui é a mesma da página: a marcação por rolagem depende disso.
const ITEMS = [
  { id: 'inicio', label: 'Início', Icon: LuHouse },
  { id: 'mapa', label: 'Mapa', Icon: LuMap },
  { id: 'ajuda', label: 'Pedir ajuda', Icon: LuLifeBuoy },
  // Página própria: não entra na marcação por rolagem e some no modo de emergência.
  { id: 'apoie', label: 'Apoie', Icon: LuHeart, page: '/apoie' },
]

// Descobre em qual seção a pessoa está, para marcar a aba certa.
function useActiveSection() {
  const [active, setActive] = useState('inicio')
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
      let current = 'inicio'
      for (const { id } of ITEMS.slice(1)) {
        const el = document.getElementById(id)
        // Seções escondidas (dentro de "Mais informações" fechado) não têm posição: ficam de fora.
        if (el && el.getClientRects().length > 0 && el.getBoundingClientRect().top <= 140) current = id
      }
      if (atBottom && document.getElementById('ajuda')) current = 'ajuda'
      setActive(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return [active, setActive]
}

// standalone: em páginas fora da inicial (404, apoio) os links levam à página inicial (/);
// nesse caso, `current` diz qual item fica marcado.
export default function Header({ standalone = false, current = null }) {
  const [scrolled, setActive] = useActiveSection()
  const base = standalone ? '/' : ''
  const active = standalone ? current : scrolled
  return (
    <header className="topbar">
      <div className="container topbar__inner">
        <a className="brand" href={`${base}#inicio`} onClick={() => setActive('inicio')}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <path d="M3 11c3-3 6-3 9 0s6 3 9 0 4-2.5 6-1.5" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M3 19c3-3 6-3 9 0s6 3 9 0 4-2.5 6-1.5" stroke="#8FB8DC" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <span>{APP_NAME}</span>
        </a>
        <nav aria-label="Principal" className="topbar__nav">
          {ITEMS.map(({ id, label, Icon, page }) => (
            <a key={id} href={page || `${base}#${id}`} aria-current={active === id ? 'page' : undefined} onClick={() => setActive(id)}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}
