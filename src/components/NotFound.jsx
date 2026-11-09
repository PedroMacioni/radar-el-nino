import { useEffect } from 'react'
import { LuCompass, LuHouse, LuLifeBuoy, LuPhoneCall } from 'react-icons/lu'
import { APP_NAME } from '../lib/brand.js'

// Tela para endereços que não existem. O menu e os botões levam de volta ao app.
export default function NotFound() {
  useEffect(() => {
    const previous = document.title
    document.title = `Página não encontrada · ${APP_NAME}`
    // Esta tela não deve aparecer em buscas.
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.appendChild(robots)
    return () => {
      document.title = previous
      robots.remove()
    }
  }, [])

  return (
    <main className="notfound" id="inicio">
      <div className="notfound__inner">
        <div className="notfound__hero" role="img" aria-label="Erro 404">
          <span aria-hidden="true">4</span>
          <span className="notfound__o" aria-hidden="true"><LuCompass size={64} strokeWidth={1.5} /></span>
          <span aria-hidden="true">4</span>
        </div>
        <h1>Página não encontrada</h1>
        <p className="notfound__text">Esse endereço não existe ou mudou de lugar. Volte para a previsão e os avisos da sua cidade.</p>
        <div className="notfound__actions">
          <a className="notfound__btn notfound__btn--main" href="/"><LuHouse size={20} aria-hidden="true" /> Voltar ao início</a>
          <a className="notfound__btn" href="/#ajuda"><LuLifeBuoy size={20} aria-hidden="true" /> Como pedir ajuda</a>
        </div>
        <a className="notfound__emergency" href="tel:199"><LuPhoneCall size={18} aria-hidden="true" /> Em risco imediato, ligue 199</a>
      </div>
    </main>
  )
}
