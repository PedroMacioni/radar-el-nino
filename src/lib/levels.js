// Níveis usados nos avisos e nos indicadores. Cada nível tem cor e forma própria.
export const LEVELS = {
  sem: { label: 'Sem aviso' },
  amarelo: { label: 'Amarelo', meaning: 'perigo potencial' },
  laranja: { label: 'Laranja', meaning: 'perigo' },
  vermelho: { label: 'Vermelho', meaning: 'grande perigo' },
}

// Índice UV (OMS).
export function uvLevel(uv) {
  if (uv == null) return null
  if (uv < 3) return { key: 'sem', label: 'Baixo' }
  if (uv < 6) return { key: 'amarelo', label: 'Moderado' }
  if (uv < 8) return { key: 'laranja', label: 'Alto' }
  if (uv < 11) return { key: 'vermelho', label: 'Muito alto' }
  return { key: 'vermelho', label: 'Extremo' }
}

// Índice Europeu de Qualidade do Ar (usado pelo Open-Meteo).
export function airLevel(eaqi) {
  if (eaqi == null) return null
  if (eaqi <= 20) return { key: 'sem', label: 'Boa' }
  if (eaqi <= 40) return { key: 'sem', label: 'Razoável' }
  if (eaqi <= 60) return { key: 'amarelo', label: 'Moderada' }
  if (eaqi <= 80) return { key: 'laranja', label: 'Ruim' }
  if (eaqi <= 100) return { key: 'vermelho', label: 'Muito ruim' }
  return { key: 'vermelho', label: 'Extremamente ruim' }
}

// Em linguagem comum: o que a pessoa deve fazer e para quem o aviso importa mais.
export function airAdvice(eaqi) {
  if (eaqi == null) return null
  if (eaqi <= 20) return { headline: 'Pode aproveitar o ar livre', care: null }
  if (eaqi <= 40) return { headline: 'Sem restrições para a maioria', care: null }
  const sensitive = 'Mais atenção: crianças, idosos e quem tem asma ou problema respiratório.'
  if (eaqi <= 60) return { headline: 'Sensíveis podem sentir incômodo', care: sensitive }
  if (eaqi <= 80) return { headline: 'Evite esforço ao ar livre', care: sensitive }
  if (eaqi <= 100) return { headline: 'Prefira ficar em ambiente fechado', care: sensitive }
  return { headline: 'Evite sair de casa', care: sensitive }
}

// Proteção contra o sol, pelo índice UV.
export function uvAdvice(uv) {
  if (uv == null) return null
  if (uv < 3) return 'Sem risco para a maioria das pessoas'
  if (uv < 6) return 'Use protetor solar'
  if (uv < 8) return 'Protetor, chapéu e sombra ajudam'
  return 'Evite o sol entre 10h e 16h'
}
