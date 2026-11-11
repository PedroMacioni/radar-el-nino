import { useEffect, useState } from 'react'
import { LuCloudOff, LuExternalLink, LuInfo, LuLoaderCircle, LuMessageSquareText, LuPhoneCall, LuTriangleAlert } from 'react-icons/lu'
import { LEVELS } from '../lib/levels.js'
import { formatDateTime, formatSavedAt } from '../lib/format.js'
import { t, useLang } from '../lib/i18n.js'
import { translateInmet, translateTitle } from '../lib/inmet.js'

const INMET_PORTAL = 'https://avisos.inmet.gov.br'

function Stale({ savedAt }) {
  if (!savedAt) return null
  return <p className="stale">{t('Sem conexão: aviso salvo em {date}. Pode ter mudado, confira no portal do INMET.', { date: formatSavedAt(savedAt) })}</p>
}

function Band({ tone, Icon = LuInfo, spin = false, kicker, title, text, footer, savedAt }) {
  // Icon={null}: faixa sem ícone (usada quando não há aviso).
  return (
    <section className={`alertband alertband--${tone}${Icon ? '' : ' alertband--noicon'}`} aria-label={t('Aviso oficial')}>
      <div className="container alertband__inner">
        {Icon && <div className="alertband__shape" aria-hidden="true"><Icon className={spin ? 'spin' : undefined} size={22} strokeWidth={2.2} /></div>}
        <div className="alertband__text">
          <p className="alertband__kicker">{kicker}</p>
          <p className="alertband__title">{title}</p>
          {text && <p className="alertband__desc">{text}</p>}
          <Stale savedAt={savedAt} />
        </div>
        <div className="alertband__side">{footer}</div>
      </div>
    </section>
  )
}

// Textos em português; a tradução é feita na hora de desenhar.
const TONES = {
  vermelho: {
    kicker: 'Alerta vermelho · grande perigo',
    todo: ['Vá para um local seguro e alto.', 'Afaste-se de rios, encostas e fios caídos.', 'Siga as orientações da Defesa Civil.'],
  },
  amarelo: {
    kicker: 'Aviso amarelo · atenção',
    todo: ['Acompanhe a previsão e os avisos.', 'Em risco imediato, ligue 199.'],
  },
  laranja: {
    kicker: 'Aviso laranja · perigo',
    todo: ['Evite áreas de alagamento e encostas.', 'Acompanhe os avisos e deixe o 199 à mão.'],
  },
}

function EmergencyBand({ warning, others, tone, savedAt }) {
  const end = warning.end ? formatDateTime(warning.end) : ''
  const cfg = TONES[tone]
  const watch = tone === 'amarelo'
  const desc = translateInmet(warning.details) || (watch ? t('Fique atento e acompanhe a evolução do tempo.') : '')
  return (
    <section className={`emerg emerg--${tone}`} aria-label={tone === 'vermelho' ? t('Alerta de emergência') : watch ? t('Aviso de atenção') : t('Aviso de perigo')} role={watch ? 'region' : 'alert'}>
      <div className="container emerg__inner">
        <div className="emerg__main">
          <p className="emerg__kicker"><span className="emerg__icon" aria-hidden="true"><LuTriangleAlert size={18} strokeWidth={2.4} /></span> {t(cfg.kicker)}</p>
          <h2 className="emerg__title">{translateTitle(warning.title) || t('Aviso meteorológico para o seu município')}</h2>
          {desc && <p className="emerg__desc">{desc}</p>}
          <Stale savedAt={savedAt} />
          <p className="emerg__meta mono">
            {end && <span>{t('Válido até {date}', { date: end })}</span>}
            {others > 0 && <span>+ {others} {others === 1 ? t('outro aviso') : t('outros avisos')}</span>}
            {!watch && <a href={INMET_PORTAL} target="_blank" rel="noreferrer">{t('Aviso oficial')}</a>}
          </p>
          <div className="emerg__actions">
            {watch ? (
              <a className="emerg__btn emerg__btn--main" href={INMET_PORTAL} target="_blank" rel="noreferrer"><LuExternalLink size={20} aria-hidden="true" /> {t('Ver aviso oficial')}</a>
            ) : (
              <>
                <a className="emerg__btn emerg__btn--main" href="tel:199"><LuPhoneCall size={22} aria-hidden="true" /> {t('Ligar 199')}</a>
                <a className="emerg__btn" href="sms:40199"><LuMessageSquareText size={22} aria-hidden="true" /> SMS 40199</a>
              </>
            )}
          </div>
        </div>
        <div className="emerg__todo">
          <p>{watch ? t('Fique atento') : t('O que fazer agora')}</p>
          <ol>{cfg.todo.map((item) => <li key={item}>{t(item)}</li>)}</ol>
        </div>
      </div>
    </section>
  )
}

// Barra fixa no rodapé do celular, para ligar sem precisar rolar a página.
// Só aparece depois que a testeira sai da tela, para não repetir os botões.
export function EmergencyDock() {
  useLang()
  const [show, setShow] = useState(false)
  useEffect(() => {
    const band = document.querySelector('.emerg')
    if (!band || typeof IntersectionObserver === 'undefined') {
      setShow(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting))
    observer.observe(band)
    return () => observer.disconnect()
  }, [])
  return (
    <div className={show ? 'dock' : 'dock dock--hidden'}>
      <a className="dock__btn dock__btn--main" href="tel:199"><LuPhoneCall size={20} aria-hidden="true" /> {t('Ligar 199')}</a>
      <a className="dock__btn" href="sms:40199"><LuMessageSquareText size={20} aria-hidden="true" /> SMS 40199</a>
    </div>
  )
}

export function isEmergency(state) {
  return (state.status === 'ok' || state.status === 'cached') && (state.warnings || []).some((w) => w.severity === 'vermelho')
}

export default function AlertBand({ state }) {
  useLang()
  if (state.status === 'loading') {
    return <Band tone="neutral" Icon={LuLoaderCircle} spin kicker="INMET" title={t('Consultando os avisos…')} />
  }
  if (state.status === 'error') {
    return (
      <Band
        tone="neutral"
        Icon={LuCloudOff}
        kicker={t('Avisos do INMET')}
        title={t('Não foi possível consultar os avisos agora')}
        text={t('Confira no portal oficial antes de tomar qualquer decisão.')}
        footer={<a href={INMET_PORTAL} target="_blank" rel="noreferrer">{t('Abrir avisos.inmet.gov.br')}</a>}
      />
    )
  }
  const warnings = state.warnings || []
  if (warnings.length === 0) {
    return (
      <Band
        tone="sem"
        Icon={null}
        kicker={t('Avisos do INMET')}
        title={t('Sem aviso para este local agora')}
        text={t('Isso vale para os avisos já publicados. Em risco imediato, ligue 199.')}
        footer={<a href={INMET_PORTAL} target="_blank" rel="noreferrer">{t('Ver todos os avisos')}</a>}
      />
    )
  }
  const main = warnings[0]
  if (main.severity === 'vermelho' || main.severity === 'laranja' || main.severity === 'amarelo') {
    return <EmergencyBand warning={main} others={warnings.length - 1} tone={main.severity} savedAt={state.savedAt} />
  }
  const known = main.severity !== 'desconhecido'
  const tone = known ? main.severity : 'neutral'
  const kicker = known ? t('Aviso {level} · INMET', { level: LEVELS[main.severity].label.toLowerCase() }) : t('Aviso do INMET')
  const title = translateTitle(main.title) || t('Aviso meteorológico para o seu município')
  const text = translateInmet(main.details) || (known ? main.severity === 'amarelo' ? t('Fique atento e acompanhe a evolução do tempo.') : LEVELS[main.severity].meaning && t('Nível: {level}.', { level: LEVELS[main.severity].meaning }) : t('Veja o nível e os detalhes no portal do INMET.'))
  const end = main.end ? formatDateTime(main.end) : ''
  return (
    <Band
      tone={tone}
      Icon={LuInfo}
      kicker={kicker}
      title={title}
      text={text}
      savedAt={state.savedAt}
      footer={
        <>
          {end && <span className="mono">{t('Válido até {date}', { date: end })}</span>}
          {warnings.length > 1 && <span>+ {warnings.length - 1} {warnings.length - 1 === 1 ? t('outro aviso') : t('outros avisos')}</span>}
          <a href={INMET_PORTAL} target="_blank" rel="noreferrer">{t('Ver detalhes do aviso')}</a>
        </>
      }
    />
  )
}
