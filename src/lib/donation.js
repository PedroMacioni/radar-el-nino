// Dados da doação por Pix. Ficam em variáveis de ambiente (arquivo .env.local ou no
// painel do serviço de hospedagem), para a chave não ir para o código.
// Sem os três primeiros, a tela /apoie mostra "Doações em breve".
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

export const DONATION = {
  pixKey: String(env.VITE_PIX_KEY || '').trim(),
  receiverName: String(env.VITE_PIX_NAME || '').trim(),
  receiverCity: String(env.VITE_PIX_CITY || '').trim(),
  purpose: String(env.VITE_DONATION_PURPOSE || '').trim() || 'Sua doação mantém tudo no ar e ajuda a melhorar a previsão, os avisos e os guias.',
}

export const isDonationConfigured = () => Boolean(DONATION.pixKey && DONATION.receiverName && DONATION.receiverCity)
