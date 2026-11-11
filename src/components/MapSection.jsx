import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { lazyWithReload } from '../lib/lazy.js'
import { LuMap, LuRefreshCw } from 'react-icons/lu'
import { buildDemoMap, buildDemoRain, demoLevel, isExtremeDemo } from '../lib/demo.js'
import { describeMap, fetchMapData, fetchRain, formatMm, summarizeAreas, summarizeRain } from '../lib/map.js'
import { t, useLang } from '../lib/i18n.js'
import AreaList from './AreaList.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// O mapa (biblioteca, estilos e imagens) só é baixado quando a pessoa abre. Quem está com sinal fraco
// e só quer o aviso nunca paga esse custo.
const MapView = lazyWithReload(() => import('./MapView.jsx'))

// Textos em português; a tradução é feita na hora de desenhar.
const FILTERS = [
  ['todos', 'Todos'],
  ['hoje', 'Hoje'],
  ['proximos', 'Próximos dias'],
]

const isToday = (area) => !area.when || area.when === 'hoje'
const inFilter = (area, filter) => filter === 'todos' || (filter === 'hoje' ? isToday(area) : !isToday(area))

function Stat({ label, value, sub }) {
  return (
    <div className="mapstat">
      <span className="mapstat__label">{label}</span>
      <span className="mapstat__value">{value}</span>
      {sub && <span className="mapstat__sub">{sub}</span>}
    </div>
  )
}

function areasSub(counts) {
  const parts = ['vermelho', 'laranja', 'amarelo'].filter((level) => counts.by[level] > 0).map((level) => `${counts.by[level]} ${t(level)}`)
  return parts.length ? parts.join(' · ') : t('nenhum por perto')
}

export default function MapSection({ place, demo = false }) {
  useLang()
  // Na rota /teste/extremo o mapa já abre sozinho, para ver o cenário sem precisar procurar.
  const extreme = demo && isExtremeDemo()
  const [open, setOpen] = useState(extreme)
  const [state, setState] = useState({ status: 'idle' })
  const [rain, setRain] = useState({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState('todos')
  const [focus, setFocus] = useState(null)

  const load = useCallback(() => {
    if (demo) {
      const level = demoLevel()
      setState({ status: 'ok', data: buildDemoMap(place, level, new Date(), extreme) })
      setRain({ status: 'ok', data: buildDemoRain(place, level, extreme) })
      return undefined
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState({ status: 'offline' })
      return undefined
    }
    let cancelled = false
    setState({ status: 'loading' })
    setRain({ status: 'loading' })
    fetchMapData(place.lat, place.lon)
      .then((data) => !cancelled && setState({ status: 'ok', data }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    // A chuva é um extra: se falhar, o mapa continua com avisos e focos.
    fetchRain(place.lat, place.lon)
      .then((data) => !cancelled && setRain({ status: 'ok', data }))
      .catch(() => !cancelled && setRain({ status: 'error' }))
    return () => { cancelled = true }
  }, [place, demo, extreme])

  // Ir para #mapa (atalho do menu ou link direto) abre o mapa e leva até ele. A rolagem do próprio
  // link é interrompida quando o bloco muda de tamanho ao abrir, por isso rolamos de novo à mão.
  const root = useRef(null)
  const pendingScroll = useRef(extreme)
  const scrollToMap = useCallback(() => root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), [])
  useEffect(() => {
    const openForHash = () => {
      if (window.location.hash !== '#mapa') return
      pendingScroll.current = true
      setOpen(true)
      setTimeout(scrollToMap, 80)
    }
    openForHash()
    window.addEventListener('hashchange', openForHash)
    return () => window.removeEventListener('hashchange', openForHash)
  }, [scrollToMap])
  useEffect(() => {
    if (state.status === 'ok' && pendingScroll.current) {
      pendingScroll.current = false
      setTimeout(scrollToMap, 80)
    }
  }, [state.status, scrollToMap])

  // Carrega os dados ao abrir e de novo se o local mudar com o mapa aberto.
  useEffect(() => (open ? load() : undefined), [open, load])

  const allAreas = state.status === 'ok' ? state.data.areas : null
  const areas = allAreas == null ? null : allAreas.filter((area) => inFilter(area, filter))
  const data = state.status === 'ok' ? { ...state.data, areas } : null
  const summary = data ? describeMap(data, place) : null
  const counts = summarizeAreas(areas)
  const hasAnyAreas = (allAreas?.length || 0) > 0
  // Sem nenhuma área de aviso, o mapa ocupa a largura toda e não sobra coluna vazia.
  const solo = areas != null && !hasAnyAreas
  const rainSummary = rain.status === 'ok' ? summarizeRain(rain.data, place) : null
  const rainData = rain.status === 'ok' ? rain.data : null

  return (
    <section className="mapsec" id="mapa" ref={root} aria-labelledby="t-mapa">
      <h2 id="t-mapa" className="section-title">{t('Mapa dos avisos')}</h2>
      {!open ? (
        <div className="mapsec__intro">
          <p>{t('Veja se o seu local está dentro de uma área de aviso, onde deve chover mais nas próximas 24 horas e onde há focos de calor por perto.')}</p>
          <button type="button" className="mapsec__open" onClick={() => setOpen(true)}>
            <LuMap size={20} aria-hidden="true" /> {t('Ver no mapa')}
          </button>
        </div>
      ) : (
        <div className="mapsec__body">
          {state.status === 'loading' && <p className="mapsec__status" role="status">{t('Carregando o mapa…')}</p>}
          {state.status === 'offline' && (
            <p className="mapsec__status mapsec__status--warn" role="status">{t('Sem internet: o mapa precisa de conexão. Os avisos e os cartões acima continuam valendo.')}</p>
          )}
          {state.status === 'error' && (
            <div className="mapsec__status mapsec__status--warn" role="alert">
              <span>{t('Não foi possível carregar o mapa agora.')}</span>
              <button type="button" onClick={load}><LuRefreshCw size={16} aria-hidden="true" /> {t('Tentar de novo')}</button>
            </div>
          )}
          {summary && (
            <>
              <p className={`mapsec__headline${summary.level ? ` mapsec__headline--${summary.level}` : ''}`} role="status">{summary.headline}</p>

              <div className="mapstats">
                <Stat label={t('Avisos por perto')} value={counts.total} sub={areasSub(counts)} />
                {rainSummary ? (
                  <Stat label={t('Chuva em 24 h no seu local')} value={formatMm(rainSummary.here)} sub={t('até {value} na região', { value: formatMm(rainSummary.max) })} />
                ) : (
                  <Stat label={t('Chuva em 24 h')} value="–" sub={rain.status === 'loading' ? t('carregando…') : t('indisponível agora')} />
                )}
                {summary.firesCount != null && <Stat label={t('Focos de calor em 50 km')} value={summary.firesCount} sub={t('INPE, hoje')} />}
              </div>

              {hasAnyAreas && (
                <div className="mapfilter" role="group" aria-label={t('Período dos avisos')}>
                  {FILTERS.map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{t(label)}</button>
                  ))}
                </div>
              )}

              <div className={`mappanel${solo ? ' mappanel--solo' : ''}`}>
                <ErrorBoundary
                  key={attempt}
                  fallback={(
                    <div className="mapsec__status mapsec__status--warn" role="alert">
                      <span>{t('Não foi possível mostrar o mapa agora. Os avisos e os cartões continuam valendo.')}</span>
                      <button type="button" onClick={() => setAttempt((n) => n + 1)}><LuRefreshCw size={16} aria-hidden="true" /> {t('Tentar de novo')}</button>
                    </div>
                  )}
                >
                  <Suspense fallback={<p className="mapsec__status" role="status">{t('Carregando o mapa…')}</p>}>
                    <MapView place={place} data={data} rain={rainData} focus={focus} />
                  </Suspense>
                </ErrorBoundary>
                {!solo && (
                  <div className="mappanel__side">
                    <h3 className="mappanel__title">{t('Avisos por perto')}</h3>
                    {areas ? <AreaList areas={areas} onFocus={(id) => setFocus({ id, n: Date.now() })} /> : <p className="arealist__empty">{t('Não foi possível consultar as áreas de aviso agora.')}</p>}
                  </div>
                )}
              </div>
              <p className="mapsec__note">{t('As áreas do INMET são aproximadas. Em caso de dúvida, confira o aviso oficial. Chuva prevista: Open-Meteo, modelo. Focos de calor: INPE, de hoje.')}</p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
