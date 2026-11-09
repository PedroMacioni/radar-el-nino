import { LuArrowUp, LuHeart } from 'react-icons/lu'

const EMERGENCY = [
  { number: '199', name: 'Defesa Civil' },
  { number: '193', name: 'Bombeiros' },
  { number: '192', name: 'SAMU' },
  { number: '190', name: 'Polícia' },
]

// Cada fonte, o que ela fornece e onde conferir.
const SOURCES = [
  { name: 'INMET', what: 'Avisos oficiais de tempo severo', href: 'https://avisos.inmet.gov.br' },
  { name: 'Open-Meteo', what: 'Previsão, qualidade do ar, vazão dos rios e histórico de chuva', href: 'https://open-meteo.com' },
  { name: 'INPE', what: 'Focos de calor (queimadas)', href: 'https://terrabrasilis.dpi.inpe.br/queimadas/portal/' },
  { name: 'ONS', what: 'Volume dos reservatórios das hidrelétricas', href: 'https://www.ons.org.br' },
  { name: 'NOAA', what: 'Situação do El Niño', href: 'https://www.noaa.gov' },
  { name: 'MDA', what: 'Garantia-Safra', href: 'https://www.gov.br/mda' },
  { name: 'ViaCEP', what: 'Busca por CEP', href: 'https://viacep.com.br' },
  { name: 'BigDataCloud', what: 'Nome da cidade a partir da sua localização', href: 'https://www.bigdatacloud.com' },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <p className="footer__title">Este site não substitui os avisos oficiais.</p>
          <p>Confira sempre nos canais oficiais. Em risco imediato, ligue:</p>
          <ul className="footer__calls">
            {EMERGENCY.map((e) => (
              <li key={e.number}>
                <a href={`tel:${e.number}`} aria-label={`Ligar para ${e.name}, ${e.number}`}>
                  <strong>{e.number}</strong> {e.name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="footer__kicker">De onde vêm os dados</p>
          <ul className="footer__sources">
            {SOURCES.map((s) => (
              <li key={s.name}>
                <a href={s.href} target="_blank" rel="noreferrer">{s.name}</a>
                <span>{s.what}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="footer__kicker">Sem internet e privacidade</p>
          <p className="footer__item"><strong>Sem sinal:</strong> a página abre mesmo offline e mostra a última previsão e o último aviso salvos, sempre com a data.</p>
          <p className="footer__item"><strong>Seus dados:</strong> a cidade ou a localização que você informa é enviada às fontes ao lado só para buscar as informações. O aparelho guarda apenas a última cidade e os últimos dados. Não há conta nem cadastro.</p>
          <p className="footer__item"><strong>Atualização:</strong> cada informação mostra a fonte. Use o botão de atualizar, ao lado do horário, para buscar de novo.</p>
        </div>
      </div>

      <div className="footer__bar">
        <div className="container footer__bar-inner">
          <span>Projeto informativo sobre o El Niño. Os números são de modelos e fontes públicas.</span>
          <span className="footer__links">
            <a className="footer__support" href="/apoie"><LuHeart size={16} aria-hidden="true" /> Apoie o projeto</a>
            <a href="#inicio"><LuArrowUp size={16} aria-hidden="true" /> Voltar ao topo</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
