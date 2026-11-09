import { formatDateTime } from '../lib/format.js'
import { LEVEL_NAME, areaKey } from '../lib/map.js'

function period(area) {
  if (area.start && area.end) return `De ${formatDateTime(area.start)} até ${formatDateTime(area.end)}`
  if (area.end) return `Válido até ${formatDateTime(area.end)}`
  return null
}

function reachText(reach) {
  if (!reach || reach.count === 0) return null
  const places = reach.count === 1 ? '1 município' : `${reach.count.toLocaleString('pt-BR')} municípios`
  const states = reach.states.join(', ') + (reach.moreStates ? ` e mais ${reach.moreStates}` : '')
  return `Atinge ${places}${states ? ` (${states})` : ''}`
}

// Lista de texto das áreas: é o que o mapa mostra, com riscos e orientações, e serve de alternativa
// para quem não consegue usar o mapa.
export default function AreaList({ areas, onFocus }) {
  if (areas.length === 0) {
    return <p className="arealist__empty">Nenhuma área de aviso neste período.</p>
  }
  return (
    <ul className="arealist" aria-label="Áreas de aviso por perto">
      {areas.map((area, index) => {
        const reach = reachText(area.reach)
        const when = period(area)
        return (
          <li key={areaKey(area, index)} className="arealist__item">
            <button type="button" className="arealist__head" onClick={() => onFocus(areaKey(area, index))} aria-label={`Mostrar no mapa: aviso ${LEVEL_NAME[area.severity] || ''} ${area.title || ''}`}>
              <span className={`chip chip--${area.severity === 'desconhecido' ? 'sem' : area.severity}`}>{LEVEL_NAME[area.severity] || 'INMET'}</span>
              <strong>{area.title || 'Aviso meteorológico'}</strong>
              {area.when && area.when !== 'hoje' && <span className="arealist__tag">Previsto</span>}
            </button>
            <p className={`arealist__where${area.inside ? ' arealist__where--in' : ''}`}>
              {area.inside ? 'O seu local está dentro desta área.' : 'O seu local está fora desta área.'}
            </p>
            {when && <p className="arealist__line">{when}</p>}
            {reach && <p className="arealist__line">{reach}</p>}
            {(area.risks || (area.tips && area.tips.length > 0)) && (
              <details className="arealist__more">
                <summary>Riscos e o que fazer</summary>
                {area.risks && <p>{area.risks}</p>}
                {area.tips && area.tips.length > 0 && <ul>{area.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
