import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { handleAlerts } from './server/alerts.js'
import { handleFires } from './server/queimadas.js'
import { handleMap } from './server/mapa.js'
import { handleReservoirs } from './server/reservatorios.js'
import { APP_NAME, APP_SHORT_NAME } from './src/lib/brand.js'

// Reproduz as rotas /api/* no servidor de desenvolvimento e no de pré-visualização.
function devApi() {
  const routes = { '/api/alertas': handleAlerts, '/api/queimadas': handleFires, '/api/reservatorios': handleReservoirs, '/api/mapa': handleMap }
  const install = (server) => {
    for (const [path, handler] of Object.entries(routes)) {
      server.middlewares.use(path, async (req, res) => {
        const url = new URL(req.url || '', 'http://localhost')
        const query = Object.fromEntries(url.searchParams)
        const { status, body, headers } = await handler(query)
        res.statusCode = status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        for (const [key, value] of Object.entries(headers || {})) res.setHeader(key, value)
        res.end(JSON.stringify(body))
      })
    }
  }
  return { name: 'dev-api', configureServer: install, configurePreviewServer: install }
}

// Modo offline: a página e os arquivos abrem sem internet. Os dados (previsão,
// avisos) NÃO ficam no service worker: o app guarda a última cópia com data.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['apple-touch-icon.png'],
  manifest: {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: 'Previsão do tempo, avisos oficiais e como pedir ajuda na sua cidade durante o El Niño.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B2E4A',
    theme_color: '#0B2E4A',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'fontes-css' },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'fontes-arquivos', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
      },
    ],
  },
})

export default defineConfig({
  plugins: [react(), devApi(), pwa],
})
