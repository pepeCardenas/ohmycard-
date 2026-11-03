'use client'

import { useEffect, useState } from 'react'
import { type CardBrief, type LangChoice, LANGS, fetchCardRef, imageUrl, isLang, searchCards } from './api'
import type { CardRef } from './store'

const LANG_KEY = 'ohmycard:lang'

function savedLang(): LangChoice {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'any' || isLang(v) ? v : 'es'
  } catch {
    return 'es'
  }
}

const langLabel = (code: string) => LANGS.find((l) => l.code === code)?.label ?? code

interface Props {
  /** Texto que indica dónde se va a guardar la próxima carta. */
  targetLabel: string
  /** Una carta por vez: al tocarla se agrega y se cierra la búsqueda. */
  onAdd?: (card: CardRef) => Promise<void>
  /** Varias cartas: se tocan para marcarlas y se agregan todas juntas. */
  onAddMany?: (cards: CardRef[]) => Promise<void>
  onClose: () => void
}

const keyOf = (c: CardBrief) => `${c.lang}:${c.id}`

export default function SearchSheet({ targetLabel, onAdd, onAddMany, onClose }: Props) {
  const multiple = !!onAddMany
  const [selected, setSelected] = useState<Map<string, CardBrief>>(new Map())
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState<LangChoice>(savedLang)
  const [results, setResults] = useState<CardBrief[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

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

  const toggle = (card: CardBrief) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(keyOf(card))) next.delete(keyOf(card))
      else next.set(keyOf(card), card)
      return next
    })
  }

  const addSelected = async () => {
    if (!onAddMany || selected.size === 0 || saving) return
    setSaving(true)
    setError(null)
    try {
      await onAddMany(await Promise.all([...selected.values()].map(fetchCardRef)))
    } catch {
      setError('No se pudieron agregar las cartas.')
      setSaving(false)
    }
  }

  const pick = async (card: CardBrief) => {
    if (multiple) return toggle(card)
    if (adding || !onAdd) return
    setAdding(`${card.lang}:${card.id}`)
    try {
      // Al agregarla, el binder cierra la búsqueda y vuelve a la página de la carta.
      await onAdd(await fetchCardRef(card))
    } catch {
      setError('No se pudo agregar la carta.')
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
          Cerrar
        </button>
      </header>

      <div className="search-sub">
        <select
          className="lang-select"
          aria-label="Idioma de las cartas"
          value={lang}
          onChange={(e) => setLang(e.target.value as LangChoice)}
        >
          <option value="any">🌐 Cualquier idioma</option>
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="target">{targetLabel}</span>
      </div>

      <div className="results">
        {error && <p className="hint error-text">{error}</p>}
        {!error && results === null && (
          <p className="hint">
            {multiple
              ? 'Escribe al menos 2 letras. Toca todas las cartas que quieras y después "Agregar".'
              : 'Escribe al menos 2 letras. Toca una carta para ponerla en el binder.'}
          </p>
        )}
        {!error && loading && results === null && <p className="hint">Buscando…</p>}
        {!error && results?.length === 0 && !loading && (
          <p className="hint">
            No encontré cartas con ese nombre
            {lang === 'any' ? '. Revisa cómo está escrito.' : '. Prueba con "Cualquier idioma".'}
          </p>
        )}
        {results && results.length > 0 && (
          <div className="result-grid">
            {results.map((c) => (
              <button
                key={`${c.lang}:${c.id}`}
                className={`result${adding === keyOf(c) ? ' adding' : ''}${selected.has(keyOf(c)) ? ' selected' : ''}`}
                onClick={() => pick(c)}
                aria-label={`${multiple ? 'Elegir' : 'Agregar'} ${c.name} ${c.localId}`}
                aria-pressed={multiple ? selected.has(keyOf(c)) : undefined}
              >
                {selected.has(keyOf(c)) && (
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>
                )}
                {c.image ? (
                  <img src={imageUrl(c.image, 'low')} alt="" loading="lazy" />
                ) : (
                  <span className="noimg">{c.name}</span>
                )}
                <span className="result-name">
                  {c.name} <small>#{c.localId}</small>
                </span>
                {lang === 'any' && (
                  <span className="lang-badge" title={langLabel(c.lang)}>
                    {c.lang.toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {multiple && selected.size > 0 && (
        <div className="select-bar">
          <button className="link" onClick={() => setSelected(new Map())} disabled={saving}>
            Desmarcar
          </button>
          <button className="primary" onClick={addSelected} disabled={saving}>
            {saving ? 'Agregando…' : `Agregar ${selected.size} ${selected.size === 1 ? 'carta' : 'cartas'}`}
          </button>
        </div>
      )}
    </div>
  )
}
