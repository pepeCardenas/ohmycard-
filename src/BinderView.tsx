'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { binderColor, binderColorStyle } from '@/lib/binderColors'
import { imageUrl } from './api'
import {
  SLOTS_PER_PAGE,
  type BinderMeta,
  blockCells,
  spanOf,
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
import { prepareCardImage, splitCardImage } from './image'
import CardDetailView from './CardDetailView'
import SlotActions from './SlotActions'
import SearchSheet from './SearchSheet'
import { type ShareSlot, downloadImage, renderPage, shareImage } from './share'

type Pos = { page: number; slot: number }

/** Carta que se está arrastrando: de dónde sale, dónde está el dedo y sobre qué casillero. */
type Drag = { from: Pos; x: number; y: number; dx: number; dy: number; w: number; h: number; over: Pos | null }

interface Props {
  binder: BinderMeta
  onChange: (meta: BinderMeta) => void
  onOpenList: () => void
}

type Size = { cols: 1 | 2; rows: 1 | 2 }

/** Tamaños posibles para una foto. */
const SIZES: { size: Size; label: string }[] = [
  { size: { cols: 1, rows: 1 }, label: '1 casillero' },
  { size: { cols: 2, rows: 1 }, label: '2 horizontal' },
  { size: { cols: 1, rows: 2 }, label: '2 vertical' },
  { size: { cols: 2, rows: 2 }, label: '4 casilleros' },
]

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
  const [shareImg, setShareImg] = useState<{ blob: Blob; url: string; page: number } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [sizing, setSizing] = useState<{ file: File; target: Pos; preview: string } | null>(null)

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

  /** Para cada casillero de una página: en qué casillero está guardado lo que lo ocupa (null si está libre). */
  const ownersOf = (p: number, map: Map<string, SlotItem>) => {
    const owners: (number | null)[] = Array(SLOTS_PER_PAGE).fill(null)
    for (let s = 0; s < SLOTS_PER_PAGE; s++) {
      const item = map.get(slotKey(id, p, s))
      if (!item) continue
      const { cols, rows } = spanOf(item)
      for (const c of blockCells(s, cols, rows) ?? [s]) owners[c] = s
    }
    return owners
  }

  /** Siguiente casillero libre a partir de `from` (incluido), contando los que tapan las fotos grandes. */
  const nextEmpty = (from: number, map: Map<string, SlotItem>) => {
    let i = from
    while (ownersOf(toPos(i).page, map)[toPos(i).slot] !== null) i++
    return i
  }

  /**
   * Dónde empezar un bloque de `size` que incluya el casillero `target` y sólo use casilleros libres
   * (o los de `ignore`, que se va a reemplazar o mover). Null si no entra.
   */
  const findPlacement = (target: Pos, size: Size, map: Map<string, SlotItem>, ignore?: number) => {
    const owners = ownersOf(target.page, map)
    const col = target.slot % 3
    const row = Math.floor(target.slot / 3)
    for (let dr = 0; dr < size.rows; dr++) {
      for (let dc = 0; dc < size.cols; dc++) {
        const c = col - dc
        const r = row - dr
        if (c < 0 || r < 0) continue
        const anchor = r * 3 + c
        const cells = blockCells(anchor, size.cols, size.rows)
        if (cells && cells.every((x) => owners[x] === null || owners[x] === ignore)) return anchor
      }
    }
    return null
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
    // Una sola foto: primero se elige el tamaño
    if (files.length === 1) {
      // Si sólo entra en un casillero, no hace falta preguntar
      const fits = SIZES.filter(({ size }) => piecesPlacement(start, size, itemsRef.current))
      if (fits.length > 1) {
        setSizing({ file: files[0], target: start, preview: URL.createObjectURL(files[0]) })
        return
      }
    }
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

  /** Casillero que se reemplaza al poner algo en `target` (si ya tenía algo guardado ahí). */
  const replaced = (target: Pos, map: Map<string, SlotItem>) =>
    map.has(slotKey(id, target.page, target.slot)) ? target.slot : undefined

  const closeSizing = () => {
    if (sizing) URL.revokeObjectURL(sizing.preview)
    setSizing(null)
  }

  /**
   * Casilleros donde van los pedazos de una foto de `size` que empieza en `target`:
   * si entra con esa forma, ese bloque; si no, los libres de la página empezando por `target`.
   * Null si no hay suficientes casilleros libres.
   */
  const piecesPlacement = (target: Pos, size: Size, map: Map<string, SlotItem>) => {
    const ignore = replaced(target, map)
    const need = size.cols * size.rows
    const anchor = findPlacement(target, size, map, ignore)
    if (anchor !== null) return blockCells(anchor, size.cols, size.rows) ?? null
    const owners = ownersOf(target.page, map)
    const free = (c: number) => owners[c] === null || owners[c] === ignore
    const order = Array.from({ length: SLOTS_PER_PAGE }, (_, k) => (target.slot + k) % SLOTS_PER_PAGE)
    const cells = order.filter(free).slice(0, need)
    return cells.length === need ? cells : null
  }

  const uploadSized = async (size: Size) => {
    if (!sizing) return
    const { file, target } = sizing
    const map = itemsRef.current
    const cells = piecesPlacement(target, size, map)
    if (!cells) return
    closeSizing()
    setBusy(true)
    setError(null)
    try {
      const next = new Map(map)
      const pieces = await splitCardImage(file, size.cols, size.rows)
      // Si el casillero elegido tenía una foto grande vieja, se libera entero
      const old = next.get(slotKey(id, target.page, target.slot))
      if (old && !cells.includes(target.slot)) {
        await deleteSlot(id, target.page, target.slot)
        next.delete(slotKey(id, target.page, target.slot))
      }
      for (const [n, blob] of pieces.entries()) {
        await place({ page: target.page, slot: cells[n] }, await uploadPhoto(blob), next)
      }
      setItems(next)
      setViewing(null)
    } catch {
      setError('No se pudo cargar la foto. Prueba con JPG o PNG.')
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

  /** Intercambia dos casilleros (si el destino está vacío, la carta simplemente se mueve). */
  const moveItem = async (from: Pos, target: Pos) => {
    let to = target
    const fromKey = slotKey(id, from.page, from.slot)
    if (fromKey === slotKey(id, to.page, to.slot)) return
    const current = itemsRef.current
    const a = current.get(fromKey)
    const sa = spanOf(a)
    // Foto grande: va a un lugar libre que incluya el casillero de destino
    if (a && (sa.cols > 1 || sa.rows > 1)) {
      const anchor = findPlacement(to, sa as Size, current, to.page === from.page ? from.slot : undefined)
      if (anchor === null) {
        setError('No hay lugar libre para esa foto ahí.')
        return
      }
      to = { page: to.page, slot: anchor }
      if (to.page === from.page && to.slot === from.slot) return
    }
    const b = current.get(slotKey(id, to.page, to.slot))
    const sb = spanOf(b)
    if (b && (sb.cols > 1 || sb.rows > 1)) {
      setError('Para cambiar de lugar una foto grande, arrástrala a ella.')
      return
    }
    const destKey = slotKey(id, to.page, to.slot)
    try {
      await swapSlots(id, from, to)
    } catch {
      setError('No se pudo mover la carta.')
      return
    }
    const next = new Map(itemsRef.current)
    if (b) next.set(fromKey, b)
    else next.delete(fromKey)
    if (a) next.set(destKey, a)
    else next.delete(destKey)
    setItems(next)
  }

  const onSlotTap = async (p: number, s: number) => {
    // El click que llega al soltar un arrastre no abre nada
    if (justDragged.current) return
    const key = slotKey(id, p, s)
    if (moving) {
      await moveItem(moving, { page: p, slot: s })
      setMoving(null)
      return
    }
    if (items.has(key)) setViewing({ page: p, slot: s })
    else setChoosing({ page: p, slot: s })
  }

  // --- Arrastrar cartas (mantener apretado, como los íconos del iPhone) -----

  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const justDragged = useRef(false)
  const pageRef = useRef(page)
  pageRef.current = page

  const updateDrag = (d: Drag | null) => {
    dragRef.current = d
    setDrag(d)
  }

  const onSlotPointerDown = (e: React.PointerEvent<HTMLButtonElement>, p: number, s: number) => {
    if (moving || e.button !== 0 || !itemsRef.current.has(slotKey(id, p, s))) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId
    const isMouse = e.pointerType === 'mouse'
    let active = false
    let edgeTimer: ReturnType<typeof setTimeout> | null = null
    let edgeSide = 0

    const activate = (x: number, y: number) => {
      active = true
      navigator.vibrate?.(15)
      updateDrag({
        from: { page: p, slot: s },
        x,
        y,
        dx: startX - rect.left,
        dy: startY - rect.top,
        w: rect.width,
        h: rect.height,
        over: null,
      })
    }

    const holdTimer = isMouse ? null : setTimeout(() => activate(startX, startY), 380)

    const clearEdge = () => {
      if (edgeTimer) clearTimeout(edgeTimer)
      edgeTimer = null
      edgeSide = 0
    }

    // Cerca de un borde, pasa de página después de un momento (y agrega una al final si hace falta)
    const checkEdge = (x: number) => {
      const pager = pagerRef.current
      if (!pager) return
      const r = pager.getBoundingClientRect()
      const side = x < r.left + 28 ? -1 : x > r.right - 28 ? 1 : 0
      if (side === edgeSide) return
      clearEdge()
      edgeSide = side
      if (!side) return
      edgeTimer = setTimeout(function flip() {
        const b = binderRef.current
        const target = pageRef.current + side
        if (target < 0) return
        if (target >= b.pageCount) {
          if (pageIsEmptyIn(pageRef.current, itemsRef.current)) return
          onChange({ ...b, pageCount: b.pageCount + 1 })
          setTimeout(() => goTo(target), 50)
        } else goTo(target)
        edgeTimer = setTimeout(flip, 900)
      }, 550)
    }

    const slotAt = (x: number, y: number): Pos | null => {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot]')
      if (!hit) return null
      return { page: Number(hit.dataset.page), slot: Number(hit.dataset.slot) }
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (!active) {
        const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY)
        if (isMouse && moved > 6) activate(ev.clientX, ev.clientY)
        else if (!isMouse && moved > 10) cleanup() // está deslizando la página, no arrastrando
        return
      }
      const d = dragRef.current
      if (!d) return
      updateDrag({ ...d, x: ev.clientX, y: ev.clientY, over: slotAt(ev.clientX, ev.clientY) })
      checkEdge(ev.clientX)
    }

    // Mientras se arrastra, que el dedo no desplace la página
    const onTouchMove = (ev: TouchEvent) => {
      if (active) ev.preventDefault()
    }

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const d = dragRef.current
      const wasActive = active
      cleanup()
      if (!wasActive || !d) return
      justDragged.current = true
      setTimeout(() => (justDragged.current = false), 50)
      const to = slotAt(ev.clientX, ev.clientY) ?? d.over
      if (to) void moveItem(d.from, to)
    }

    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) cleanup()
    }

    function cleanup() {
      if (holdTimer) clearTimeout(holdTimer)
      clearEdge()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
      if (active) updateDrag(null)
      active = false
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
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
  }

  // --- Páginas --------------------------------------------------------------

  const pageIsEmptyIn = (p: number, map: Map<string, SlotItem>) =>
    Array.from({ length: SLOTS_PER_PAGE }, (_, s) => slotKey(id, p, s)).every((k) => !map.has(k))
  const pageIsEmpty = (p: number) => pageIsEmptyIn(p, items)

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
      const owners = ownersOf(p, items)
      const slots: ShareSlot[] = Array.from({ length: SLOTS_PER_PAGE }, (_, s) => {
        const key = slotKey(id, p, s)
        const item = items.get(key)
        if (owners[s] !== null && owners[s] !== s) return { covered: true }
        return { src: srcFor(key, 'high'), name: isCard(item) ? item.name : undefined, ...spanOf(item) }
      })
      const blob = await renderPage(binder.name, p, binder.pageCount, slots, binderColor(binder.color))
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
        <div className="top-left">
          <button className="name" onClick={onOpenList} aria-label="Cambiar de binder">
            {binder.name} <span className="caret">▾</span>
          </button>
          <span className="count">
            {!loaded
              ? 'Cargando…'
              : filled === 0
                ? 'Toca un casillero para agregar tu primera carta'
                : `${filled} ${filled === 1 ? 'carta' : 'cartas'} · ${binder.pageCount} ${binder.pageCount === 1 ? 'página' : 'páginas'}`}
          </span>
        </div>
        <div className="top-right">
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
        <div className="banner move-banner">
          Toca dónde va la carta
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
            <div className="sheet" style={binderColorStyle(binder.color)}>
              {(() => {
                const owners = ownersOf(p, items)
                return Array.from({ length: SLOTS_PER_PAGE }, (_, s) => {
                // Casillero tapado por una foto grande: se dibuja como parte de esa foto
                if (owners[s] !== null && owners[s] !== s) return null
                const key = slotKey(id, p, s)
                const item = items.get(key)
                const span = spanOf(item)
                const big = span.cols > 1 || span.rows > 1
                const src = srcFor(key, 'low')
                const isSource = moving?.page === p && moving.slot === s
                const isLifted = drag?.from.page === p && drag.from.slot === s
                const isOver = !isLifted && drag?.over?.page === p && drag.over.slot === s
                return (
                  <button
                    key={s}
                    data-page={p}
                    data-slot={s}
                    style={{
                      gridColumn: `${(s % 3) + 1} / span ${span.cols}`,
                      gridRow: `${Math.floor(s / 3) + 1} / span ${span.rows}`,
                    }}
                    className={`slot${item ? ' filled' : ''}${big ? ' big' : ''}${isSource ? ' source' : ''}${moving ? ' target' : ''}${
                      drag ? ' dragging' : ''
                    }${isLifted ? ' lifted' : ''}${isOver ? ' drop-over' : ''}`}
                    onClick={() => onSlotTap(p, s)}
                    onPointerDown={(e) => onSlotPointerDown(e, p, s)}
                    onContextMenu={(e) => e.preventDefault()}
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
                })
              })()}
            </div>
          </section>
        ))}
      </div>

      {drag && (
        <div
          className="drag-ghost"
          aria-hidden="true"
          style={{
            width: drag.w,
            height: drag.h,
            transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) rotate(-3deg) scale(1.08)`,
          }}
        >
          {(() => {
            const key = slotKey(id, drag.from.page, drag.from.slot)
            const item = items.get(key)
            const src = srcFor(key, 'low')
            return src ? <img src={src} alt="" draggable={false} /> : <span className="noimg">{isCard(item) ? item.name : ''}</span>
          })()}
        </div>
      )}

      <footer className="bottom">
        <button className="nav" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="Página anterior">
          ‹
        </button>
        <div className="pageinfo">
          {binder.pageCount <= 12 ? (
            <div className="dots" role="tablist" aria-label="Páginas">
              {Array.from({ length: binder.pageCount }, (_, p) => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={p === page}
                  aria-label={`Página ${p + 1}`}
                  className={`dot${p === page ? ' on' : ''}${pageIsEmpty(p) ? '' : ' has'}`}
                  onClick={() => goTo(p)}
                />
              ))}
            </div>
          ) : null}
          <div className="page-row">
            <span className="page-num">
              Página {page + 1} de {binder.pageCount}
            </span>
            {isLast && binder.pageCount > 1 && pageIsEmpty(page) ? (
              <button className="pill" onClick={removeLastPage}>
                − Quitar
              </button>
            ) : (
              <button className="pill" onClick={addPage}>
                + Página
              </button>
            )}
          </div>
        </div>
        <button className="nav" onClick={() => goTo(page + 1)} disabled={isLast} aria-label="Página siguiente">
          ›
        </button>
      </footer>

      {choosing && (
        <div className="viewer action-backdrop" onClick={() => setChoosing(null)}>
          <div className="action-sheet" role="dialog" aria-label="Agregar carta" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Agregar carta</p>
            <p className="sheet-text">
              Página {choosing.page + 1} · casillero {choosing.slot + 1}
            </p>
            <button
              className="sheet-option big primary"
              onClick={() => {
                setSearchTarget(choosing)
                setChoosing(null)
              }}
            >
              <span className="opt-icon" aria-hidden="true">🔍</span>
              <span className="opt-text">
                Buscar carta oficial
                <small>Por nombre, en cualquier idioma</small>
              </span>
            </button>
            <button
              className="sheet-option big"
              onClick={() => {
                pickPhoto(choosing)
                setChoosing(null)
              }}
            >
              <span className="opt-icon" aria-hidden="true">📷</span>
              <span className="opt-text">
                Subir foto
                <small>De tu carta o de la galería</small>
              </span>
            </button>
            <button className="sheet-cancel" onClick={() => setChoosing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {viewing && isCard(viewingItem) && (
        <CardDetailView
          card={viewingItem}
          where={`Página ${viewing.page + 1} · casillero ${viewing.slot + 1}`}
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
        <div className="sheet-screen detail" role="dialog" aria-label="Foto de la carta">
          <header className="list-top">
            <div className="list-title">
              <h1>Tu foto</h1>
              <p>
                Página {viewing.page + 1} · casillero {viewing.slot + 1}
              </p>
            </div>
            <button className="done" onClick={() => setViewing(null)}>
              Cerrar
            </button>
          </header>
          <div className="detail-body photo-body">
            <img className="detail-img photo" src={viewingSrc} alt="Foto de la carta" />
          </div>
          <SlotActions
            onMove={() => {
              setMoving(viewing)
              setViewing(null)
            }}
            onChange={() => {
              setChoosing(viewing)
              setViewing(null)
            }}
            onRemove={() => removeItem(viewing)}
          />
        </div>
      )}

      {sizing && (
        <div className="viewer action-backdrop" onClick={closeSizing}>
          <div className="action-sheet" role="dialog" aria-label="Tamaño de la foto" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">¿Cuántos casilleros ocupa?</p>
            <img className="size-photo" src={sizing.preview} alt="" />
            <div className="size-grid">
              {SIZES.map(({ size, label }) => {
                const cells = piecesPlacement(sizing.target, size, items)
                // Sólo se ofrecen las formas que entran en los casilleros libres de la página
                if (!cells) return null
                return (
                  <button key={label} className="size-option" onClick={() => uploadSized(size)}>
                    <span className="mini-sheet" aria-hidden="true">
                      {Array.from({ length: SLOTS_PER_PAGE }, (_, c) => (
                        <span key={c} className={cells.includes(c) ? 'on' : ''} />
                      ))}
                    </span>
                    {label}
                    {findPlacement(sizing.target, size, items, replaced(sizing.target, items)) === null && (
                      <small>Separadas</small>
                    )}
                  </button>
                )
              })}
            </div>
            <button className="sheet-cancel" onClick={closeSizing}>
              Cancelar
            </button>
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
