import { useState } from 'react'
import { LuChevronDown, LuDroplets, LuCheck, LuHeartPulse, LuPhoneCall, LuTent, LuTractor, LuWallet, LuWheat } from 'react-icons/lu'
import { t, useLang } from '../lib/i18n.js'

// Textos em português; a tradução é feita na hora de desenhar.
// Números de emergência: um toque para ligar.
const NUMBERS = [
  { number: '199', name: 'Defesa Civil', text: 'Enchente, deslizamento, risco' },
  { number: '193', name: 'Bombeiros', text: 'Resgate e incêndio' },
  { number: '192', name: 'SAMU', text: 'Urgência de saúde' },
  { number: '190', name: 'Polícia Militar', text: 'Segurança' },
]

const TOPICS = [
  {
    title: 'Fiquei sem casa',
    Icon: LuTent,
    summary: 'Se a água ou um deslizamento atingiu a sua moradia.',
    rows: [
      ['Agora', 'Ligue 199 ou procure a Defesa Civil da prefeitura. É ela que abre os abrigos temporários'],
      ['Depois', 'Vá ao CRAS do município com os documentos de todos da família. É a porta de entrada para o Cadastro Único e para programas sociais'],
    ],
  },
  {
    title: 'Saque do FGTS por calamidade',
    Icon: LuWallet,
    summary: 'Para quem mora em área atingida e tem saldo no FGTS.',
    rows: [
      ['Quem pode', 'Trabalhador com saldo que mora em município com emergência ou calamidade reconhecida pelo governo federal'],
      ['Como', 'O pedido é feito pelo app FGTS, depois que o município é reconhecido'],
      ['Valor', 'Tem limite definido em lei. Confira no app ou na Caixa'],
    ],
  },
  {
    title: 'Garantia-Safra',
    Icon: LuWheat,
    summary: 'Paga R$ 1.200 em parcela única ao agricultor familiar que perde a safra por seca ou excesso de chuva.',
    rows: [
      ['Quem pode', 'Quem tem o CAF ativo e atualizado e mora em município que aderiu ao programa'],
      ['Como', 'A inscrição é feita pelo sindicato ou pela entidade que fez o seu CAF. Depois é preciso pagar o boleto de R$ 24 dentro do prazo'],
      ['Prazo', 'Muda por estado e por ano. Pergunte na prefeitura, no sindicato ou na Emater do seu município'],
    ],
  },
  {
    title: 'Proagro (lavoura financiada)',
    Icon: LuTractor,
    summary: 'Cobre perdas de lavouras financiadas com crédito rural, por exemplo por seca ou excesso de chuva.',
    rows: [
      ['Quem pode', 'Quem financiou a lavoura em um banco com crédito rural e contratou o Proagro'],
      ['Como', 'Avise o banco logo que perceber a perda. Os prazos são curtos'],
    ],
  },
  {
    title: 'Água: carro-pipa e cisterna',
    Icon: LuDroplets,
    summary: 'O guia por município (quem pode pedir, o que levar e onde ir) ainda está em preparo.',
    rows: [['Por enquanto', 'Procure a Defesa Civil ou a secretaria de agricultura da sua prefeitura']],
  },
  {
    title: 'Saúde depois da enchente',
    Icon: LuHeartPulse,
    summary: 'Evite andar em água de enchente ou em lama.',
    rows: [
      ['Atenção', 'Febre, dor no corpo (principalmente nas panturrilhas) ou olhos amarelados nos dias seguintes ao contato com a água: procure uma unidade de saúde e conte do contato'],
      ['Urgência', 'Ligue 192 (SAMU)'],
    ],
  },
]

export default function Help() {
  useLang()
  // Depois do toque, o cartão confirma por alguns segundos (no computador o telefone pode não abrir).
  const [calling, setCalling] = useState(null)
  function handleCall(number) {
    setCalling(number)
    setTimeout(() => setCalling((current) => (current === number ? null : current)), 3000)
  }
  return (
    <section id="ajuda" aria-labelledby="t-aj" className="help">
      <h2 id="t-aj" className="section-title">{t('Como pedir ajuda')}</h2>

      <h3 className="help__sub">{t('Em emergência, ligue')}</h3>
      <ul className="numbers">
        {NUMBERS.map((n) => (
          <li key={n.number}>
            <div className={`number${n.number === '199' ? ' number--main' : ''}`}>
              <span className="number__value">{n.number}</span>
              <span className="number__name">{t(n.name)}</span>
              <span className="number__text">{t(n.text)}</span>
              <a className="number__cta" href={`tel:${n.number}`} onClick={() => handleCall(n.number)} aria-label={t('Ligar para {name}, {number}', { name: t(n.name), number: n.number })}>
                {calling === n.number
                  ? <><LuCheck size={18} aria-hidden="true" /> {t('Ligando…')}</>
                  : <><LuPhoneCall size={18} aria-hidden="true" /><span>{t('Ligar')}<span className="number__now"> {t('agora')}</span></span></>}
              </a>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="help__sub">{t('Programas e orientações')}</h3>
      <div className="topics">
        {TOPICS.map(({ title, Icon, summary, rows }) => (
          <details key={title} className="topic">
            <summary className="topic__summary">
              <span className="topic__icon" aria-hidden="true"><Icon size={18} /></span>
              <span className="topic__text">
                <span className="topic__title">{t(title)}</span>
                <span className="topic__hint">{t(summary)}</span>
              </span>
              <LuChevronDown className="topic__chev" size={20} aria-hidden="true" />
            </summary>
            <dl className="dl topic__body">
              {rows.map(([dt, dd]) => <div key={dt}><dt>{t(dt)}</dt><dd>{t(dd)}</dd></div>)}
            </dl>
          </details>
        ))}
      </div>
      <p className="note">{t('As regras mudam por estado, município e ano. Confirme na Defesa Civil ou na prefeitura antes de ir.')}</p>
    </section>
  )
}
