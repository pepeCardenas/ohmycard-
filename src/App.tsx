import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SLOTS_PER_PAGE,
  type BinderMeta,
  deleteSlot,
  loadBinder,
  loadSlots,
  putSlot,
  requestPersistence,
  saveBinder,
  slotKey,
  swapSlots,
} from './db'
import { prepareCardImage } from './image'

const BINDER_ID = 'principal'

type Pending = { page: number; slot: number }

export default function App() {
  const [binder, setBinder] = useState<BinderMeta | null>(null)
  const [blobs, setBlobs] = useState<Map<string, Blob>>(new Map())
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<Pending | null>(null)
  const [moving, setMoving] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const pagerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<Pending | null>(null)

  // Carga inicial
  useEffect(() => {
    requestPersistence()
    Promise.all([loadBinder(BINDER_ID, 'Mi binder'), loadSlots(BINDER_ID)])
      .then(([meta, map]) => {
        setBinder(meta)
        setBlobs(map)
      })
      .catch(() => setError('No se pudo abrir el almacenamiento del navegador.'))
  }, [])

  // URLs para mostrar las imágenes guardadas
  useEffect(() => {
    const next = new Map<string, string>()
    blobs.forEach((b, k) => next.set(k, URL.createObjectURL(b)))
    setUrls(next)
    return () => next.forEach((u) => URL.revokeObjectURL(u))
  }, [blobs])

  const goTo = useCallback((p: number) => {
    const el = pagerRef.current
    if (!el) return
    el.scrollTo({ left: p * el.clientWidth, behavior: 'smooth' })
  }, [])

  const onScroll = () => {
    const el = pagerRef.current
    if (!el) return
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }

  const updateBinder = (meta: BinderMeta) => {
    setBinder(meta)
    saveBinder(meta)
  }

  // --- Subir fotos ---------------------------------------------------------

  const pickFor = (target: Pending) => {
    targetRef.current = target
    fileRef.current?.click()
  }

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const start = targetRef.current
    if (!binder || !start || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const next = new Map(blobs)
      let pageCount = binder.pageCount
      // La primera foto va al casillero tocado; el resto llena los siguientes vacíos.
      let idx = start.page * SLOTS_PER_PAGE + start.slot
      let first = true
      for (const file of files) {
        if (!first) {
          while (next.has(slotKey(BINDER_ID, Math.floor(idx / SLOTS_PER_PAGE), idx % SLOTS_PER_PAGE))) idx++
        }
        const p = Math.floor(idx / SLOTS_PER_PAGE)
        const s = idx % SLOTS_PER_PAGE
        if (p >= pageCount) pageCount = p + 1
        const blob = await prepareCardImage(file)
        const key = slotKey(BINDER_ID, p, s)
        await putSlot(key, blob)
        next.set(key, blob)
        idx++
        first = false
      }
      setBlobs(next)
      if (pageCount !== binder.pageCount) updateBinder({ ...binder, pageCount })
      setViewing(null)
    } catch {
      setError('No se pudo cargar alguna de las fotos. Prueba con JPG o PNG.')
    } finally {
      setBusy(false)
    }
  }

  // --- Acciones sobre un casillero ------------------------------------------

  const onSlotTap = async (p: number, s: number) => {
    const key = slotKey(BINDER_ID, p, s)
    if (moving) {
      const from = slotKey(BINDER_ID, moving.page, moving.slot)
      if (from !== key) {
        const a = blobs.get(from)
        const b = blobs.get(key)
        await swapSlots(from, key, a, b)
        const next = new Map(blobs)
        if (b) next.set(from, b)
        else next.delete(from)
        if (a) next.set(key, a)
        else next.delete(key)
        setBlobs(next)
      }
      setMoving(null)
      return
    }
    setConfirmRemove(false)
    if (blobs.has(key)) setViewing({ page: p, slot: s })
    else pickFor({ page: p, slot: s })
  }

  const removeCard = async (t: Pending) => {
    const key = slotKey(BINDER_ID, t.page, t.slot)
    await deleteSlot(key)
    const next = new Map(blobs)
    next.delete(key)
    setBlobs(next)
    setViewing(null)
    setConfirmRemove(false)
  }

  // --- Páginas --------------------------------------------------------------

  const pageIsEmpty = (p: number) =>
    Array.from({ length: SLOTS_PER_PAGE }, (_, s) => slotKey(BINDER_ID, p, s)).every((k) => !blobs.has(k))

  const addPage = () => {
    if (!binder) return
    updateBinder({ ...binder, pageCount: binder.pageCount + 1 })
    setTimeout(() => goTo(binder.pageCount), 50)
  }

  const removeLastPage = () => {
    if (!binder || binder.pageCount <= 1) return
    updateBinder({ ...binder, pageCount: binder.pageCount - 1 })
    goTo(binder.pageCount - 2)
  }

  if (!binder) {
    return <div className="loading">{error ?? 'Abriendo tu binder…'}</div>
  }

  const filled = blobs.size
  const isLast = page === binder.pageCount - 1
  const viewingUrl = viewing ? urls.get(slotKey(BINDER_ID, viewing.page, viewing.slot)) : undefined

  return (
    <div className="app">
      <header className="top">
        {editingName ? (
          <input
            className="name-input"
            autoFocus
            defaultValue={binder.name}
            maxLength={40}
            onBlur={(e) => {
              const name = e.target.value.trim() || 'Mi binder'
              updateBinder({ ...binder, name })
              setEditingName(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button className="name" onClick={() => setEditingName(true)} title="Cambiar nombre">
            {binder.name}
          </button>
        )}
        <span className="count">
          {filled} {filled === 1 ? 'carta' : 'cartas'}
        </span>
      </header>

      {moving && (
        <div className="banner">
          Toca el casillero de destino
          <button onClick={() => setMoving(null)}>Cancelar</button>
        </div>
      )}
      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="pager" ref={pagerRef} onScroll={onScroll}>
        {Array.from({ length: binder.pageCount }, (_, p) => (
          <section className="page" key={p} aria-label={`Página ${p + 1}`}>
            <div className="sheet">
              {Array.from({ length: SLOTS_PER_PAGE }, (_, s) => {
                const key = slotKey(BINDER_ID, p, s)
                const url = urls.get(key)
                const isSource = moving?.page === p && moving.slot === s
                return (
                  <button
                    key={s}
                    className={`slot${url ? ' filled' : ''}${isSource ? ' source' : ''}${moving ? ' target' : ''}`}
                    onClick={() => onSlotTap(p, s)}
                    aria-label={url ? `Carta en casillero ${s + 1}` : `Agregar carta en casillero ${s + 1}`}
                  >
                    {url ? <img src={url} alt="" draggable={false} /> : <span className="plus">+</span>}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <footer className="bottom">
        <button className="nav" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="Página anterior">
          ‹
        </button>
        <div className="pageinfo">
          <span>
            Página {page + 1} de {binder.pageCount}
          </span>
          {isLast && binder.pageCount > 1 && pageIsEmpty(page) ? (
            <button className="link" onClick={removeLastPage}>
              Quitar página
            </button>
          ) : (
            <button className="link" onClick={addPage}>
              + Agregar página
            </button>
          )}
        </div>
        <button className="nav" onClick={() => goTo(page + 1)} disabled={isLast} aria-label="Página siguiente">
          ›
        </button>
      </footer>

      {viewing && viewingUrl && (
        <div className="viewer" onClick={() => setViewing(null)}>
          <img src={viewingUrl} alt="Carta" onClick={(e) => e.stopPropagation()} />
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setMoving(viewing)
                setViewing(null)
              }}
            >
              Mover
            </button>
            <button onClick={() => pickFor(viewing)}>Cambiar foto</button>
            <button
              className="danger"
              onClick={() => (confirmRemove ? removeCard(viewing) : setConfirmRemove(true))}
            >
              {confirmRemove ? '¿Seguro? Toca otra vez' : 'Quitar'}
            </button>
            <button onClick={() => setViewing(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {busy && <div className="busy">Guardando…</div>}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
    </div>
  )
}
