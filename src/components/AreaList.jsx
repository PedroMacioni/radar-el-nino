import { formatDateTime, formatNumber } from '../lib/format.js'
import { t, useLang } from '../lib/i18n.js'
import { translateInmet, translateTitle } from '../lib/inmet.js'
import { LEVEL_NAME, areaKey } from '../lib/map.js'

function period(area) {
  if (area.start && area.end) return t('De {start} até {end}', { start: formatDateTime(area.start), end: formatDateTime(area.end) })
  if (area.end) return t('Válido até {date}', { date: formatDateTime(area.end) })
  return null
}

function reachText(reach) {
  if (!reach || reach.count === 0) return null
  const places = reach.count === 1 ? t('1 município') : t('{count} municípios', { count: formatNumber(reach.count) })
  const states = reach.states.join(', ') + (reach.moreStates ? ` ${t('e mais {count}', { count: reach.moreStates })}` : '')
  return t('Atinge {places}', { places }) + (states ? ` (${states})` : '')
}

// Lista de texto das áreas: é o que o mapa mostra, com riscos e orientações, e serve de alternativa
// para quem não consegue usar o mapa.
export default function AreaList({ areas, onFocus }) {
  useLang()
  if (areas.length === 0) {
    return <p className="arealist__empty">{t('Nenhuma área de aviso neste período.')}</p>
  }
  return (
    <ul className="arealist" aria-label={t('Áreas de aviso por perto')}>
      {areas.map((area, index) => {
        const reach = reachText(area.reach)
        const when = period(area)
        return (
          <li key={areaKey(area, index)} className="arealist__item">
            <button type="button" className="arealist__head" onClick={() => onFocus(areaKey(area, index))} aria-label={t('Mostrar no mapa: aviso {level} {title}', { level: LEVEL_NAME[area.severity] || '', title: translateTitle(area.title) || '' })}>
              <span className={`chip chip--${area.severity === 'desconhecido' ? 'sem' : area.severity}`}>{LEVEL_NAME[area.severity] || 'INMET'}</span>
              <strong>{translateTitle(area.title) || t('Aviso meteorológico')}</strong>
              {area.when && area.when !== 'hoje' && <span className="arealist__tag">{t('Previsto')}</span>}
            </button>
            <p className={`arealist__where${area.inside ? ' arealist__where--in' : ''}`}>
              {area.inside ? t('O seu local está dentro desta área.') : t('O seu local está fora desta área.')}
            </p>
            {when && <p className="arealist__line">{when}</p>}
            {reach && <p className="arealist__line">{reach}</p>}
            {(area.risks || (area.tips && area.tips.length > 0)) && (
              <details className="arealist__more">
                <summary>{t('Riscos e o que fazer')}</summary>
                {area.risks && <p>{translateInmet(area.risks)}</p>}
                {area.tips && area.tips.length > 0 && <ul>{area.tips.map((tip) => <li key={tip}>{translateInmet(tip)}</li>)}</ul>}
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
