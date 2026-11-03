'use client'
// Lectura de los datos que la versión anterior guardaba en el teléfono (IndexedDB),
// para importarlos a la cuenta. Sólo lee: nunca borra nada.

import type { CardRef } from './store'

const DB_NAME = 'ohmycard'
const IMPORTED_KEY = 'ohmycard:importado'

export interface LegacyBinder {
  name: string
  pageCount: number
  slots: { page: number; slot: number; item: Blob | CardRef }[]
}

function openExisting(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const req = indexedDB.open(DB_NAME)
    req.onupgradeneeded = () => {
      // No existía: cancelar para no crear una base vacía
      req.transaction?.abort()
      resolve(null)
    }
    req.onsuccess = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta') || !db.objectStoreNames.contains('slots')) {
        db.close()
        resolve(null)
      } else resolve(db)
    }
    req.onerror = () => resolve(null)
  })
}

function getAll(db: IDBDatabase, store: string): Promise<{ key: string; value: unknown }[]> {
  return new Promise((resolve, reject) => {
    const out: { key: string; value: unknown }[] = []
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).openCursor()
    req.onsuccess = () => {
      const cur = req.result
      if (cur) {
        out.push({ key: String(cur.key), value: cur.value })
        cur.continue()
      }
    }
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
  })
}

export function alreadyImported(): boolean {
  try {
    return localStorage.getItem(IMPORTED_KEY) === '1'
  } catch {
    return true
  }
}

export function markImported() {
  try {
    localStorage.setItem(IMPORTED_KEY, '1')
  } catch {
    /* sin almacenamiento */
  }
}

/** Binders guardados en este teléfono por la versión anterior, o [] si no hay. */
export async function readLegacy(): Promise<LegacyBinder[]> {
  const db = await openExisting()
  if (!db) return []
  try {
    const meta = await getAll(db, 'meta')
    const slots = await getAll(db, 'slots')
    const metas = new Map<string, { name: string; pageCount: number }>()
    for (const m of meta) {
      if (m.key.startsWith('binder:')) metas.set(m.key.slice(7), m.value as { name: string; pageCount: number })
    }
    const order = (meta.find((m) => m.key === 'binders')?.value as string[] | undefined) ?? [...metas.keys()]
    const result: LegacyBinder[] = []
    for (const id of order) {
      const m = metas.get(id)
      if (!m) continue
      const items = slots
        .filter((s) => s.key.startsWith(`${id}:`))
        .map((s) => {
          const [, page, slot] = s.key.split(':')
          return { page: Number(page), slot: Number(slot), item: s.value as Blob | CardRef }
        })
      result.push({ name: m.name, pageCount: m.pageCount, slots: items })
    }
    return result.filter((b) => b.slots.length > 0)
  } finally {
    db.close()
  }
}
