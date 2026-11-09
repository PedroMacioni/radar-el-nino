# Radar El Niño

Site de consulta para quem quer ver, em uma tela, a previsão hora a hora, o aviso oficial e como pedir
ajuda na sua cidade durante o El Niño. Feito em React + Vite, **sem banco de dados**.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173 (se estiver ocupada, o terminal mostra a porta usada)
npm test         # testes das funções puras
npm run build    # gera a pasta dist/
npm run preview  # abre a versão publicada localmente (com modo offline)
```

## O que já funciona

- Busca por **cidade** ou **CEP**, com sugestões enquanto digita, e botão "Usar minha localização".
- **Agora**: temperatura, sensação, umidade, vento e chuva das últimas 24 h.
- **Previsão hora a hora** com gráfico interativo, resumo do dia e quadros por período.
- **Avisos do INMET** (amarelo, laranja e vermelho) com visual próprio. O vermelho ativa o **modo de
  emergência**: testeira com 199 e SMS 40199, orientações e barra fixa para ligar no celular.
- **Água, seca, ar e fogo**, em cartões ordenados do mais grave ao menos grave:
  - Rios: previsão de vazão (Open-Meteo/GloFAS). É modelo, não medição de estação.
  - Reservatórios: volume das hidrelétricas da região (ONS), via `/api/reservatorios`.
  - Seca: chuva dos últimos 90 dias contra a média de 9 anos (Open-Meteo/ERA5). Não é o Monitor de Secas oficial.
  - Queimadas: focos de calor do INPE num raio de 50 km, via `/api/queimadas`.
  - Calor e UV, e qualidade do ar, explicados em linguagem comum.
- **Mapa dos avisos** (botão "Ver no mapa" ou atalho "Mapa" no menu; só carrega ao clicar): as áreas de aviso do
  INMET (cor e traço por nível), a chuva prevista nas próximas 24 h (mapa de calor, Open-Meteo), o seu local e
  os focos de calor do INPE. Cobre uma região de uns 550 km ao redor (avisos), 250 km (focos) e uns 265 km
  (grade de chuva). Uma frase diz se você está dentro de uma área de aviso, três números resumem
  avisos, chuva e focos, e uma lista ao lado traz, para cada aviso, os riscos, o que fazer e quantos municípios
  atinge. Tocar no mapa mostra o que há naquele ponto (aviso, foco de calor ou chuva) e não abre nada se não houver. Dá para dar zoom com a roda do mouse com o cursor sobre o mapa. Sem avisos, o mapa ocupa a
  largura toda. No modo de emergência fica dentro de "Mais informações", abaixo dos botões de socorro.
  Dados em `/api/mapa`.
- **Atualiza sozinho** a cada 5 minutos, ao voltar para a aba e quando a internet volta, e avisa quando
  surge um aviso novo.
- **Modo offline (PWA)**: a página abre sem internet e mostra a última previsão e o último aviso salvos,
  sempre com a data. Também pode ser instalada no celular.
- **Como pedir ajuda**: números de emergência (199, 193, 192, 190) e orientações (abrigo, FGTS, Garantia-Safra,
  Proagro, carro-pipa, saúde depois da enchente).
- **Tela 404** e **tela de doação** (`/apoie`, veja abaixo).

## Telas de teste

Abrem a página com dados simulados (nada é real):

- `/teste` ou `/teste/vermelho`: aviso vermelho, modo de emergência.
- `/teste/laranja` e `/teste/amarelo`: os outros níveis.
- `/teste/extremo`: cenário extremo, com o cartão "Mais informações" e o mapa já abertos (7 avisos de vários
  níveis, chuva forte e muitos focos de calor).

Qualquer outro endereço desconhecido mostra a tela 404. Em produção, o `vercel.json` manda todos os
endereços (menos `/api/...`) para o app. Em outra hospedagem, configure o mesmo redirecionamento.

## Doação por Pix (`/apoie`)

A tela gera o QR Code e o "Pix copia e cola" no navegador (código em `src/lib/pix.js`). A chave não fica
no código: copie `.env.example` para `.env.local` e preencha.

```bash
VITE_PIX_KEY=       # chave Pix que recebe
VITE_PIX_NAME=      # nome do recebedor (até 25 letras, sem acento)
VITE_PIX_CITY=      # cidade do recebedor (até 15 letras)
```

Em produção, configure as mesmas variáveis no painel da hospedagem e publique de novo. Sem as três, a
tela mostra "Doações em breve". Os links de apoio **somem no modo de emergência**.
Antes de divulgar, **teste um Pix de valor baixo** e confira o nome do recebedor que aparece no banco.

## Fundo do mapa

O mapa usa o Leaflet com o fundo do OpenStreetMap por padrão. **O servidor de imagens gratuito do OpenStreetMap
tem regras de uso** (uso leve, com crédito visível): serve para começar, mas com muito acesso ou uso comercial
troque por um provedor próprio. Para trocar, defina no `.env.local` (ou no painel da hospedagem):

```bash
VITE_MAP_TILES_URL=https://seu-provedor/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=© Provedor, © OpenStreetMap
```

Sem internet o mapa não funciona: aparece o aviso de que ele precisa de conexão, e o resto da página continua.

## O que ainda não está integrado

- Reservatório da sua cidade (hoje é o volume da região inteira) e Monitor de Secas oficial.
- Guia de carro-pipa e cisterna por município.
- Aviso com o app fechado (notificação push).
- Chuva em tempo real no mapa (não achei fonte aberta e confiável de radar) e abrigos (não há base nacional aberta).

## Pontos de atenção

1. **Avisos do INMET.** A rota `/api/alertas` consulta `https://apiprevmet3.inmet.gov.br/avisos/ativos`.
   Esse endpoint não tem documentação pública que eu tenha conseguido confirmar. Na consulta que fiz,
   cada aviso trazia `poligono`, `municipios`, datas e horas, mas **não encontrei os campos de severidade
   e de descrição**. O código procura o nível em `severidade`, `nivel` e `cor`. Se não achar, mostra
   "Aviso do INMET" em cinza e manda a pessoa ao portal oficial. **Rode `npm run dev`, abra
   `/api/alertas?lat=-22.9&lon=-47.06` e confira o JSON real**; depois ajuste `severityFromRaw` e
   `normalizeWarning` em `server/alerts.js`.
2. As rotas `/api/alertas`, `/api/queimadas`, `/api/reservatorios` e `/api/mapa` existem como funções serverless (pasta
   `api/`, formato da Vercel) e no servidor de desenvolvimento. Em hospedagem só estática (GitHub Pages)
   elas não existem: a faixa de aviso mostra o link do portal do INMET e os cartões de queimadas e
   reservatórios mostram "Sem dado agora".
3. Os níveis de UV e de qualidade do ar usam as faixas da OMS e do índice europeu. A qualidade do ar do
   Open-Meteo é modelada, não medida em estação.
4. **Uso comercial.** A API gratuita da Open-Meteo, pelo que sei, é só para uso não comercial. Se o site
   passar a ter patrocínio ou cobrança, confira os termos atuais e o plano comercial. Veja também as regras
   de uso e atribuição das outras fontes (INMET, INPE, ONS).
5. Este site **não substitui os avisos oficiais**; o texto no rodapé e na faixa de aviso diz isso.
6. Os textos de ajuda (FGTS, Proagro, saúde) são gerais e sem valores nem prazos. Vale uma pessoa da área
   revisar antes de divulgar.

## Estrutura

```
api/                  funções serverless (alertas, queimadas, reservatórios, mapa)
server/               lógica dos dados (avisos, focos do INPE, reservatórios do ONS, áreas do mapa)
src/lib/              busca, previsão, gráfico, níveis, rotas, Pix, armazenamento
src/components/       telas
public/               ícones do app instalado
vercel.json           redirecionamento de todos os endereços para o app
tests/                testes (node --test)
```
