import { Component } from 'react'
import { t, useLang } from '../lib/i18n.js'

// Se uma parte da tela falhar, mostra o aviso no lugar dela em vez de apagar a página inteira.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error(error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// Tela de último recurso, se o app inteiro falhar. Mantém o caminho para o socorro.
export function CrashScreen() {
  useLang()
  return (
    <main className="crash">
      <h1>{t('Algo deu errado')}</h1>
      <p>{t('Recarregue a página. Em risco imediato, não espere: ligue 199.')}</p>
      <div className="crash__actions">
        <button type="button" onClick={() => window.location.reload()}>{t('Recarregar')}</button>
        <a href="tel:199">{t('Ligar 199')}</a>
      </div>
    </main>
  )
}
