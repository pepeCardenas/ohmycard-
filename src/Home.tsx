'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import BinderList from './BinderList'
import BinderView from './BinderView'
import { type LegacyBinder, alreadyImported, markImported, readLegacy } from './legacy'
import {
  type BinderMeta,
  type SlotItem,
  createBinder,
  deleteBinder,
  listBinders,
  putSlot,
  saveBinder,
  uploadPhoto,
} from './store'

const CURRENT_KEY = 'ohmycard:binder'

function readCurrent(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

function writeCurrent(id: string) {
  try {
    localStorage.setItem(CURRENT_KEY, id)
  } catch {
    /* sin almacenamiento: se abre el primero */
  }
}

export default function Home({ userEmail }: { userEmail: string }) {
  const [binders, setBinders] = useState<BinderMeta[] | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [legacy, setLegacy] = useState<LegacyBinder[]>([])
  const [importing, setImporting] = useState<string | null>(null)

  const load = async (prefer?: string) => {
    const list = await listBinders()
    setBinders(list)
    const saved = prefer ?? readCurrent()
    const id = list.some((b) => b.id === saved) ? saved! : list[0].id
    setCurrentId(id)
    writeCurrent(id)
    return list
  }

  useEffect(() => {
    load().catch(() => setError('No se pudieron cargar tus binders. Revisa tu conexión.'))
    if (!alreadyImported()) readLegacy().then(setLegacy).catch(() => {})
  }, [])

  const open = (id: string) => {
    setCurrentId(id)
    writeCurrent(id)
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

  const binder = binders?.find((b) => b.id === currentId)
  if (!binders || !binder) {
    return <div className="loading">{error ?? 'Abriendo tu binder…'}</div>
  }

  return (
    <>
      <BinderView key={binder.id} binder={binder} onChange={update} onOpenList={() => setShowList(true)} />

      {legacyCount > 0 && (
        <div className="viewer">
          <div className="chooser">
            <p>
              Encontré {legacyCount} {legacyCount === 1 ? 'carta guardada' : 'cartas guardadas'} en este teléfono de la
              versión anterior. ¿Las paso a tu cuenta?
            </p>
            {importing ? (
              <p className="muted">{importing}</p>
            ) : (
              <>
                <button className="primary" onClick={runImport}>
                  Importar a mi cuenta
                </button>
                <button className="link" onClick={skipImport}>
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
          currentId={binder.id}
          userEmail={userEmail}
          onSignOut={signOut}
          onOpen={open}
          onClose={() => setShowList(false)}
          onCreate={async (name) => {
            try {
              const meta = await createBinder(name)
              setBinders((list) => [...(list ?? []), meta])
              open(meta.id)
            } catch {
              setError('No se pudo crear el binder.')
            }
          }}
          onRename={(id, name) => {
            const b = binders.find((x) => x.id === id)
            if (b) update({ ...b, name })
          }}
          onDelete={async (id) => {
            try {
              await deleteBinder(id)
              const rest = binders.filter((b) => b.id !== id)
              setBinders(rest)
              if (id === binder.id) open(rest[0].id)
            } catch {
              setError('No se pudo borrar el binder.')
            }
          }}
        />
      )}
    </>
  )
}
