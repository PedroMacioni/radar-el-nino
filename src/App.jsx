import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { lazyWithReload } from './lib/lazy.js'
import { LuBellRing, LuChevronDown, LuRefreshCw } from 'react-icons/lu'
import Header from './components/Header.jsx'
import SearchBar from './components/SearchBar.jsx'
import AlertBand, { EmergencyDock, isEmergency } from './components/AlertBand.jsx'
import NowStrip from './components/NowStrip.jsx'
import Forecast from './components/Forecast.jsx'
import Indicators from './components/Indicators.jsx'
import SideInfo from './components/SideInfo.jsx'
import Help from './components/Help.jsx'
import MapSection from './components/MapSection.jsx'
import NotFound from './components/NotFound.jsx'
import Footer from './components/Footer.jsx'
import { fetchAlerts, findNewWarnings, stillValid, warningKey } from './lib/alerts.js'
import { fetchDrought, fetchFires, fetchReservoirs, fetchRiver } from './lib/environment.js'
import { DEMO_AIR, DEMO_FIRES, DEMO_PLACE, DEMO_RESERVOIRS, buildDemoDrought, buildDemoForecast, buildDemoRiver, buildDemoWarnings, isDemoRoute, isExtremeDemo } from './lib/demo.js'
import { placeLabel } from './lib/geo.js'
import { isDonateRoute, isKnownRoute } from './lib/routes.js'
import { formatSavedAt } from './lib/format.js'
import { loadCachedAlerts, loadCachedData, loadPlace, saveCachedAlerts, saveCachedData, savePlace } from './lib/storage.js'
import { fetchAir, fetchForecast, summarize } from './lib/weather.js'

// A tela de doação (com o gerador de QR Code) só é baixada por quem abrir /apoie.
const Donate = lazyWithReload(() => import('./components/Donate.jsx'))

function Home() {
  const demo = isDemoRoute()
  const [place, setPlace] = useState(() => (demo ? DEMO_PLACE : loadPlace()))
  const [weather, setWeather] = useState({ status: 'idle' })
  const [alerts, setAlerts] = useState({ status: 'loading' })
  const [river, setRiver] = useState({ status: 'loading' })
  const [fires, setFires] = useState({ status: 'loading' })
  const [reservoirs, setReservoirs] = useState({ status: 'loading' })
  const [drought, setDrought] = useState({ status: 'loading' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [freshAlert, setFreshAlert] = useState(null)
  const lastRefresh = useRef(0)
  const lastFetch = useRef(Date.now())
  const seenAlerts = useRef(null)
  // A chuva dos últimos 10 anos só muda uma vez por dia: não precisa ser baixada a cada atualização.
  const droughtCache = useRef(null)

  function selectPlace(next) {
    savePlace(next)
    // Na rota /teste, escolher um local real sai do modo de teste.
    if (demo) window.location.assign('/')
    else setPlace(next)
  }

  useEffect(() => {
    if (!place) return undefined
    if (demo) {
      setWeather({ status: 'ok', forecast: buildDemoForecast(new Date()), air: DEMO_AIR })
      setAlerts({ status: 'ok', warnings: buildDemoWarnings(new Date()) })
      setRiver({ status: 'ok', data: buildDemoRiver(new Date()) })
      setFires({ status: 'ok', data: DEMO_FIRES })
      setReservoirs({ status: 'ok', data: DEMO_RESERVOIRS })
      setDrought({ status: 'ok', data: buildDemoDrought(new Date()) })
      return undefined
    }
    let cancelled = false
    lastFetch.current = Date.now()
    // Ao atualizar, mantém os dados na tela e só gira o ícone; ao trocar de local, mostra "Carregando".
    const isRefresh = refreshKey !== lastRefresh.current
    lastRefresh.current = refreshKey
    if (isRefresh) setRefreshing(true)
    else {
      seenAlerts.current = null
      setFreshAlert(null)
      setWeather({ status: 'loading' })
      setAlerts({ status: 'loading' })
      setRiver({ status: 'loading' })
      setFires({ status: 'loading' })
      setReservoirs({ status: 'loading' })
      setDrought({ status: 'loading' })
    }

    Promise.allSettled([fetchForecast(place.lat, place.lon), fetchAir(place.lat, place.lon)]).then(([forecast, air]) => {
      if (cancelled) return
      setRefreshing(false)
      if (forecast.status === 'fulfilled') {
        const airData = air.status === 'fulfilled' ? air.value : null
        saveCachedData(place, forecast.value, airData)
        setWeather({ status: 'ok', forecast: forecast.value, air: airData })
        return
      }
      const cached = loadCachedData(place)
      if (cached) setWeather({ status: 'cached', forecast: cached.forecast, air: cached.air, savedAt: cached.savedAt })
      else setWeather({ status: 'error' })
    })

    fetchRiver(place.lat, place.lon)
      .then((data) => !cancelled && setRiver({ status: 'ok', data }))
      .catch(() => !cancelled && setRiver((previous) => (previous.status === 'ok' ? previous : { status: 'error' })))
    // Reservatórios dependem do estado; sem estado (localização sem endereço) não há o que consultar.
    if (place.state) {
      fetchReservoirs(place.state)
        .then((data) => !cancelled && setReservoirs({ status: 'ok', data }))
        .catch(() => !cancelled && setReservoirs((previous) => (previous.status === 'ok' ? previous : { status: 'error' })))
    } else {
      setReservoirs({ status: 'error' })
    }
    const today = new Date().toLocaleDateString('sv-SE')
    const droughtKey = `${place.lat},${place.lon},${today}`
    if (droughtCache.current?.key === droughtKey) {
      setDrought({ status: 'ok', data: droughtCache.current.data })
    } else {
      fetchDrought(place.lat, place.lon, today)
        .then((data) => {
          if (cancelled) return
          droughtCache.current = { key: droughtKey, data }
          setDrought({ status: 'ok', data })
        })
        .catch(() => !cancelled && setDrought((previous) => (previous.status === 'ok' ? previous : { status: 'error' })))
    }
    fetchFires(place.lat, place.lon)
      .then((data) => !cancelled && setFires({ status: 'ok', data }))
      .catch(() => !cancelled && setFires((previous) => (previous.status === 'ok' ? previous : { status: 'error' })))

    fetchAlerts(place.lat, place.lon)
      .then((warnings) => {
        if (cancelled) return
        saveCachedAlerts(place, warnings)
        // Atualização em segundo plano: se surgiu aviso novo (ou ficou mais grave), destaca.
        const fresh = findNewWarnings(seenAlerts.current, warnings)
        if (fresh.length > 0) setFreshAlert(fresh[0])
        seenAlerts.current = new Set(warnings.map(warningKey))
        setAlerts({ status: 'ok', warnings })
      })
      .catch(() => {
        if (cancelled) return
        // Sem conexão: mostra o último aviso salvo, com a data, se ainda estiver valendo.
        const cached = loadCachedAlerts(place)
        const warnings = (cached?.warnings || []).filter((w) => stillValid(w))
        if (cached && warnings.length > 0) setAlerts({ status: 'cached', warnings, savedAt: cached.savedAt })
        else setAlerts({ status: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [place, refreshKey, demo])

  // Atualiza sozinho: a cada 5 minutos com a página visível, ao voltar para a aba
  // depois de um tempo e quando a internet volta.
  useEffect(() => {
    if (demo || !place) return undefined
    const refresh = () => setRefreshKey((key) => key + 1)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) refresh()
    }, 5 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > 2 * 60 * 1000) refresh()
    }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [place, demo])

  const summary = useMemo(() => {
    if (weather.status !== 'ok' && weather.status !== 'cached') return null
    return summarize(weather.forecast, weather.air)
  }, [weather])

  const emergency = Boolean(place) && isEmergency(alerts)

  // Na rota /teste/extremo o cartão "Mais informações" já abre, para o mapa aparecer.
  const moreRef = useRef(null)
  useEffect(() => {
    if (demo && isExtremeDemo() && moreRef.current) moreRef.current.open = true
  }, [demo, emergency])

  // No modo de emergência, mapa e ajuda ficam dentro de "Mais informações". Ir para um deles
  // pelo menu (ou por um link direto) abre o cartão e leva até lá.
  // Ao chegar de outra página (ex.: de /apoie para /#ajuda), o navegador tenta rolar antes de a
  // página existir e fica no topo. Além disso, a previsão chega depois e empurra o trecho para baixo.
  // Por isso a página acompanha o trecho enquanto carrega, até a pessoa rolar ou tocar na tela.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    const target = id ? document.getElementById(id) : null
    if (!target || target.closest('details') || typeof ResizeObserver === 'undefined') return undefined
    const follow = () => target.scrollIntoView({ behavior: 'instant' })
    follow()
    const observer = new ResizeObserver(follow)
    observer.observe(document.body)
    const stop = () => observer.disconnect()
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    events.forEach((name) => window.addEventListener(name, stop, { once: true, passive: true }))
    const timer = setTimeout(stop, 6000)
    return () => {
      stop()
      clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, stop))
    }
  }, [])

  useEffect(() => {
    const openContaining = () => {
      const id = window.location.hash.slice(1)
      const target = id ? document.getElementById(id) : null
      const details = target && target.closest('details')
      if (details && !details.open) {
        details.open = true
        target.scrollIntoView()
      }
    }
    openContaining()
    window.addEventListener('hashchange', openContaining)
    return () => window.removeEventListener('hashchange', openContaining)
  }, [emergency])

  return (
    <div id="inicio" className={emergency ? 'is-emergency' : undefined}>
      {demo && (
        <div className="demo">
          <strong>Modo de teste</strong> · dados simulados, nada aqui é real. <a href="/">Sair do teste</a>
        </div>
      )}
      <Header />
      {/* A busca vem sempre primeiro; a faixa de avisos fica logo abaixo dela. */}
      <SearchBar onSelect={selectPlace} />
      {place && <AlertBand state={alerts} />}
      {freshAlert && (
        <div className="newalert" role="status">
          <div className="container newalert__inner">
            <LuBellRing size={20} aria-hidden="true" />
            <span><strong>Novo aviso:</strong> {freshAlert.title || 'aviso meteorológico'}{freshAlert.severity && freshAlert.severity !== 'desconhecido' ? ` (${freshAlert.severity})` : ''}</span>
            <button type="button" onClick={() => setFreshAlert(null)}>Entendi</button>
          </div>
        </div>
      )}
      <main className="container page">
        {!place && (
          <p className="empty">
            Digite o nome da sua cidade ou o CEP para ver a previsão hora a hora, os avisos oficiais do INMET e como pedir ajuda.
          </p>
        )}
        {place && (
          <>
            <div className="page__head">
              <h1>{placeLabel(place)}</h1>
              {summary && (
                <span className="refresh">
                  <span className="mono muted small">{refreshing ? 'Atualizando…' : `Atualizado às ${summary.updatedAt}`}</span>
                  <button type="button" className="refresh__btn" onClick={() => setRefreshKey((k) => k + 1)} disabled={refreshing}
                    aria-label="Atualizar previsão" title="Atualizar previsão">
                    <LuRefreshCw className={refreshing ? 'spin' : undefined} size={18} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
            {weather.status === 'cached' && (
              <p className="notice" role="status">
                Sem conexão com a previsão. Mostrando os dados salvos em {formatSavedAt(weather.savedAt)}.
              </p>
            )}
            {weather.status === 'loading' && <p className="notice" role="status">Carregando a previsão…</p>}
            {weather.status === 'error' && (
              <p className="notice notice--error" role="alert">
                Não foi possível carregar a previsão agora e não há dados salvos para este local. Tente de novo em instantes.
              </p>
            )}
            {summary && (
              <div className="layout">
                <div className="layout__main">
                  <NowStrip now={summary.now} />
                  <Forecast days={summary.days} nowHour={summary.nowHour} sun={summary.sun} />
                </div>
                <SideInfo compact={emergency} />
              </div>
            )}
            {!summary && weather.status !== 'loading' && <SideInfo />}
          </>
        )}
        {emergency ? (
          <details className="more" ref={moreRef}>
            <summary className="more__summary">
              <span className="more__text">
                <span className="more__title">Mais informações</span>
                <span className="more__hint">Rios, reservatórios, seca, ar, queimadas e como pedir ajuda</span>
              </span>
              <LuChevronDown className="more__chev" size={22} aria-hidden="true" />
            </summary>
            <div className="more__body">
              {summary && <Indicators now={summary.now} air={summary.air} today={summary.today} river={river} fires={fires} reservoirs={reservoirs} drought={drought} />}
              {place && <div className="wide"><MapSection place={place} demo={demo} /></div>}
              <Help />
            </div>
          </details>
        ) : (
          <>
            {/* Largura total da página, como os números de emergência, e não só a coluna da esquerda. */}
            {summary && (
              <div className="wide">
                <Indicators now={summary.now} air={summary.air} today={summary.today} river={river} fires={fires} reservoirs={reservoirs} drought={drought} />
              </div>
            )}
            {place && <div className="wide"><MapSection place={place} demo={demo} /></div>}
            <Help />
          </>
        )}
      </main>
      <Footer />
      {emergency && <EmergencyDock />}
    </div>
  )
}

export default function App() {
  if (isDonateRoute()) {
    return (
      <div>
        <Header standalone current="apoie" />
        <Suspense fallback={<p className="notice container">Carregando…</p>}>
          <Donate />
        </Suspense>
        <Footer />
      </div>
    )
  }
  if (isKnownRoute()) return <Home />
  return (
    <div>
      <Header standalone />
      <NotFound />
      <Footer />
    </div>
  )
}
