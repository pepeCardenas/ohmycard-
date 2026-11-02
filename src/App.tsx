import { useEffect, useState } from 'react'
import BinderList from './BinderList'
import BinderView from './BinderView'
import { type BinderMeta, createBinder, deleteBinder, listBinders, requestPersistence, saveBinder } from './db'

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

export default function App() {
  const [binders, setBinders] = useState<BinderMeta[] | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    requestPersistence()
    listBinders()
      .then((list) => {
        setBinders(list)
        const saved = readCurrent()
        setCurrentId(list.some((b) => b.id === saved) ? saved : list[0].id)
      })
      .catch(() => setError('No se pudo abrir el almacenamiento del navegador.'))
  }, [])

  const open = (id: string) => {
    setCurrentId(id)
    writeCurrent(id)
    setShowList(false)
  }

  const update = (meta: BinderMeta) => {
    setBinders((list) => list?.map((b) => (b.id === meta.id ? meta : b)) ?? null)
    saveBinder(meta)
  }

  const binder = binders?.find((b) => b.id === currentId)
  if (!binders || !binder) {
    return <div className="loading">{error ?? 'Abriendo tu binder…'}</div>
  }

  return (
    <>
      <BinderView key={binder.id} binder={binder} onChange={update} onOpenList={() => setShowList(true)} />
      {showList && (
        <BinderList
          binders={binders}
          currentId={binder.id}
          onOpen={open}
          onClose={() => setShowList(false)}
          onCreate={async (name) => {
            const meta = await createBinder(name)
            setBinders((list) => [...(list ?? []), meta])
            open(meta.id)
          }}
          onRename={(id, name) => {
            const b = binders.find((x) => x.id === id)
            if (b) update({ ...b, name })
          }}
          onDelete={async (id) => {
            await deleteBinder(id)
            const rest = binders.filter((b) => b.id !== id)
            setBinders(rest)
            if (id === binder.id) open(rest[0].id)
          }}
        />
      )}
    </>
  )
}
