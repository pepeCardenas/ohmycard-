// Almacenamiento local en el teléfono (IndexedDB). Sin servidor ni cuentas.

const DB_NAME = 'ohmycard'
const DB_VERSION = 1
const SLOTS = 'slots' // clave "binderId:page:slot" -> Blob de la imagen
const META = 'meta' // clave "binder:<id>" -> datos del binder

export const SLOTS_PER_PAGE = 9

export interface BinderMeta {
  id: string
  name: string
  pageCount: number
}

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

export async function loadBinder(id: string, defaultName: string): Promise<BinderMeta> {
  const meta = await run<BinderMeta | undefined>(META, 'readonly', (s) => s.get(`binder:${id}`))
  if (meta) return meta
  const fresh: BinderMeta = { id, name: defaultName, pageCount: 2 }
  await saveBinder(fresh)
  return fresh
}

export function saveBinder(meta: BinderMeta): Promise<void> {
  return run(META, 'readwrite', (s) => {
    s.put(meta, `binder:${meta.id}`)
  })
}

/** Devuelve todas las imágenes del binder, indexadas por clave de casillero. */
export async function loadSlots(binderId: string): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>()
  const range = IDBKeyRange.bound(`${binderId}:`, `${binderId}:￿`)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SLOTS, 'readonly')
    const req = tx.objectStore(SLOTS).openCursor(range)
    req.onsuccess = () => {
      const cur = req.result
      if (cur) {
        out.set(String(cur.key), cur.value as Blob)
        cur.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return out
}

export function putSlot(key: string, blob: Blob): Promise<void> {
  return run(SLOTS, 'readwrite', (s) => {
    s.put(blob, key)
  })
}

export function deleteSlot(key: string): Promise<void> {
  return run(SLOTS, 'readwrite', (s) => {
    s.delete(key)
  })
}

/** Intercambia el contenido de dos casilleros (cualquiera puede estar vacío). */
export async function swapSlots(a: string, b: string, blobA?: Blob, blobB?: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SLOTS, 'readwrite')
    const s = tx.objectStore(SLOTS)
    if (blobB) s.put(blobB, a)
    else s.delete(a)
    if (blobA) s.put(blobA, b)
    else s.delete(b)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Pide al navegador que no borre los datos guardados cuando falte espacio. */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {})
}
