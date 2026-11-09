import { useEffect, useId, useRef, useState } from 'react'
import { buildChart, rainLevel, tempColor } from '../lib/chart.js'
import { dayNumber, dayTitle, formatMm, formatPercent, formatTemp, weekdayShort } from '../lib/format.js'
import { uvLevel } from '../lib/levels.js'
import { splitPeriods } from '../lib/weather.js'
import { useNarrow } from '../hooks.js'

const hh = (hour) => `${String(hour).padStart(2, '0')}h`

function dayLabel(date, index) {
  if (index === 0) return 'Hoje'
  if (index === 1) return 'Amanhã'
  return weekdayShort(date)
}

function DayTabs({ days, selected, onSelect }) {
  return (
    <div className="tabs" role="group" aria-label="Escolha o dia">
      {days.map((day, index) => (
        <button key={day.date} type="button" className="tabs__tab" aria-pressed={index === selected} onClick={() => onSelect(index)}>
          <span className="tabs__label">{dayLabel(day.date, index)}</span>
          <span className="tabs__sub mono">{weekdayShort(day.date)} {dayNumber(day.date)}</span>
          <span className="tabs__short">{weekdayShort(day.date)}</span>
          <span className="tabs__num mono">{dayNumber(day.date)}</span>
        </button>
      ))}
    </div>
  )
}

// Resumo do dia: os pontos que mais importam, cada um leva à hora correspondente.
function Highlights({ hours, onPick }) {
  const withTemp = hours.filter((h) => h.temp != null)
  const withRain = hours.filter((h) => h.rainChance != null)
  if (!withTemp.length && !withRain.length) return null
  const hot = withTemp.reduce((a, b) => (b.temp > a.temp ? b : a), withTemp[0])
  const cold = withTemp.reduce((a, b) => (b.temp < a.temp ? b : a), withTemp[0])
  const wet = withRain.reduce((a, b) => (b.rainChance > a.rainChance ? b : a), withRain[0])
  const total = hours.reduce((sum, h) => sum + (h.precip || 0), 0)
  const rainHours = withRain.filter((h) => h.rainChance >= 50).length
  const level = wet ? rainLevel(wet.rainChance) : null
  const items = []
  if (hot) items.push({ key: 'hot', label: 'Mais quente', value: formatTemp(hot.temp), sub: `às ${hh(hot.hour)}`, hour: hot.hour, color: tempColor(hot.temp) })
  if (cold) items.push({ key: 'cold', label: 'Mais frio', value: formatTemp(cold.temp), sub: `às ${hh(cold.hour)}`, hour: cold.hour, color: tempColor(cold.temp) })
  if (wet) items.push({ key: 'wet', label: 'Pico de chuva', value: formatPercent(wet.rainChance), sub: `às ${hh(wet.hour)}`, hour: wet.hour, color: level.color })
  items.push({
    key: 'mm', label: 'Chuva no dia', value: formatMm(total),
    sub: rainHours ? `${rainHours} h de chuva provável` : 'sem chuva provável',
    hour: wet?.hour, color: total > 0 ? '#2f7fc4' : '#c4cbd2',
  })
  return (
    <ul className="highlights">
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" className="highlight" style={{ '--accent': it.color }} onClick={() => it.hour != null && onPick(it.hour)}>
            <span className="highlight__label">{it.label}</span>
            <span className="highlight__value mono">{it.value}</span>
            <span className="highlight__sub">{it.sub}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Painel fixo com os detalhes da hora escolhida (passando o mouse, tocando ou usando as setas).
function HourDetail({ hour, isNow }) {
  if (!hour) return <div className="detail detail--empty">Sem dados para esta hora.</div>
  const rain = rainLevel(hour.rainChance)
  const uv = uvLevel(hour.uv)
  return (
    <div className="detail" aria-live="polite">
      <div className="detail__when">
        <span className="detail__hour mono">{hh(hour.hour)}</span>
        {isNow && <span className="detail__now">Agora</span>}
      </div>
      <div className="detail__temp">
        <span className="detail__big mono" style={{ color: tempColor(hour.temp) }}>{formatTemp(hour.temp)}</span>
        <span className="detail__small">Sensação {formatTemp(hour.feels)}</span>
      </div>
      <div className="detail__rain">
        <span className="badge" style={{ background: rain.color, color: rain.ink }}>{rain.label}</span>
        <span className="detail__small"><b className="mono">{formatPercent(hour.rainChance)}</b> de chance · <b className="mono">{formatMm(hour.precip)}</b></span>
      </div>
      <div className="detail__uv">
        <span className="detail__small">Índice UV</span>
        <span><b className="mono">{hour.uv == null ? '–' : Math.round(hour.uv * 10) / 10}</b>{uv && <span className="detail__small"> · {uv.label}</span>}</span>
      </div>
    </div>
  )
}

function Chart({ hours, nowHour, narrow, activeHour, onPick, onLeave }) {
  const c = buildChart(hours, { narrow, nowHour })
  const gradId = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const font = { fontFamily: 'IBM Plex Mono, monospace', fontSize: c.fontSize, fill: '#4F5B66' }
  const active = c.points.find((p) => p.hour === activeHour)
  const activeData = hours.find((h) => h.hour === activeHour)
  const last = hours.length ? hours[hours.length - 1].hour : 23

  const hourFromEvent = (event) => {
    const rect = svgRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * c.width
    return Math.max(0, Math.min(last, Math.floor((x - c.x0) / c.step)))
  }
  const handlePointer = (event) => onPick(hourFromEvent(event))
  const handleKey = (event) => {
    const current = activeHour ?? nowHour ?? 12
    const moves = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: last }
    if (!(event.key in moves)) return
    event.preventDefault()
    onPick(Math.max(0, Math.min(last, moves[event.key])))
  }

  // Posição da bolha de valor: vira para o outro lado perto das bordas.
  const bubbleW = 40
  const bubbleX = active ? Math.max(c.x0, Math.min(c.xRight - bubbleW, active.x - bubbleW / 2)) : 0
  const bubbleY = active ? (active.y - c.top > 30 ? active.y - 32 : active.y + 10) : 0

  return (
    <div className="chart-wrap" tabIndex={0} role="group" onKeyDown={handleKey}
      aria-label="Gráfico da temperatura (linha) e da chance de chuva (barras). Use as setas para esquerda e direita para ver cada hora.">
      <svg ref={svgRef} viewBox={`0 0 ${c.width} ${c.height}`} width="100%" className="chart"
        onPointerMove={handlePointer} onPointerDown={handlePointer}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onLeave()}>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={c.top} y2={c.bottom}>
            {c.gradient.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
        </defs>
        {active && <rect x={active.x - c.step / 2} y={c.top - 6} width={c.step} height={c.bottom - c.top + 6} fill="#E3ECF5" />}
        {c.gridLines.map((y) => <line key={y} x1={c.x0} x2={c.xRight} y1={y} y2={y} stroke="#E1E5E9" />)}
        {c.bars.map((b) => (
          <rect key={b.hour} x={b.x} y={b.y} width={b.width} height={b.height} fill={b.color}
            opacity={activeHour == null || b.hour === activeHour ? 1 : 0.55} />
        ))}
        {c.linePath && <path d={c.linePath} fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
        {c.dots.map((d) => <circle key={d.hour} cx={d.x} cy={d.y} r="3.5" fill="#FFFFFF" stroke="#0F1B26" strokeWidth="1.5" />)}
        {c.xLabels.map((l) => <text key={l.text} x={l.x} y={c.bottom + 22} textAnchor="middle" style={font}>{l.text}</text>)}
        {c.tempMax != null && <text x="0" y={c.top + 4} style={font}>{c.tempMax}°</text>}
        {c.tempMin != null && <text x="0" y={c.bottom + 4} style={font}>{c.tempMin}°</text>}
        <text x={c.width} y={c.top + 4} textAnchor="end" style={font}>100%</text>
        <text x={c.width} y={c.bottom + 4} textAnchor="end" style={font}>0%</text>
        {c.nowX != null && (
          <g>
            <line x1={c.nowX} x2={c.nowX} y1={c.top - 6} y2={c.bottom} stroke="#0F1B26" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={c.nowX} y={c.top - 12} textAnchor="middle" style={{ ...font, fill: '#0F1B26', fontFamily: 'Public Sans, sans-serif', fontWeight: 700 }}>Agora</text>
          </g>
        )}
        {active && (
          <g pointerEvents="none">
            <line x1={active.x} x2={active.x} y1={c.top - 6} y2={c.bottom} stroke="#0F1B26" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r="6" fill={tempColor(activeData?.temp)} stroke="#FFFFFF" strokeWidth="2.5" />
            <rect x={bubbleX} y={bubbleY} width={bubbleW} height="22" rx="4" fill="#0F1B26" />
            <text x={bubbleX + bubbleW / 2} y={bubbleY + 15} textAnchor="middle" style={{ ...font, fill: '#FFFFFF', fontWeight: 600 }}>{formatTemp(activeData?.temp)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function Periods({ hours, isToday, nowHour, activeHour, onPick, onLeave }) {
  return (
    <div className="periods">
      {splitPeriods(hours).map((period) => (
        <div key={period.name}>
          <div className="periods__head"><span>{period.name}</span><span>{period.range}</span></div>
          <div className="periods__cells">
            {period.hours.map((h) => {
              const isNow = isToday && h.hour === nowHour
              const rain = rainLevel(h.rainChance)
              const cls = `cell${isNow ? ' cell--now' : ''}${h.hour === activeHour ? ' cell--active' : ''}`
              return (
                <button key={h.time} type="button" className={cls} style={{ '--temp': tempColor(h.temp) }}
                  aria-label={`${hh(h.hour)}: ${formatTemp(h.temp)}, chance de chuva ${formatPercent(h.rainChance)}`}
                  onMouseEnter={() => onPick(h.hour)} onMouseLeave={onLeave} onFocus={() => onPick(h.hour)} onClick={() => onPick(h.hour)}>
                  <span className="cell__hour mono">{isNow ? 'Agora' : hh(h.hour)}</span>
                  <span className="cell__temp mono">{formatTemp(h.temp)}</span>
                  <span className="cell__rain mono" style={{ background: rain.color, color: rain.ink }}>{formatPercent(h.rainChance)}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Legend() {
  const levels = [10, 35, 60, 85].map(rainLevel)
  return (
    <div className="legend">
      <span>
        <i className="legend__temp" aria-hidden="true" />Temperatura (°C): azul = frio, vermelho = calor
      </span>
      <span>
        Chance de chuva:
        {levels.map((l) => (
          <span key={l.key} className="legend__chip"><i style={{ background: l.color }} aria-hidden="true" />{l.key === 'low' ? '< 20%' : l.key === 'some' ? '20–49%' : l.key === 'likely' ? '50–69%' : '≥ 70%'}</span>
        ))}
      </span>
    </div>
  )
}

export default function Forecast({ days, nowHour, sun }) {
  const [selected, setSelected] = useState(0)
  const [picked, setPicked] = useState(null)
  const narrow = useNarrow()
  // Ao trocar de cidade, volta para "Hoje".
  useEffect(() => setSelected(0), [days[0]?.date, days.length])
  // Ao trocar de dia, limpa a hora escolhida.
  useEffect(() => setPicked(null), [selected, days[0]?.date])
  const day = days[selected] || days[0]
  if (!day) return null
  const isToday = selected === 0
  const activeHour = picked ?? (isToday ? nowHour : 12)
  const activeData = day.hours.find((h) => h.hour === activeHour)
  const clear = () => setPicked(null)
  return (
    <section aria-labelledby="t-prev">
      <h2 id="t-prev" className="section-title">Previsão hora a hora</h2>
      <DayTabs days={days} selected={selected} onSelect={setSelected} />
      <p className="forecast__date" aria-live="polite">{dayTitle(day.date)}</p>
      <Highlights hours={day.hours} onPick={setPicked} />
      <div className="chartbox">
        <HourDetail hour={activeData} isNow={isToday && activeHour === nowHour} />
        <Chart hours={day.hours} nowHour={isToday ? nowHour : null} narrow={narrow} activeHour={activeHour} onPick={setPicked} onLeave={clear} />
        <p className="chart__hint">Passe o mouse, toque ou use as setas ← → para ver cada hora.</p>
        <Legend />
      </div>
      <Periods hours={day.hours} isToday={isToday} nowHour={nowHour} activeHour={activeHour} onPick={setPicked} onLeave={clear} />
      <p className="note">
        Em cada hora: temperatura e chance de chuva.
        {sun && <> Nascer do sol {sun.rise} · Pôr do sol {sun.set} (hoje).</>} Fonte: Open-Meteo.
      </p>
    </section>
  )
}
