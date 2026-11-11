import { LuCloudRain, LuDroplets, LuThermometer, LuThermometerSun, LuWind } from 'react-icons/lu'
import { tempColor } from '../lib/chart.js'
import { formatMm, formatPercent, formatTemp } from '../lib/format.js'
import { t, useLang } from '../lib/i18n.js'

export default function NowStrip({ now }) {
  useLang()
  const items = [
    { label: t('Temperatura'), Icon: LuThermometer, value: formatTemp(now.temp), color: tempColor(now.temp) },
    { label: t('Sensação'), Icon: LuThermometerSun, value: formatTemp(now.feels), color: tempColor(now.feels) },
    { label: t('Umidade'), Icon: LuDroplets, value: formatPercent(now.humidity), color: '#1560bd' },
    { label: t('Vento'), Icon: LuWind, value: now.wind == null ? '–' : `${Math.round(now.wind)} km/h`, color: '#0e7c8c' },
    { label: t('Chuva 24h'), Icon: LuCloudRain, value: formatMm(now.rain24h), color: '#2f7fc4' },
  ]
  return (
    <section aria-labelledby="t-agora">
      <h2 id="t-agora" className="section-title">{t('Agora')}</h2>
      <dl className="now-grid">
        {items.map(({ label, Icon, value, color }) => {
          // "17 km/h" vira número + unidade, para a unidade poder ficar menor.
          const [number, ...rest] = String(value).split(' ')
          const unit = rest.join(' ')
          return (
            <div key={label} className="now-grid__item" style={{ '--tint': color }}>
              <dt>
                <span className="now-grid__icon" aria-hidden="true"><Icon size={16} /></span>
                {label}
              </dt>
              <dd className="mono">{number}{unit && <small className="now-grid__unit"> {unit}</small>}</dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
