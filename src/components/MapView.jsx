import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatDateTime } from '../lib/format.js'
import { LEVEL_NAME, RAIN_BINS, SEVERITY_LABEL, areaKey, buildRainField, formatMm, rainAt, rainBin, whatIsHere } from '../lib/map.js'
import { t, useLang } from '../lib/i18n.js'
import { translateTitle } from '../lib/inmet.js'

// Fundo do mapa. O padrão é o do OpenStreetMap, que tem regras de uso (uso leve, com crédito).
// Para muito acesso ou uso comercial, troque por um provedor próprio nestas variáveis.
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const TILES_URL = env.VITE_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILES_CREDIT = env.VITE_MAP_ATTRIBUTION || '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Cada nível tem cor e traço próprios, para ler sem depender só da cor.
export const AREA_STYLE = {
  vermelho: { color: '#c8382e', dashArray: null },
  laranja: { color: '#e8741f', dashArray: '6 5' },
  amarelo: { color: '#d9a400', dashArray: '2 6' },
  desconhecido: { color: '#4f5b66', dashArray: '8 4' },
}

// Textos em português; a tradução é feita na hora de desenhar.
const LAYERS = [
  ['areas', 'Áreas de aviso'],
  ['rain', 'Chuva em 24 h'],
  ['fires', 'Focos de calor'],
]

// Mapa de calor da chuva: uma imagem suave, estimada entre os pontos da grade.
function rainOverlay(field) {
  const size = 200
  const half = field.step / 2
  const latMin = field.lats[0] - half
  const latMax = field.lats[field.lats.length - 1] + half
  const lonMin = field.lons[0] - half
  const lonMax = field.lons[field.lons.length - 1] + half
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    const lat = latMax - ((y + 0.5) / size) * (latMax - latMin)
    for (let x = 0; x < size; x++) {
      const lon = lonMin + ((x + 0.5) / size) * (lonMax - lonMin)
      const bin = rainBin(rainAt(field, lat, lon) ?? 0)
      if (!bin) continue
      // Além dos pontos da grade não há dado: a chuva desbota na borda em vez de terminar seca.
      const fade = Math.min(1, (lat - latMin) / half, (latMax - lat) / half, (lon - lonMin) / half, (lonMax - lon) / half)
      const offset = (y * size + x) * 4
      image.data[offset] = parseInt(bin.color.slice(1, 3), 16)
      image.data[offset + 1] = parseInt(bin.color.slice(3, 5), 16)
      image.data[offset + 2] = parseInt(bin.color.slice(5, 7), 16)
      image.data[offset + 3] = Math.round(215 * Math.max(0, fade))
    }
  }
  context.putImageData(image, 0, 0)
  return { url: canvas.toDataURL('image/png'), bounds: [[latMin, lonMin], [latMax, lonMax]] }
}

// Balão com o que existe no ponto: um aviso, um foco de calor, a chuva prevista.
function hereBox(items) {
  const box = document.createElement('div')
  box.className = 'mapinfo'
  const add = (parent, tag, text, className) => {
    const element = document.createElement(tag)
    element.textContent = text
    if (className) element.className = className
    parent.append(element)
  }
  for (const item of items) {
    const part = document.createElement('div')
    part.className = 'mapinfo__item'
    if (item.kind === 'area') {
      const { area } = item
      const future = area.when === 'hoje' || !area.when ? '' : ` (${t('previsto')})`
      add(part, 'strong', t('Aviso {level}{future}: {title}', { level: SEVERITY_LABEL[area.severity] || t('do INMET'), future, title: translateTitle(area.title) || t('aviso meteorológico') }))
      if (area.end) add(part, 'div', t('Válido até {date}', { date: formatDateTime(area.end) }))
      add(part, 'div', area.inside ? t('O seu local está dentro desta área.') : t('O seu local está fora desta área.'))
    } else if (item.kind === 'fire') {
      add(part, 'strong', t('Foco de calor'))
      add(part, 'div', t('Detectado hoje pelo INPE.'))
    } else {
      add(part, 'strong', t('Chuva prevista'))
      add(part, 'div', t('{value} em 24 h ({label})', { value: formatMm(item.mm), label: item.label }))
    }
    box.append(part)
  }
  return box
}

export default function MapView({ place, data, rain, focus }) {
  const lang = useLang()
  const element = useRef(null)
  const mapRef = useRef(null)
  const layers = useRef({})
  const areaLayers = useRef(new Map())
  const areaData = useRef(new Map())
  const clickHandler = useRef(null)
  const showRef = useRef({})
  const [show, setShow] = useState({ areas: true, rain: true, fires: true })
  const [legendOpen, setLegendOpen] = useState(false)

  const areas = data?.areas || []
  const points = data?.fires?.points || []
  const field = useMemo(() => buildRainField(rain?.cells, rain?.step), [rain])
  const available = { areas: areas.length > 0, rain: Boolean(field), fires: points.length > 0 }
  const controls = LAYERS.filter(([key]) => available[key])
  showRef.current = show

  // Cria o mapa uma vez e o desmonta ao sair.
  useEffect(() => {
    const map = L.map(element.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, minZoom: 5 })
    map.attributionControl.setPrefix(false)
    // O Leaflet precisa de centro e zoom antes de receber áreas desenhadas.
    map.setView([place.lat, place.lon], 7)
    // A chuva fica numa camada própria, abaixo das áreas de aviso.
    map.createPane('rainPane').style.zIndex = 380
    L.tileLayer(TILES_URL, { attribution: TILES_CREDIT, maxZoom: 18 }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Desenha chuva, áreas, focos e o ponto da pessoa sempre que os dados mudam.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    Object.values(layers.current).forEach((layer) => layer && map.removeLayer(layer))
    areaLayers.current = new Map()
    areaData.current = new Map()
    const here = [place.lat, place.lon]
    map.setView(here, 7, { animate: false })

    const rainGroup = L.layerGroup()
    if (field) {
      const overlay = rainOverlay(field)
      L.imageOverlay(overlay.url, overlay.bounds, { pane: 'rainPane', opacity: 0.62, interactive: false }).addTo(rainGroup)
    }

    const areaGroup = L.featureGroup()
    const insideBounds = []
    // As áreas mais leves primeiro, para as mais graves ficarem por cima.
    ;[...areas].map((area, index) => ({ area, index })).reverse().forEach(({ area, index }) => {
      const style = AREA_STYLE[area.severity] || AREA_STYLE.desconhecido
      const layer = L.geoJSON(area.geometry, {
        interactive: false,
        style: { color: style.color, weight: area.inside ? 4 : 3, dashArray: style.dashArray, fillColor: style.color, fillOpacity: area.inside ? 0.2 : 0.1 },
      })
      layer.addTo(areaGroup)
      areaLayers.current.set(areaKey(area, index), layer)
      areaData.current.set(areaKey(area, index), area)
      if (area.inside) insideBounds.push(layer.getBounds())
    })

    const fireGroup = L.featureGroup()
    if (points.length > 0) {
      L.circle(here, { radius: 50000, color: '#4f5b66', weight: 1.5, dashArray: '2 6', fill: false, interactive: false }).addTo(fireGroup)
      for (const [lat, lon] of points) {
        L.circleMarker([lat, lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#dc5a1c', fillOpacity: 0.95 }).bindTooltip(t('Foco de calor')).addTo(fireGroup)
      }
    }

    const me = L.circleMarker(here, { radius: 9, color: '#fff', weight: 3, fillColor: '#0f1b26', fillOpacity: 1, interactive: false })
      .bindTooltip(t('Você está aqui'), { permanent: true, direction: 'top', offset: [0, -8] })

    layers.current = { rain: rainGroup, areas: areaGroup, fires: fireGroup, me }
    if (show.rain) rainGroup.addTo(map)
    if (show.areas) areaGroup.addTo(map)
    if (show.fires) fireGroup.addTo(map)
    me.addTo(map)

    // Tocar no mapa mostra o que existe ali (aviso, foco ou chuva). Sem nada, não abre balão.
    if (clickHandler.current) map.off('click', clickHandler.current)
    clickHandler.current = (event) => {
      const clicked = map.latLngToContainerPoint(event.latlng)
      const fireNearby = points.some(([lat, lon]) => map.latLngToContainerPoint([lat, lon]).distanceTo(clicked) <= 12)
      const items = whatIsHere({ lat: event.latlng.lat, lon: event.latlng.lng, areas, field, fireNearby, show: showRef.current })
      if (items.length === 0) {
        map.closePopup()
        return
      }
      L.popup({ maxWidth: 280 }).setLatLng(event.latlng).setContent(hereBox(items)).openOn(map)
    }
    map.on('click', clickHandler.current)

    if (insideBounds.length > 0) {
      const bounds = insideBounds.reduce((all, one) => all.extend(one), L.latLngBounds([here, here]))
      map.fitBounds(bounds.pad(0.15), { maxZoom: 9, animate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, field, place, lang])

  // Liga e desliga as camadas.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [key] of LAYERS) {
      const layer = layers.current[key]
      if (!layer) continue
      if (show[key] && !map.hasLayer(layer)) layer.addTo(map)
      if (!show[key] && map.hasLayer(layer)) map.removeLayer(layer)
    }
  }, [show])

  // Tocar numa área da lista leva o mapa até ela.
  useEffect(() => {
    const map = mapRef.current
    const layer = focus && areaLayers.current.get(focus.id)
    if (!map || !layer) return
    if (!map.hasLayer(layer)) {
      layers.current.areas?.addTo(map)
      setShow((current) => ({ ...current, areas: true }))
    }
    map.fitBounds(layer.getBounds().pad(0.2), { maxZoom: 10 })
    L.popup({ maxWidth: 270 }).setLatLng(layer.getBounds().getCenter()).setContent(hereBox([{ kind: 'area', area: areaData.current.get(focus.id) }])).openOn(map)
    element.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focus])

  return (
    <div className="mapview">
      <div className="mapframe">
        <div ref={element} className="mapview__map" role="region" aria-label={t('Mapa com as áreas de aviso, a chuva prevista e os focos de calor perto de você')} />

        {controls.length > 1 && (
          <div className="mapview__toggles" role="group" aria-label={t('Camadas do mapa')}>
            {controls.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={show[key]} onClick={() => setShow((current) => ({ ...current, [key]: !current[key] }))}>{t(label)}</button>
            ))}
          </div>
        )}

        <details className="maplegend" open={legendOpen} onToggle={(event) => setLegendOpen(event.currentTarget.open)}>
          <summary>{t('Legenda')}</summary>
          <div className="maplegend__body">
            {available.areas && (
              <ul className="maplegend__row" aria-label={t('Níveis de aviso')}>
                {['vermelho', 'laranja', 'amarelo'].map((level) => (
                  <li key={level}>
                    <svg width="22" height="12" aria-hidden="true">
                      <rect x="1" y="1" width="20" height="10" rx="2" fill={AREA_STYLE[level].color} fillOpacity="0.3" stroke={AREA_STYLE[level].color} strokeWidth="2" strokeDasharray={AREA_STYLE[level].dashArray || undefined} />
                    </svg>
                    {LEVEL_NAME[level]}
                  </li>
                ))}
              </ul>
            )}
            <ul className="maplegend__row" aria-label={t('Marcadores')}>
              <li><span className="mapview__dot mapview__dot--me" aria-hidden="true" />{t('Seu local')}</li>
              {available.fires && <li><span className="mapview__dot mapview__dot--fire" aria-hidden="true" />{t('Foco')}</li>}
              {available.fires && (
                <li>
                  <svg width="22" height="12" aria-hidden="true"><line x1="1" y1="6" x2="21" y2="6" stroke="#4f5b66" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" /></svg>
                  {t('Raio 50 km')}
                </li>
              )}
            </ul>
            {available.rain && (
              <div className="maplegend__rain" role="img" aria-label={t('Chuva em 24 horas: {levels}', { levels: [...RAIN_BINS].reverse().map((bin) => bin.label).join(', ') })}>
                <span className="maplegend__title">{t('Chuva em 24 h (mm)')}</span>
                <div className="maplegend__bar">
                  {[...RAIN_BINS].reverse().map((bin) => (
                    <span key={bin.key} style={{ background: bin.color }}><b>{bin.min}{bin.key === 'extrema' ? '+' : ''}</b></span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
