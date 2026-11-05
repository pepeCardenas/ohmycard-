'use client'
// Cliente de la API propia (/api/...). Reemplaza al almacenamiento local de la versión anterior.

export const SLOTS_PER_PAGE = 9

export interface BinderMeta {
  id: string
  name: string
  pageCount: number
  /** Color de las hojas (id de lib/binderColors). */
  color?: string
  cardCount?: number
  /** Miniaturas de la primera página (9 casilleros, null si está vacío). */
  preview?: (string | null)[]
}

/** Carta oficial guardada por referencia (la imagen viene de TCGdex). */
export interface CardRef {
  kind: 'card'
  id: string
  lang: string
  name: string
  image?: string
  setName?: string
  localId?: string
  rarity?: string
}

/** Foto subida por el usuario. Puede ocupar 1, 2 (horizontal o vertical) o 4 casilleros. */
export interface PhotoRef {
  kind: 'photo'
  url: string
  /** Casilleros de ancho y de alto (1 o 2) a partir del casillero donde está guardada. */
  cols?: 1 | 2
  rows?: 1 | 2
}

export type SlotItem = CardRef | PhotoRef

export const isCard = (item: SlotItem | undefined): item is CardRef => item?.kind === 'card'

/** Cuántos casilleros ocupa un elemento (las cartas siempre 1). */
export const spanOf = (item: SlotItem | undefined) =>
  item?.kind === 'photo' ? { cols: item.cols ?? 1, rows: item.rows ?? 1 } : { cols: 1, rows: 1 }

/** Casilleros (0-8) de un bloque que empieza en `slot`, o null si se sale de la página 3x3. */
export function blockCells(slot: number, cols: number, rows: number): number[] | null {
  const c = slot % 3
  const r = Math.floor(slot / 3)
  if (c + cols > 3 || r + rows > 3) return null
  const cells: number[] = []
  for (let dr = 0; dr < rows; dr++) for (let dc = 0; dc < cols; dc++) cells.push((r + dr) * 3 + c + dc)
  return cells
}

export const slotKey = (binderId: string, page: number, slot: number) => `${binderId}:${page}:${slot}`

export class AuthError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json', ...init.headers } : init?.headers,
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new AuthError('Sesión vencida')
  }
  if (!res.ok) {
    const msg = await res
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => null)
    throw new Error(msg ?? `Error ${res.status}`)
  }
  return (await res.json()) as T
}

const body = (data: unknown) => JSON.stringify(data)

// --- Binders ----------------------------------------------------------------

export const listBinders = () => call<BinderMeta[]>('/api/binders')

export const createBinder = (name: string, pageCount?: number) =>
  call<BinderMeta>('/api/binders', { method: 'POST', body: body({ name, pageCount }) })

export const saveBinder = (meta: BinderMeta) =>
  call<void>(`/api/binders/${meta.id}`, {
    method: 'PATCH',
    body: body({ name: meta.name, pageCount: meta.pageCount, color: meta.color }),
  })

export const deleteBinder = (id: string) => call<void>(`/api/binders/${id}`, { method: 'DELETE' })

// --- Casilleros --------------------------------------------------------------

export async function loadSlots(binderId: string): Promise<Map<string, SlotItem>> {
  const rows = await call<{ page: number; slot: number; item: SlotItem }[]>(`/api/binders/${binderId}/slots`)
  return new Map(rows.map((r) => [slotKey(binderId, r.page, r.slot), r.item]))
}

export const putSlot = (binderId: string, page: number, slot: number, item: SlotItem) =>
  call<void>(`/api/binders/${binderId}/slots`, { method: 'PUT', body: body({ page, slot, item }) })

export const deleteSlot = (binderId: string, page: number, slot: number) =>
  call<void>(`/api/binders/${binderId}/slots?page=${page}&slot=${slot}`, { method: 'DELETE' })

export const swapSlots = (binderId: string, from: { page: number; slot: number }, to: { page: number; slot: number }) =>
  call<void>(`/api/binders/${binderId}/slots`, { method: 'POST', body: body({ from, to }) })

/** Sube una foto (ya reducida) y devuelve la referencia para guardar en un casillero. */
export async function uploadPhoto(blob: Blob): Promise<PhotoRef> {
  const form = new FormData()
  form.append('file', blob, 'carta.jpg')
  const { url } = await call<{ url: string }>('/api/photos', { method: 'POST', body: form })
  return { kind: 'photo', url }
}

// --- Colecciones ---------------------------------------------------------------

export interface CollectionMeta {
  id: string
  name: string
  cardCount?: number
  /** Miniaturas de las últimas cartas agregadas (hasta 4). */
  preview?: string[]
}

export interface CollectionEntry {
  id: string
  item: SlotItem
}

export const listCollections = () => call<CollectionMeta[]>('/api/collections')

export const createCollection = (name: string) =>
  call<CollectionMeta>('/api/collections', { method: 'POST', body: body({ name }) })

export const renameCollection = (id: string, name: string) =>
  call<void>(`/api/collections/${id}`, { method: 'PATCH', body: body({ name }) })

export const deleteCollection = (id: string) => call<void>(`/api/collections/${id}`, { method: 'DELETE' })

export const loadCollection = (id: string) => call<CollectionEntry[]>(`/api/collections/${id}/items`)

export const addToCollection = (id: string, items: SlotItem[]) =>
  call<CollectionEntry[]>(`/api/collections/${id}/items`, { method: 'POST', body: body({ items }) })

export const removeFromCollection = (id: string, itemId: string) =>
  call<void>(`/api/collections/${id}/items?item=${encodeURIComponent(itemId)}`, { method: 'DELETE' })

// --- Preferencias ------------------------------------------------------------

export const loadPrefs = () => call<{ skin: string; mode: string }>('/api/prefs')

export const savePrefs = (prefs: { skin?: string; mode?: string }) =>
  call<void>('/api/prefs', { method: 'PATCH', body: body(prefs) })
