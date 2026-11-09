import { useEffect, useState } from 'react'

// True quando a tela é estreita (celular). Usado para escolher o tamanho do gráfico.
export function useNarrow(maxWidth = 720) {
  const query = `(max-width: ${maxWidth}px)`
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return narrow
}
