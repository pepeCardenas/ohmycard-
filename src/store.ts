'use client'
// Cliente de la API propia (/api/...). Reemplaza al almacenamiento local de la versión anterior.

export const SLOTS_PER_PAGE = 9

export interface BinderMeta {
  id: string
  name: string
  pageCount: number
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

/** Foto subida por el usuario. */
export interface PhotoRef {
  kind: 'photo'
  url: string
}

export type SlotItem = CardRef | PhotoRef

export const isCard = (item: SlotItem | undefined): item is CardRef => item?.kind === 'card'

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
    body: body({ name: meta.name, pageCount: meta.pageCount }),
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
