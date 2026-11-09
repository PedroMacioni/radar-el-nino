import { LuCloudRain, LuDroplets, LuThermometer, LuThermometerSun, LuWind } from 'react-icons/lu'
import { tempColor } from '../lib/chart.js'
import { formatMm, formatPercent, formatTemp } from '../lib/format.js'

export default function NowStrip({ now }) {
  const items = [
    { label: 'Temperatura', Icon: LuThermometer, value: formatTemp(now.temp), color: tempColor(now.temp) },
    { label: 'Sensação', Icon: LuThermometerSun, value: formatTemp(now.feels), color: tempColor(now.feels) },
    { label: 'Umidade', Icon: LuDroplets, value: formatPercent(now.humidity), color: '#1560bd' },
    { label: 'Vento', Icon: LuWind, value: now.wind == null ? '–' : `${Math.round(now.wind)} km/h`, color: '#0e7c8c' },
    { label: 'Chuva 24 h', Icon: LuCloudRain, value: formatMm(now.rain24h), color: '#2f7fc4' },
  ]
  return (
    <section aria-labelledby="t-agora">
      <h2 id="t-agora" className="section-title">Agora</h2>
      <dl className="now-grid">
        {items.map(({ label, Icon, value, color }) => (
          <div key={label} className="now-grid__item" style={{ '--tint': color }}>
            <dt>
              <span className="now-grid__icon" aria-hidden="true"><Icon size={16} /></span>
              {label}
            </dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
