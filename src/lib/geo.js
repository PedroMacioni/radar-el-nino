const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

const STATE_BY_UF = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}

export function isCep(text) {
  return /^\d{5}-?\d{3}$/.test(text.trim())
}

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export async function searchCities(name, fetchImpl = fetch) {
  const params = new URLSearchParams({ name, count: '8', language: 'pt', countryCode: 'BR' })
  const response = await fetchImpl(`${GEOCODING_URL}?${params}`)
  if (!response.ok) throw new Error(`Busca de cidades respondeu ${response.status}`)
  const data = await response.json()
  return (data.results || []).map((r) => ({
    id: r.id,
    name: r.name,
    state: r.admin1 || '',
    lat: r.latitude,
    lon: r.longitude,
  }))
}

export async function cityFromCep(cep, fetchImpl = fetch) {
  const digits = cep.replace(/\D/g, '')
  const response = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`)
  if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`)
  const data = await response.json()
  if (data.erro) return null
  return { name: data.localidade, uf: data.uf }
}

// Resolve o que a pessoa digitou. Devolve { places } com 0, 1 ou várias opções.
export async function resolveQuery(text, fetchImpl = fetch) {
  const query = text.trim()
  if (!query) return { places: [] }
  if (isCep(query)) {
    const city = await cityFromCep(query, fetchImpl)
    if (!city) return { places: [], message: 'CEP não encontrado.' }
    const found = await searchCities(city.name, fetchImpl)
    const state = STATE_BY_UF[city.uf]
    const match = found.find((p) => state && normalize(p.state) === normalize(state) && normalize(p.name) === normalize(city.name))
    return { places: match ? [match] : found.slice(0, 1) }
  }
  return { places: await searchCities(query, fetchImpl) }
}

export function placeLabel(place) {
  return place.state ? `${place.name}, ${place.state}` : place.name
}

// Descobre cidade e estado a partir das coordenadas (BigDataCloud, sem chave).
// Se falhar, devolve null e o app usa "Minha localização".
export async function reverseGeocode(lat, lon, fetchImpl = fetch) {
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'pt' })
    const response = await fetchImpl(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`)
    if (!response.ok) return null
    const data = await response.json()
    const name = data.city || data.locality
    if (!name) return null
    return { name, state: data.principalSubdivision || '' }
  } catch {
    return null
  }
}

function currentCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este aparelho não oferece localização.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error('Não foi possível obter a sua localização. Digite a cidade ou o CEP.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  })
}

export async function getBrowserPosition() {
  const { lat, lon } = await currentCoords()
  const found = await reverseGeocode(lat, lon)
  return { id: 'gps', name: found?.name || 'Minha localização', state: found?.state || '', lat, lon }
}
