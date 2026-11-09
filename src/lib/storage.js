// Guarda a última cidade e a última previsão, para funcionar com sinal fraco.
// O armazenamento pode estar bloqueado, por isso tudo fica dentro de try/catch.
const PLACE_KEY = 'elnino:place'
const DATA_KEY = 'elnino:data'
const ALERTS_KEY = 'elnino:alerts'

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sem espaço ou bloqueado: seguimos sem salvar
  }
}

export const loadPlace = () => read(PLACE_KEY)
export const savePlace = (place) => write(PLACE_KEY, place)

export function loadCachedData(place) {
  const cached = read(DATA_KEY)
  return cached && cached.lat === place.lat && cached.lon === place.lon ? cached : null
}

export function saveCachedData(place, forecast, air) {
  write(DATA_KEY, { lat: place.lat, lon: place.lon, savedAt: new Date().toISOString(), forecast, air })
}

// Último aviso consultado, para mostrar sem sinal (sempre com a data em que foi salvo).
export function loadCachedAlerts(place) {
  const cached = read(ALERTS_KEY)
  return cached && cached.lat === place.lat && cached.lon === place.lon ? cached : null
}

export function saveCachedAlerts(place, warnings) {
  write(ALERTS_KEY, { lat: place.lat, lon: place.lon, savedAt: new Date().toISOString(), warnings })
}
