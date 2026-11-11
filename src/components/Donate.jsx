import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { LuCheck, LuCopy, LuHeart, LuShieldCheck } from 'react-icons/lu'
import { APP_NAME } from '../lib/brand.js'
import { DONATION, isDonationConfigured } from '../lib/donation.js'
import { buildPixPayload, normalizeAmount } from '../lib/pix.js'
import { locale, t, useLang } from '../lib/i18n.js'

const PRESETS = [10, 25, 50, 100]

function CopyButton({ text, label, doneLabel }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
    } catch {
      /* sem permissão para copiar: o texto continua visível na tela */
    }
  }
  return (
    <button type="button" className="donate__copy" onClick={copy}>
      {done ? <LuCheck size={18} aria-hidden="true" /> : <LuCopy size={18} aria-hidden="true" />}
      {done ? t(doneLabel) : t(label)}
    </button>
  )
}

function PixCard() {
  useLang()
  const [choice, setChoice] = useState(25) // 10, 25, 50, 100 ou 'custom'
  const [custom, setCustom] = useState('')
  const [qr, setQr] = useState('')

  const amount = choice === 'custom' ? normalizeAmount(custom) : choice
  const payload = useMemo(
    () => buildPixPayload({ key: DONATION.pixKey, name: DONATION.receiverName, city: DONATION.receiverCity, amount }),
    [amount],
  )

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(''))
    return () => { cancelled = true }
  }, [payload])

  const money = (value) => `R$ ${value.toLocaleString(locale(), { minimumFractionDigits: Number.isInteger(value) ? 0 : 2 })}`

  return (
    <div className="donate__card">
      <p className="donate__step">{t('1. Escolha o valor')}</p>
      <div className="donate__amounts" role="group" aria-label={t('Valor da doação')}>
        {PRESETS.map((value) => (
          <button key={value} type="button" aria-pressed={choice === value} onClick={() => setChoice(value)}>{money(value)}</button>
        ))}
        <button type="button" aria-pressed={choice === 'custom'} onClick={() => setChoice('custom')}>{t('Outro valor')}</button>
      </div>
      {choice === 'custom' && (
        <label className="donate__custom">
          <span>{t('Valor em reais (de 1 a 10.000)')}</span>
          <input type="text" inputMode="decimal" autoComplete="off" placeholder={t('Ex.: 35,00')} value={custom} onChange={(event) => setCustom(event.target.value)} />
          {custom && amount == null && <small>{t('Digite um valor entre 1 e 10.000. Sem valor, você escolhe quanto doar no app do banco.')}</small>}
        </label>
      )}

      <p className="donate__step">{t('2. Pague com Pix')}</p>
      <div className="donate__pay">
        <div className="donate__qr">
          {qr ? <img src={qr} width="220" height="220" alt={amount ? t('QR Code Pix de {value}', { value: money(amount) }) : t('QR Code Pix')} /> : <span className="donate__qr-wait">{t('Gerando o QR Code…')}</span>}
        </div>
        <div className="donate__pay-info">
          <p className="donate__how">{t('Abra o app do seu banco, escolha')} <strong>Pix</strong> {t('e leia o QR Code. No computador, use o')} <strong>{t('Pix copia e cola')}</strong>.</p>
          <CopyButton text={payload} label="Copiar código Pix (copia e cola)" doneLabel="Código copiado" />
          <dl className="donate__who">
            <div><dt>{t('Recebedor')}</dt><dd>{DONATION.receiverName}</dd></div>
            <div><dt>{t('Valor')}</dt><dd>{amount ? money(amount) : t('Você escolhe no app do banco')}</dd></div>
          </dl>
          <p className="donate__key-label">{t('Prefere digitar a chave Pix?')}</p>
          <div className="donate__key">
            <code>{DONATION.pixKey}</code>
            <CopyButton text={DONATION.pixKey} label="Copiar chave" doneLabel="Chave copiada" />
          </div>
        </div>
      </div>
      <p className="donate__thanks">{t('Qualquer valor ajuda. Muito obrigado por apoiar!')} 💙</p>
    </div>
  )
}

export default function Donate() {
  const lang = useLang()
  useEffect(() => {
    const previous = document.title
    document.title = `${t('Apoie')} · ${APP_NAME}`
    return () => { document.title = previous }
  }, [lang])

  const configured = isDonationConfigured()
  return (
    <main className="donate" id="inicio">
      <div className="donate__inner">
        <span className="donate__icon" aria-hidden="true"><LuHeart size={36} strokeWidth={1.8} /></span>
        <h1>{t('Apoie o {name}', { name: APP_NAME })}</h1>
        <p className="donate__lead">{t('Obrigado por pensar em ajudar! O app é gratuito e sempre vai ser.')} {t(DONATION.purpose)}</p>

        {configured ? (
          <PixCard />
        ) : (
          <div className="donate__soon">
            <strong>{t('Já já você poderá apoiar por aqui')}</strong>
            <span>{t('Estamos preparando o recebimento por Pix com todo o cuidado. Muito obrigado pelo carinho: volte em alguns dias!')}</span>
            {import.meta.env.DEV && (
              <small>
                Para ativar (só aparece em desenvolvimento): crie o arquivo <code>.env.local</code> com
                <code>VITE_PIX_KEY</code>, <code>VITE_PIX_NAME</code> e <code>VITE_PIX_CITY</code>. Veja <code>.env.example</code>.
              </small>
            )}
          </div>
        )}

        <p className="donate__safe-title">{t('Para doar com tranquilidade')}</p>
        <ul className="donate__safe">
          <li><LuShieldCheck size={20} aria-hidden="true" /><span>{t('Antes de confirmar, confira o')} <strong>{t('nome do recebedor')}</strong> {t('no app do banco.')}</span></li>
          <li><LuShieldCheck size={20} aria-hidden="true" /><span>{t('Nunca doe por links ou pedidos recebidos por mensagem. Só por esta página.')}</span></li>
          <li><LuShieldCheck size={20} aria-hidden="true" /><span>{t('O app nunca cobra para mostrar previsão, avisos ou formas de pedir ajuda.')}</span></li>
        </ul>

        <a className="donate__back" href="/">{t('Voltar ao início')}</a>
      </div>
    </main>
  )
}
