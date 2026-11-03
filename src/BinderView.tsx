'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { imageUrl } from './api'
import {
  SLOTS_PER_PAGE,
  type BinderMeta,
  type CardRef,
  type SlotItem,
  deleteSlot,
  isCard,
  loadSlots,
  putSlot,
  slotKey,
  swapSlots,
  uploadPhoto,
} from './store'
import { prepareCardImage } from './image'
import CardDetailView from './CardDetailView'
import SearchSheet from './SearchSheet'
import { type ShareSlot, downloadImage, renderPage, shareImage } from './share'

type Pos = { page: number; slot: number }

interface Props {
  binder: BinderMeta
  onChange: (meta: BinderMeta) => void
  onOpenList: () => void
}

const toIndex = (p: Pos) => p.page * SLOTS_PER_PAGE + p.slot
const toPos = (i: number): Pos => ({ page: Math.floor(i / SLOTS_PER_PAGE), slot: i % SLOTS_PER_PAGE })

export default function BinderView({ binder, onChange, onOpenList }: Props) {
  const id = binder.id
  const [items, setItems] = useState<Map<string, SlotItem>>(new Map())
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<Pos | null>(null)
  const [moving, setMoving] = useState<Pos | null>(null)
  const [choosing, setChoosing] = useState<Pos | null>(null)
  const [searchTarget, setSearchTarget] = useState<Pos | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [shareImg, setShareImg] = useState<{ blob: Blob; url: string; page: number } | null>(null)
  const [sharing, setSharing] = useState(false)

  const pagerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoTarget = useRef<Pos | null>(null)
  // Copias actualizadas para usar dentro de callbacks asíncronos
  const itemsRef = useRef(items)
  itemsRef.current = items
  const binderRef = useRef(binder)
  binderRef.current = binder

  useEffect(() => {
    loadSlots(id)
      .then((m) => {
        setItems(m)
        setLoaded(true)
      })
      .catch(() => setError('No se pudo cargar el binder. Revisa tu conexión.'))
  }, [id])

  const srcFor = (key: string, quality: 'low' | 'high'): string | undefined => {
    const item = items.get(key)
    if (isCard(item)) return item.image ? imageUrl(item.image, quality) : undefined
    return item?.url
  }

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

  /** Siguiente casillero vacío a partir de `from` (incluido). */
  const nextEmpty = (from: number, map: Map<string, SlotItem>) => {
    let i = from
    while (map.has(slotKey(id, toPos(i).page, toPos(i).slot))) i++
    return i
  }

  /** Guarda un elemento en un casillero, agregando páginas si hace falta. */
  const place = async (pos: Pos, item: SlotItem, map: Map<string, SlotItem>) => {
    await putSlot(id, pos.page, pos.slot, item)
    map.set(slotKey(id, pos.page, pos.slot), item)
    const b = binderRef.current
    if (pos.page >= b.pageCount) onChange({ ...b, pageCount: pos.page + 1 })
  }

  // --- Subir fotos ---------------------------------------------------------

  const pickPhoto = (target: Pos) => {
    photoTarget.current = target
    fileRef.current?.click()
  }

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const start = photoTarget.current
    if (!start || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const next = new Map(items)
      // La primera foto va al casillero elegido; el resto llena los siguientes vacíos.
      let idx = toIndex(start)
      for (const [n, file] of files.entries()) {
        if (n > 0) idx = nextEmpty(idx, next)
        await place(toPos(idx), await uploadPhoto(await prepareCardImage(file)), next)
        idx++
      }
      setItems(next)
      setViewing(null)
    } catch {
      setError('No se pudo cargar alguna de las fotos. Prueba con JPG o PNG.')
    } finally {
      setBusy(false)
    }
  }

  // --- Agregar cartas oficiales ---------------------------------------------

  const addCard = async (card: CardRef) => {
    const target = searchTarget
    if (!target) return
    const next = new Map(itemsRef.current)
    await place(target, card, next)
    setItems(next)
    setSearchTarget(null)
    setTimeout(() => goTo(target.page), 50)
  }

  // --- Acciones sobre un casillero ------------------------------------------

  const onSlotTap = async (p: number, s: number) => {
    const key = slotKey(id, p, s)
    setConfirmRemove(false)
    if (moving) {
      const from = slotKey(id, moving.page, moving.slot)
      if (from !== key) {
        const a = items.get(from)
        const b = items.get(key)
        try {
          await swapSlots(id, moving, { page: p, slot: s })
        } catch {
          setError('No se pudo mover la carta.')
          setMoving(null)
          return
        }
        const next = new Map(items)
        if (b) next.set(from, b)
        else next.delete(from)
        if (a) next.set(key, a)
        else next.delete(key)
        setItems(next)
      }
      setMoving(null)
      return
    }
    if (items.has(key)) setViewing({ page: p, slot: s })
    else setChoosing({ page: p, slot: s })
  }

  const removeItem = async (t: Pos) => {
    const key = slotKey(id, t.page, t.slot)
    try {
      await deleteSlot(id, t.page, t.slot)
    } catch {
      setError('No se pudo quitar la carta.')
      return
    }
    const next = new Map(items)
    next.delete(key)
    setItems(next)
    setViewing(null)
    setConfirmRemove(false)
  }

  // --- Páginas --------------------------------------------------------------

  const pageIsEmpty = (p: number) =>
    Array.from({ length: SLOTS_PER_PAGE }, (_, s) => slotKey(id, p, s)).every((k) => !items.has(k))

  const addPage = () => {
    onChange({ ...binder, pageCount: binder.pageCount + 1 })
    setTimeout(() => goTo(binder.pageCount), 50)
  }

  const removeLastPage = () => {
    if (binder.pageCount <= 1) return
    onChange({ ...binder, pageCount: binder.pageCount - 1 })
    goTo(binder.pageCount - 2)
  }

  // --- Compartir la página actual como imagen ---------------------------------

  const sharePageFile = (p: number) => `${binder.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-pagina-${p + 1}.png`

  const openShare = async () => {
    const p = page
    setSharing(true)
    try {
      const slots: ShareSlot[] = Array.from({ length: SLOTS_PER_PAGE }, (_, s) => {
        const key = slotKey(id, p, s)
        const item = items.get(key)
        return { src: srcFor(key, 'high'), name: isCard(item) ? item.name : undefined }
      })
      const blob = await renderPage(binder.name, p, binder.pageCount, slots)
      setShareImg({ blob, url: URL.createObjectURL(blob), page: p })
    } catch {
      setError('No se pudo armar la imagen para compartir.')
    } finally {
      setSharing(false)
    }
  }

  const closeShare = () => {
    if (shareImg) URL.revokeObjectURL(shareImg.url)
    setShareImg(null)
  }

  const filled = items.size
  const isLast = page >= binder.pageCount - 1
  const viewingItem = viewing ? items.get(slotKey(id, viewing.page, viewing.slot)) : undefined
  const viewingSrc = viewing ? srcFor(slotKey(id, viewing.page, viewing.slot), 'high') : undefined

  return (
    <div className="app">
      <header className="top">
        <button className="name" onClick={onOpenList} aria-label="Cambiar de binder">
          {binder.name} <span className="caret">▾</span>
        </button>
        <div className="top-right">
          <span className="count">
            {filled} {filled === 1 ? 'carta' : 'cartas'}
          </span>
          <button className="share-btn" onClick={openShare} disabled={sharing} aria-label="Compartir esta página">
            {sharing ? '…' : (
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
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
                const key = slotKey(id, p, s)
                const item = items.get(key)
                const src = srcFor(key, 'low')
                const isSource = moving?.page === p && moving.slot === s
                return (
                  <button
                    key={s}
                    className={`slot${item ? ' filled' : ''}${isSource ? ' source' : ''}${moving ? ' target' : ''}`}
                    onClick={() => onSlotTap(p, s)}
                    aria-label={item ? `Carta en casillero ${s + 1}` : `Agregar carta en casillero ${s + 1}`}
                  >
                    {item ? (
                      src ? (
                        <img src={src} alt={isCard(item) ? item.name : ''} draggable={false} loading="lazy" />
                      ) : (
                        <span className="noimg">{isCard(item) ? item.name : ''}</span>
                      )
                    ) : (
                      loaded && <span className="plus">+</span>
                    )}
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

      {choosing && (
        <div className="viewer" onClick={() => setChoosing(null)}>
          <div className="chooser" onClick={(e) => e.stopPropagation()}>
            <p>¿Qué quieres poner en este casillero?</p>
            <button
              className="primary"
              onClick={() => {
                setSearchTarget(choosing)
                setChoosing(null)
              }}
            >
              Buscar carta oficial
            </button>
            <button
              onClick={() => {
                pickPhoto(choosing)
                setChoosing(null)
              }}
            >
              Subir foto
            </button>
            <button className="link" onClick={() => setChoosing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {viewing && isCard(viewingItem) && (
        <CardDetailView
          card={viewingItem}
          onMove={() => {
            setMoving(viewing)
            setViewing(null)
          }}
          onChange={() => {
            setChoosing(viewing)
            setViewing(null)
          }}
          onRemove={() => removeItem(viewing)}
          onClose={() => setViewing(null)}
        />
      )}

      {viewing && viewingItem && !isCard(viewingItem) && (
        <div className="viewer" onClick={() => setViewing(null)}>
          <img src={viewingSrc} alt="Carta" onClick={(e) => e.stopPropagation()} />
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setMoving(viewing)
                setViewing(null)
              }}
            >
              Mover
            </button>
            <button
              onClick={() => {
                setChoosing(viewing)
                setViewing(null)
              }}
            >
              Cambiar
            </button>
            <button
              className="danger"
              onClick={() => (confirmRemove ? removeItem(viewing) : setConfirmRemove(true))}
            >
              {confirmRemove ? '¿Seguro? Toca otra vez' : 'Quitar'}
            </button>
            <button onClick={() => setViewing(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {searchTarget && (
        <SearchSheet
          targetLabel={`Va a la página ${searchTarget.page + 1}, casillero ${searchTarget.slot + 1}`}
          onAdd={addCard}
          onClose={() => setSearchTarget(null)}
        />
      )}

      {shareImg && (
        <div className="viewer" onClick={closeShare}>
          <img className="share-preview" src={shareImg.url} alt={`Página ${shareImg.page + 1}`} onClick={(e) => e.stopPropagation()} />
          <div className="actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="primary"
              onClick={() => shareImage(shareImg.blob, sharePageFile(shareImg.page), binder.name)}
            >
              Compartir
            </button>
            <button onClick={() => downloadImage(shareImg.blob, sharePageFile(shareImg.page))}>Guardar imagen</button>
            <button onClick={closeShare}>Cerrar</button>
          </div>
        </div>
      )}

      {busy && <div className="busy">Guardando…</div>}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
    </div>
  )
}
