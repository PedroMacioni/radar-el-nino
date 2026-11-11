import { t } from './i18n.js'

// Níveis usados nos avisos e nos indicadores. Cada nível tem cor e forma própria.
// Os textos são lidos na hora (getters), para acompanhar o idioma escolhido.
export const LEVELS = {
  sem: { get label() { return t('Sem aviso') } },
  amarelo: { get label() { return t('Amarelo') }, get meaning() { return t('perigo potencial') } },
  laranja: { get label() { return t('Laranja') }, get meaning() { return t('perigo') } },
  vermelho: { get label() { return t('Vermelho') }, get meaning() { return t('grande perigo') } },
}

// Índice UV (OMS).
export function uvLevel(uv) {
  if (uv == null) return null
  if (uv < 3) return { key: 'sem', label: t('Baixo') }
  if (uv < 6) return { key: 'amarelo', label: t('Moderado') }
  if (uv < 8) return { key: 'laranja', label: t('Alto') }
  if (uv < 11) return { key: 'vermelho', label: t('Muito alto') }
  return { key: 'vermelho', label: t('Extremo') }
}

// Índice Europeu de Qualidade do Ar (usado pelo Open-Meteo).
export function airLevel(eaqi) {
  if (eaqi == null) return null
  if (eaqi <= 20) return { key: 'sem', label: t('Boa') }
  if (eaqi <= 40) return { key: 'sem', label: t('Razoável') }
  if (eaqi <= 60) return { key: 'amarelo', label: t('Moderada') }
  if (eaqi <= 80) return { key: 'laranja', label: t('Ruim') }
  if (eaqi <= 100) return { key: 'vermelho', label: t('Muito ruim') }
  return { key: 'vermelho', label: t('Extremamente ruim') }
}

// Em linguagem comum: o que a pessoa deve fazer e para quem o aviso importa mais.
export function airAdvice(eaqi) {
  if (eaqi == null) return null
  if (eaqi <= 20) return { headline: t('Pode aproveitar o ar livre'), care: null }
  if (eaqi <= 40) return { headline: t('Sem restrições para a maioria'), care: null }
  const sensitive = t('Mais atenção: crianças, idosos e quem tem asma ou problema respiratório.')
  if (eaqi <= 60) return { headline: t('Sensíveis podem sentir incômodo'), care: sensitive }
  if (eaqi <= 80) return { headline: t('Evite esforço ao ar livre'), care: sensitive }
  if (eaqi <= 100) return { headline: t('Prefira ficar em ambiente fechado'), care: sensitive }
  return { headline: t('Evite sair de casa'), care: sensitive }
}

// Proteção contra o sol, pelo índice UV.
export function uvAdvice(uv) {
  if (uv == null) return null
  if (uv < 3) return t('Sem risco para a maioria das pessoas')
  if (uv < 6) return t('Use protetor solar')
  if (uv < 8) return t('Protetor, chapéu e sombra ajudam')
  return t('Evite o sol entre 10h e 16h')
}
