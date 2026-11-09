import { useState } from 'react'
import { FaWhatsapp } from 'react-icons/fa6'
import { LuCheck, LuCopy, LuInfo, LuMessageSquareText, LuPhoneCall } from 'react-icons/lu'

const CHANNELS = [
  {
    key: 'sms', Icon: LuMessageSquareText, name: 'SMS', value: '40199', copy: '40199',
    text: 'Envie o seu CEP. É grátis.',
    action: 'Enviar SMS', href: 'sms:40199', tag: 'Funciona sem internet',
  },
  {
    key: 'whatsapp', Icon: FaWhatsapp, name: 'WhatsApp', value: '(61) 2034-4611', copy: '6120344611',
    text: 'Mande uma mensagem e receba os avisos do seu CEP.',
    action: 'Abrir WhatsApp', href: 'https://wa.me/556120344611', tag: 'Precisa de internet',
  },
  {
    key: 'call', Icon: LuPhoneCall, name: 'Ligação · Defesa Civil', value: '199', copy: '199',
    text: 'Pedir socorro ou informar risco.',
    action: 'Ligar para 199', href: 'tel:199', tag: 'Emergência',
  },
]

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    } catch {
      /* sem permissão para copiar: o número continua visível na tela */
    }
  }
  return (
    <button type="button" className="channel__copy" onClick={copy} aria-label={done ? 'Número copiado' : `Copiar ${label}`} title={done ? 'Copiado!' : 'Copiar número'}>
      {done ? <LuCheck size={20} aria-hidden="true" /> : <LuCopy size={20} aria-hidden="true" />}
    </button>
  )
}

export default function SideInfo({ compact = false }) {
  return (
    <aside className="side">
      <section className="panel" id="offline" aria-labelledby="t-off">
        <h2 id="t-off">Sem internet ou sem sinal</h2>
        <p className="muted small">Escolha um canal. Os avisos chegam pelo seu CEP.</p>
        <ul className="channels">
          {CHANNELS.map((c) => (
            <li key={c.key} className={`channel channel--${c.key}`}>
              <div className="channel__head">
                <span className="channel__icon" aria-hidden="true"><c.Icon size={18} /></span>
                <span className="channel__name">{c.name}</span>
              </div>
              <div className="channel__value mono">{c.value}</div>
              <p className="channel__text">{c.text} <span className="channel__tag">{c.tag}.</span></p>
              <div className="channel__actions">
                <a className="channel__go" href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{c.action}</a>
                <CopyButton value={c.copy} label={`número do ${c.name}`} />
              </div>
            </li>
          ))}
        </ul>
        <p className="callout">
          <LuInfo size={20} aria-hidden="true" />
          <span>O aviso por celular (Cell Broadcast) só chega em aparelhos 4G/5G. O SMS funciona em qualquer rede.</span>
        </p>
      </section>
      {!compact && (
      <section className="panel" aria-labelledby="t-enso">
        <h2 id="t-enso">O El Niño agora</h2>
        <p className="muted small">Declarado ativo pela NOAA em 11/06/2026</p>
        <dl className="dl">
          <div><dt>Pico</dt><dd>Entre a primavera e o início do verão</dd></div>
          <div><dt>Até quando</dt><dd>Pelo menos o início de 2027</dd></div>
        </dl>
      </section>
      )}
    </aside>
  )
}
