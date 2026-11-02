import { useEffect, useRef, useState } from 'react'
import { type CardBrief, type Lang, fetchCardRef, imageUrl, searchCards } from './api'
import type { CardRef } from './db'

const LANG_KEY = 'ohmycard:lang'

function savedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

interface Props {
  /** Texto que indica dónde se va a guardar la próxima carta. */
  targetLabel: string
  onAdd: (card: CardRef) => Promise<void>
  onClose: () => void
}

export default function SearchSheet({ targetLabel, onAdd, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState<Lang>(savedLang)
  const [results, setResults] = useState<CardBrief[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [lang])

  // Búsqueda con espera para no llamar a la API en cada tecla
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setError(null)
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      searchCards(q, lang, ctrl.signal)
        .then(setResults)
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setError('No se pudo buscar. Revisa tu conexión.')
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, lang])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const pick = async (card: CardBrief) => {
    if (adding) return
    setAdding(card.id)
    try {
      await onAdd(await fetchCardRef(card, lang))
      setAdded((n) => n + 1)
      setToast(`${card.name} agregada`)
      clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 1800)
    } catch {
      setError('No se pudo agregar la carta.')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="sheet-screen" role="dialog" aria-label="Buscar carta">
      <header className="search-top">
        <input
          className="search-input"
          type="search"
          inputMode="search"
          autoFocus
          placeholder="Nombre de la carta, ej. Pikachu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="done" onClick={onClose}>
          {added > 0 ? 'Listo' : 'Cerrar'}
        </button>
      </header>

      <div className="search-sub">
        <div className="langs" role="group" aria-label="Idioma de las cartas">
          {(['es', 'en'] as const).map((l) => (
            <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
              {l === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
        <span className="target">{targetLabel}</span>
      </div>

      <div className="results">
        {error && <p className="hint error-text">{error}</p>}
        {!error && results === null && (
          <p className="hint">Escribe al menos 2 letras. Toca una carta para ponerla en el binder; puedes agregar varias seguidas.</p>
        )}
        {!error && loading && results === null && <p className="hint">Buscando…</p>}
        {!error && results?.length === 0 && !loading && (
          <p className="hint">
            No encontré cartas con ese nombre{lang === 'es' ? '. Prueba en English, hay más cartas cargadas.' : '.'}
          </p>
        )}
        {results && results.length > 0 && (
          <div className="result-grid">
            {results.map((c) => (
              <button
                key={c.id}
                className={`result${adding === c.id ? ' adding' : ''}`}
                onClick={() => pick(c)}
                aria-label={`Agregar ${c.name} ${c.localId}`}
              >
                {c.image ? (
                  <img src={imageUrl(c.image, 'low')} alt="" loading="lazy" />
                ) : (
                  <span className="noimg">{c.name}</span>
                )}
                <span className="result-name">
                  {c.name} <small>#{c.localId}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="busy">{toast}</div>}
    </div>
  )
}
