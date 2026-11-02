// Almacenamiento local en el teléfono (IndexedDB). Sin servidor ni cuentas.

const DB_NAME = 'ohmycard'
const DB_VERSION = 1
const SLOTS = 'slots' // clave "binderId:page:slot" -> SlotItem
const META = 'meta' // "binder:<id>" -> BinderMeta, "binders" -> string[] (orden)

export const SLOTS_PER_PAGE = 9

export interface BinderMeta {
  id: string
  name: string
  pageCount: number
}

/** Carta oficial guardada por referencia (la imagen viene de TCGdex). */
export interface CardRef {
  kind: 'card'
  id: string
  lang: string
  name: string
  image?: string // URL base de TCGdex, sin calidad ni extensión
  setName?: string
  localId?: string
  rarity?: string
}

/** Foto subida por el usuario (Blob) o carta oficial. */
export type SlotItem = Blob | CardRef

export const isCard = (item: SlotItem | undefined): item is CardRef =>
  !!item && !(item instanceof Blob) && (item as CardRef).kind === 'card'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(SLOTS)) db.createObjectStore(SLOTS)
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const r = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(r ? r.result : (undefined as T))
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const slotKey = (binderId: string, page: number, slot: number) => `${binderId}:${page}:${slot}`
const binderRange = (binderId: string) => IDBKeyRange.bound(`${binderId}:`, `${binderId}:￿`)

// --- Binders ----------------------------------------------------------------

const getMeta = <T>(key: string) => run<T | undefined>(META, 'readonly', (s) => s.get(key))
const putMeta = (key: string, value: unknown) =>
  run<void>(META, 'readwrite', (s) => {
    s.put(value, key)
  })

export function saveBinder(meta: BinderMeta): Promise<void> {
  return putMeta(`binder:${meta.id}`, meta)
}

/** Lista de binders en orden. Crea el primero si no hay ninguno. */
export async function listBinders(): Promise<BinderMeta[]> {
  let ids = await getMeta<string[]>('binders')
  if (!ids) {
    // Versión anterior: un único binder "principal"
    const legacy = await getMeta<BinderMeta>('binder:principal')
    if (legacy) {
      ids = ['principal']
    } else {
      await saveBinder({ id: 'principal', name: 'Mi binder', pageCount: 2 })
      ids = ['principal']
    }
    await putMeta('binders', ids)
  }
  const metas = await Promise.all(ids.map((id) => getMeta<BinderMeta>(`binder:${id}`)))
  return metas.filter((m): m is BinderMeta => !!m)
}

export async function createBinder(name: string): Promise<BinderMeta> {
  const meta: BinderMeta = { id: `b${Date.now().toString(36)}`, name, pageCount: 2 }
  const ids = (await getMeta<string[]>('binders')) ?? []
  await saveBinder(meta)
  await putMeta('binders', [...ids, meta.id])
  return meta
}

export async function deleteBinder(id: string): Promise<void> {
  const ids = (await getMeta<string[]>('binders')) ?? []
  await putMeta(
    'binders',
    ids.filter((x) => x !== id),
  )
  await run<void>(META, 'readwrite', (s) => {
    s.delete(`binder:${id}`)
  })
  await run<void>(SLOTS, 'readwrite', (s) => {
    s.delete(binderRange(id))
  })
}

/** Cantidad de cartas por binder, para la lista de colecciones. */
export async function countSlots(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const keys = await run<IDBValidKey[]>(SLOTS, 'readonly', (s) => s.getAllKeys())
  for (const k of keys) {
    const id = String(k).split(':')[0]
    out.set(id, (out.get(id) ?? 0) + 1)
  }
  return out
}

// --- Casilleros --------------------------------------------------------------

/** Devuelve todo el contenido del binder, indexado por clave de casillero. */
export async function loadSlots(binderId: string): Promise<Map<string, SlotItem>> {
  const out = new Map<string, SlotItem>()
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SLOTS, 'readonly')
    const req = tx.objectStore(SLOTS).openCursor(binderRange(binderId))
    req.onsuccess = () => {
      const cur = req.result
      if (cur) {
        out.set(String(cur.key), cur.value as SlotItem)
        cur.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return out
}

export function putSlot(key: string, item: SlotItem): Promise<void> {
  return run(SLOTS, 'readwrite', (s) => {
    s.put(item, key)
  })
}

export function deleteSlot(key: string): Promise<void> {
  return run(SLOTS, 'readwrite', (s) => {
    s.delete(key)
  })
}

/** Intercambia el contenido de dos casilleros (cualquiera puede estar vacío). */
export async function swapSlots(a: string, b: string, itemA?: SlotItem, itemB?: SlotItem): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SLOTS, 'readwrite')
    const s = tx.objectStore(SLOTS)
    if (itemB) s.put(itemB, a)
    else s.delete(a)
    if (itemA) s.put(itemA, b)
    else s.delete(b)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Pide al navegador que no borre los datos guardados cuando falte espacio. */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {})
}
