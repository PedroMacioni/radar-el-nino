import { useEffect, useRef, useState } from 'react'
import { LuLoaderCircle, LuLocateFixed, LuSearch } from 'react-icons/lu'
import { getBrowserPosition, isCep, placeLabel, resolveQuery, searchCities } from '../lib/geo.js'

export default function SearchBar({ onSelect }) {
  const [text, setText] = useState('')
  const [options, setOptions] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const skipNext = useRef(false)

  // Sugestões enquanto digita (a partir de 2 letras, com pequena espera).
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false
      return undefined
    }
    const query = text.trim()
    if (query.length < 2 || isCep(query) || /^\d/.test(query)) {
      setSuggestions([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(() => {
      searchCities(query)
        .then((places) => { if (!cancelled) { setSuggestions(places); setHighlight(-1) } })
        .catch(() => { if (!cancelled) setSuggestions([]) })
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [text])

  function choose(place) {
    skipNext.current = true
    setText(placeLabel(place))
    setSuggestions([])
    setOptions([])
    setMessage('')
    onSelect(place)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (highlight >= 0 && suggestions[highlight]) return choose(suggestions[highlight])
    if (!text.trim()) return undefined
    setBusy(true)
    setMessage('')
    setOptions([])
    setSuggestions([])
    try {
      const { places, message: info } = await resolveQuery(text)
      if (places.length === 0) setMessage(info || 'Não encontramos essa cidade. Confira o nome ou digite o CEP.')
      else if (places.length === 1) choose(places[0])
      else setOptions(places)
    } catch {
      setMessage('Não foi possível buscar agora. Verifique a conexão e tente de novo.')
    } finally {
      setBusy(false)
    }
    return undefined
  }

  function handleKeyDown(event) {
    if (!suggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (event.key === 'Escape') {
      setSuggestions([])
    }
  }

  async function handleLocation() {
    setBusy(true)
    setLocating(true)
    setMessage('')
    setOptions([])
    setSuggestions([])
    try {
      const place = await getBrowserPosition()
      skipNext.current = true
      setText(placeLabel(place))
      onSelect(place)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
      setLocating(false)
    }
  }

  const open = suggestions.length > 0
  return (
    <div className="searchbar">
      <div className="container searchbar__inner">
        <form className="searchbar__form" onSubmit={handleSubmit} role="search">
          <label htmlFor="busca" className="sr-only">Cidade ou CEP</label>
          <div className="searchbar__field">
            <LuSearch className="searchbar__icon" size={20} aria-hidden="true" />
            <input
              id="busca"
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder="Cidade ou CEP"
              value={text}
              role="combobox"
              aria-expanded={open}
              aria-controls="busca-lista"
              aria-autocomplete="list"
              aria-activedescendant={highlight >= 0 ? `busca-op-${highlight}` : undefined}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            />
            {open && (
              <ul id="busca-lista" className="suggest" role="listbox">
                {suggestions.map((place, index) => (
                  <li key={place.id} id={`busca-op-${index}`} role="option" aria-selected={index === highlight}
                    className={index === highlight ? 'suggest__item suggest__item--on' : 'suggest__item'}
                    onMouseDown={(event) => { event.preventDefault(); choose(place) }}
                    onMouseEnter={() => setHighlight(index)}>
                    <strong>{place.name}</strong>{place.state && <span>, {place.state}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" disabled={busy}>{busy && !locating ? 'Buscando…' : 'Buscar'}</button>
        </form>
        <button type="button" className="locate" onClick={handleLocation} disabled={busy}>
          {locating ? <LuLoaderCircle className="spin" size={20} aria-hidden="true" /> : <LuLocateFixed size={20} aria-hidden="true" />}
          <span>{locating ? 'Localizando…' : 'Usar minha localização'}</span>
        </button>
      </div>
      <div className="container" aria-live="polite">
        {message && <p className="searchbar__message">{message}</p>}
        {options.length > 0 && (
          <div className="searchbar__options">
            <p>Qual destas?</p>
            <ul>
              {options.map((place) => (
                <li key={place.id}>
                  <button type="button" onClick={() => choose(place)}>{placeLabel(place)}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
