import {
  LuCircleAlert, LuCircleCheck, LuCloudFog, LuDam, LuFlame, LuOctagonAlert, LuSun, LuThermometerSun, LuTriangleAlert, LuWaves,
} from 'react-icons/lu'
import { airAdvice, airLevel, uvAdvice, uvLevel } from '../lib/levels.js'
import { formatTemp } from '../lib/format.js'
import { droughtStatus, fireStatus, reservoirStatus, riverStatus } from '../lib/environment.js'

// Do mais grave para o menos grave: o que pede atenção aparece primeiro.
const ORDER = { vermelho: 0, laranja: 1, amarelo: 2, sem: 3 }

// Cada nível tem ícone próprio; o texto da etiqueta nunca depende só da cor.
const LEVEL_ICON = { sem: LuCircleCheck, amarelo: LuCircleAlert, laranja: LuTriangleAlert, vermelho: LuOctagonAlert }

// Resultado de uma consulta extra: carregando, com dado, ou sem dado agora.
function extra(state, build) {
  if (!state || state.status === 'loading') return { pending: 'Consultando…' }
  const built = state.status === 'ok' ? build(state.data) : null
  return built || { pending: 'Sem dado agora para este local' }
}

function Chip({ level }) {
  const Icon = LEVEL_ICON[level.key]
  return (
    <span className={`chip chip--${level.key}`}>
      <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
      {level.label}
    </span>
  )
}

// Barra de 0 a 120 com as faixas do índice de qualidade do ar e um marcador.
function Gauge({ value, max, labels }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="gauge" role="img" aria-label={`Índice ${Math.round(value)}, numa escala de 0 a ${max}`}>
      <div className="gauge__bar"><span className="gauge__mark" style={{ left: `${pct}%` }} /></div>
      <div className="gauge__labels"><span>{labels[0]}</span><span>{labels[1]}</span></div>
    </div>
  )
}

function Card({ name, Icon, color, level, headline, sentence, lines = [], gauge, note, pending, source }) {
  return (
    <li className="ind" style={{ '--ic': color }}>
      <div className="ind__head">
        <span className="ind__icon" aria-hidden="true"><Icon size={20} strokeWidth={1.9} /></span>
        <h3 className="ind__name">{name}</h3>
        {level && <Chip level={level} />}
      </div>
      {pending ? (
        <p className="ind__pending">{pending}</p>
      ) : (
        <>
          {headline && <p className="ind__value mono">{headline}</p>}
          {sentence && <p className="ind__sentence">{sentence}</p>}
          {lines.map((line) => <p key={line} className="ind__line">{line}</p>)}
          {gauge && <Gauge {...gauge} />}
          {note && <p className="ind__note">{note}</p>}
        </>
      )}
      <p className="ind__source">Fonte: {source}</p>
    </li>
  )
}

function airCard(air) {
  if (!air || air.eaqi == null) {
    return { name: 'Ar', Icon: LuCloudFog, color: '#4f6bd8', pending: 'Sem dado para este local', source: 'Open-Meteo (CAMS)' }
  }
  const level = airLevel(air.eaqi)
  const advice = airAdvice(air.eaqi)
  return {
    name: 'Ar',
    Icon: LuCloudFog,
    color: '#4f6bd8',
    level: { ...level, label: level.label === 'Extremamente ruim' ? 'Péssima' : level.label },
    sentence: advice.headline,
    lines: advice.care ? [advice.care] : [],
    gauge: { value: air.eaqi, max: 120, labels: ['Boa', 'Péssima'] },
    note: `Índice ${Math.round(air.eaqi)}${air.pm25 != null ? ` · partículas finas no ar (PM2,5): ${Math.round(air.pm25)} µg/m³` : ''}`,
    source: 'Open-Meteo (CAMS)',
  }
}

export default function Indicators({ now, air, today, river, fires, reservoirs, drought }) {
  const uv = uvLevel(now.uv)
  const cards = [
    { name: 'Rios', Icon: LuWaves, color: '#1560bd', ...extra(river, (data) => riverStatus(data, today)), source: 'Open-Meteo (GloFAS), previsão por modelo' },
    { name: 'Reservatórios', Icon: LuDam, color: '#0e7c8c', ...extra(reservoirs, reservoirStatus), source: 'ONS, volume da região' },
    { name: 'Seca', Icon: LuSun, color: '#b45309', ...extra(drought, droughtStatus), source: 'Open-Meteo (ERA5), chuva contra a média' },
    {
      name: 'Calor e UV',
      Icon: LuThermometerSun,
      color: '#d97706',
      level: uv && { ...uv, label: `UV ${uv.label.toLowerCase()}` },
      headline: `Sensação ${formatTemp(now.feels)}`,
      sentence: uvAdvice(now.uv),
      note: now.uv == null ? null : `Índice UV ${Math.round(now.uv)} (vai de 0 a 11 ou mais)`,
      source: 'Open-Meteo',
    },
    airCard(air),
    { name: 'Queimadas', Icon: LuFlame, color: '#dc5a1c', ...extra(fires, fireStatus), source: 'INPE Queimadas, focos de hoje' },
  ]
  const sorted = cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => (ORDER[a.card.level?.key] ?? 4) - (ORDER[b.card.level?.key] ?? 4) || a.index - b.index)
    .map(({ card }) => card)

  return (
    <section aria-labelledby="t-ind">
      <h2 id="t-ind" className="section-title">Água, seca, ar e fogo</h2>
      <p className="muted small ind__intro">O que pede mais atenção aparece primeiro.</p>
      <ul className="ind-grid">
        {sorted.map((card) => <Card key={card.name} {...card} />)}
      </ul>
    </section>
  )
}
