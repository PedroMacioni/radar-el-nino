import { lazy } from 'react'

// Depois de uma publicação nova, quem está com a página antiga aberta tenta baixar um arquivo que não
// existe mais (o servidor devolve a página inicial no lugar) e o carregamento falha. Nesse caso, limpa o
// cache do modo offline e recarrega uma vez para pegar a versão nova.
const FLAG = 'chunk-reload'

export function lazyWithReload(load) {
  return lazy(async () => {
    try {
      const mod = await load()
      try { sessionStorage.removeItem(FLAG) } catch { /* sem armazenamento: segue */ }
      return mod
    } catch (error) {
      let tried = false
      try { tried = sessionStorage.getItem(FLAG) === '1'; sessionStorage.setItem(FLAG, '1') } catch { /* ignora */ }
      if (!tried && typeof window !== 'undefined') {
        try {
          const regs = (await navigator.serviceWorker?.getRegistrations()) || []
          await Promise.all(regs.map((r) => r.unregister()))
          if (window.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
        } catch { /* ignora */ }
        window.location.reload()
        return new Promise(() => {}) // fica esperando a página recarregar
      }
      throw error
    }
  })
}
