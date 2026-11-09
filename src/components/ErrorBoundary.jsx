import { Component } from 'react'

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
  return (
    <main className="crash">
      <h1>Algo deu errado</h1>
      <p>Recarregue a página. Em risco imediato, não espere: ligue 199.</p>
      <div className="crash__actions">
        <button type="button" onClick={() => window.location.reload()}>Recarregar</button>
        <a href="tel:199">Ligar 199</a>
      </div>
    </main>
  )
}
