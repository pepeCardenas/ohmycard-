'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import BinderList, { type Kind } from './BinderList'
import BinderView from './BinderView'
import CollectionView from './CollectionView'
import { type LegacyBinder, alreadyImported, markImported, readLegacy } from './legacy'
import {
  type BinderMeta,
  type CollectionMeta,
  type SlotItem,
  createBinder,
  createCollection,
  deleteBinder,
  deleteCollection,
  listBinders,
  listCollections,
  renameCollection,
  putSlot,
  saveBinder,
  uploadPhoto,
} from './store'

const CURRENT_KEY = 'ohmycard:binder'
const KIND_KEY = 'ohmycard:open-kind'

function readCurrent(): { kind: Kind; id: string | null } {
  try {
    const kind = localStorage.getItem(KIND_KEY) === 'collection' ? 'collection' : 'binder'
    return { kind, id: localStorage.getItem(CURRENT_KEY) }
  } catch {
    return { kind: 'binder', id: null }
  }
}

function writeCurrent(kind: Kind, id: string) {
  try {
    localStorage.setItem(CURRENT_KEY, id)
    localStorage.setItem(KIND_KEY, kind)
  } catch {
    /* sin almacenamiento: se abre el primero */
  }
}

export default function Home({ userEmail }: { userEmail: string }) {
  const [binders, setBinders] = useState<BinderMeta[] | null>(null)
  const [collections, setCollections] = useState<CollectionMeta[]>([])
  const [current, setCurrent] = useState<{ kind: Kind; id: string } | null>(null)
  const [showList, setShowList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [legacy, setLegacy] = useState<LegacyBinder[]>([])
  const [importing, setImporting] = useState<string | null>(null)

  const load = async (prefer?: string) => {
    const [list, cols] = await Promise.all([listBinders(), listCollections().catch(() => [] as CollectionMeta[])])
    setBinders(list)
    setCollections(cols)
    const saved = prefer ? { kind: 'binder' as Kind, id: prefer } : readCurrent()
    if (saved.kind === 'collection' && cols.some((c) => c.id === saved.id)) {
      setCurrent({ kind: 'collection', id: saved.id! })
    } else {
      const id = list.some((b) => b.id === saved.id) ? saved.id! : list[0].id
      setCurrent({ kind: 'binder', id })
      writeCurrent('binder', id)
    }
    return list
  }

  useEffect(() => {
    load().catch(() => setError('No se pudieron cargar tus binders. Revisa tu conexión.'))
    if (!alreadyImported()) readLegacy().then(setLegacy).catch(() => {})
  }, [])

  const open = (kind: Kind, id: string) => {
    setCurrent({ kind, id })
    writeCurrent(kind, id)
    setShowList(false)
  }

  const update = (meta: BinderMeta) => {
    setBinders((list) => list?.map((b) => (b.id === meta.id ? { ...b, ...meta } : b)) ?? null)
    saveBinder(meta).catch(() => setError('No se pudo guardar el cambio.'))
  }

  // --- Importar lo guardado en el teléfono por la versión anterior ---------------

  const legacyCount = legacy.reduce((n, b) => n + b.slots.length, 0)

  const runImport = async () => {
    let done = 0
    let firstId: string | undefined
    try {
      for (const lb of legacy) {
        const created = await createBinder(lb.name, lb.pageCount)
        firstId ??= created.id
        for (const s of lb.slots) {
          setImporting(`Importando ${done + 1} de ${legacyCount}…`)
          const item: SlotItem = s.item instanceof Blob ? await uploadPhoto(s.item) : s.item
          await putSlot(created.id, s.page, s.slot, item)
          done++
        }
      }
      markImported()
      setLegacy([])
      await load(firstId)
    } catch {
      setError(`La importación se cortó después de ${done} cartas. Puedes intentarlo de nuevo.`)
    } finally {
      setImporting(null)
    }
  }

  const skipImport = () => {
    markImported()
    setLegacy([])
  }

  const signOut = async () => {
    await authClient.signOut()
    window.location.href = '/login'
  }

  const binder = current?.kind === 'binder' ? binders?.find((b) => b.id === current.id) : undefined
  const openCollection = current?.kind === 'collection' ? collections.find((c) => c.id === current.id) : undefined
  if (!binders || !current || (!binder && !openCollection)) {
    return <div className="loading">{error ?? 'Abriendo tu binder…'}</div>
  }

  return (
    <>
      {binder && (
        <BinderView key={binder.id} binder={binder} onChange={update} onOpenList={() => setShowList(true)} />
      )}
      {openCollection && (
        <CollectionView
          key={openCollection.id}
          collection={openCollection}
          onOpenList={() => setShowList(true)}
          onCount={(n) =>
            setCollections((list) => list.map((c) => (c.id === openCollection.id ? { ...c, cardCount: n } : c)))
          }
        />
      )}

      {legacyCount > 0 && (
        <div className="viewer action-backdrop">
          <div className="action-sheet" role="dialog" aria-label="Importar cartas">
            <p className="sheet-text">
              Encontré {legacyCount} {legacyCount === 1 ? 'carta guardada' : 'cartas guardadas'} en este teléfono de la
              versión anterior. ¿Las paso a tu cuenta?
            </p>
            {importing ? (
              <p className="muted">{importing}</p>
            ) : (
              <>
                <button className="sheet-option primary" onClick={runImport}>
                  Importar a mi cuenta
                </button>
                <button className="sheet-cancel" onClick={skipImport}>
                  Ahora no
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="banner error floating" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {showList && (
        <BinderList
          binders={binders}
          collections={collections}
          current={current}
          userEmail={userEmail}
          onSignOut={signOut}
          onOpen={open}
          onClose={() => setShowList(false)}
          onCreate={async (kind, name) => {
            try {
              if (kind === 'binder') {
                const meta = await createBinder(name)
                setBinders((list) => [...(list ?? []), meta])
                open('binder', meta.id)
              } else {
                const meta = await createCollection(name)
                setCollections((list) => [...list, meta])
                open('collection', meta.id)
              }
            } catch {
              setError(kind === 'binder' ? 'No se pudo crear el binder.' : 'No se pudo crear la colección.')
            }
          }}
          onRename={(kind, id, name) => {
            if (kind === 'binder') {
              const b = binders.find((x) => x.id === id)
              if (b) update({ ...b, name })
            } else {
              setCollections((list) => list.map((c) => (c.id === id ? { ...c, name } : c)))
              renameCollection(id, name).catch(() => setError('No se pudo guardar el cambio.'))
            }
          }}
          onColor={(id, color) => {
            const b = binders.find((x) => x.id === id)
            if (b) update({ ...b, color })
          }}
          onDelete={async (kind, id) => {
            try {
              if (kind === 'binder') {
                await deleteBinder(id)
                const rest = binders.filter((b) => b.id !== id)
                setBinders(rest)
                if (current.kind === 'binder' && id === current.id) open('binder', rest[0].id)
              } else {
                await deleteCollection(id)
                setCollections((list) => list.filter((c) => c.id !== id))
                if (current.kind === 'collection' && id === current.id) open('binder', binders[0].id)
              }
            } catch {
              setError(kind === 'binder' ? 'No se pudo borrar el binder.' : 'No se pudo borrar la colección.')
            }
          }}
        />
      )}
    </>
  )
}
