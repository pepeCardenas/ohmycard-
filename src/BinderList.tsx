'use client'

import { useEffect, useRef, useState } from 'react'
import { type BinderMeta, listBinders } from './store'

interface Props {
  binders: BinderMeta[]
  currentId: string
  onOpen: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
  userEmail: string
  onSignOut: () => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Miniatura de la primera página: una hoja 3x3 como la del binder. */
function Cover({ preview }: { preview?: (string | null)[] }) {
  const cells = preview ?? Array(9).fill(null)
  return (
    <div className="cover" aria-hidden="true">
      {cells.map((src, i) => (
        <span key={i} className="cover-slot">
          {src && <img src={src} alt="" loading="lazy" draggable={false} />}
        </span>
      ))}
    </div>
  )
}

export default function BinderList({
  binders,
  currentId,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onClose,
  userEmail,
  onSignOut,
}: Props) {
  // Conteos y miniaturas frescos (pueden haber cambiado desde que se abrió la app)
  const [fresh, setFresh] = useState<Map<string, BinderMeta>>(new Map())
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const newInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listBinders()
      .then((list) => setFresh(new Map(list.map((b) => [b.id, b]))))
      .catch(() => {})
  }, [binders])

  useEffect(() => {
    if (creating) newInput.current?.focus()
  }, [creating])

  const info = (b: BinderMeta) => ({ ...b, ...fresh.get(b.id), name: b.name, pageCount: b.pageCount })
  const totalCards = binders.reduce((n, b) => n + (info(b).cardCount ?? 0), 0)

  const create = () => {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName('')
    setCreating(false)
  }

  const closeMenu = () => {
    setMenuFor(null)
    setRenaming(false)
    setConfirmDelete(false)
  }

  const menuBinder = menuFor ? binders.find((b) => b.id === menuFor) : undefined
  const menuCards = menuBinder ? (info(menuBinder).cardCount ?? 0) : 0

  return (
    <div className="sheet-screen binders-screen" role="dialog" aria-label="Mis binders">
      <header className="list-top">
        <div className="list-title">
          <h1>Mis binders</h1>
          <p>
            {plural(binders.length, 'binder', 'binders')} · {plural(totalCards, 'carta', 'cartas')}
          </p>
        </div>
        <button className="done" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <div className="binder-scroll">
        <ul className="binder-grid">
          {binders.map((b) => {
            const meta = info(b)
            const n = meta.cardCount ?? 0
            const isCurrent = b.id === currentId
            return (
              <li key={b.id} className={`binder-card${isCurrent ? ' current' : ''}`}>
                <button className="binder-open" onClick={() => onOpen(b.id)} aria-label={`Abrir ${b.name}`}>
                  <Cover preview={meta.preview} />
                  <span className="binder-name">{b.name}</span>
                  <span className="binder-info">
                    {plural(n, 'carta', 'cartas')} · {plural(b.pageCount, 'pág.', 'págs.')}
                  </span>
                  {isCurrent && <span className="badge">Abierto</span>}
                </button>
                <button
                  className="binder-more"
                  onClick={() => setMenuFor(b.id)}
                  aria-label={`Opciones de ${b.name}`}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <circle cx="5" cy="12" r="2" fill="currentColor" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <circle cx="19" cy="12" r="2" fill="currentColor" />
                  </svg>
                </button>
              </li>
            )
          })}

          <li className="binder-card new">
            {creating ? (
              <form
                className="new-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  create()
                }}
              >
                <input
                  ref={newInput}
                  className="search-input"
                  placeholder="Nombre"
                  maxLength={40}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
                />
                <button type="submit" className="primary" disabled={!newName.trim()}>
                  Crear
                </button>
                <button type="button" className="link" onClick={() => setCreating(false)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <button className="new-open" onClick={() => setCreating(true)}>
                <span className="new-plus">+</span>
                Nuevo binder
              </button>
            )}
          </li>
        </ul>
      </div>

      <footer className="account">
        <span className="avatar" aria-hidden="true">
          {userEmail.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-email">{userEmail}</span>
        <button className="link" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </footer>

      {menuBinder && (
        <div className="viewer action-backdrop" onClick={closeMenu}>
          <div className="action-sheet" role="dialog" aria-label={`Opciones de ${menuBinder.name}`} onClick={(e) => e.stopPropagation()}>
            {renaming ? (
              <form
                className="sheet-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = e.currentTarget.elements.namedItem('name') as HTMLInputElement
                  onRename(menuBinder.id, input.value.trim() || menuBinder.name)
                  closeMenu()
                }}
              >
                <label className="sheet-label" htmlFor="rename">
                  Nuevo nombre
                </label>
                <input id="rename" name="name" className="search-input" defaultValue={menuBinder.name} maxLength={40} autoFocus />
                <button type="submit" className="primary">
                  Guardar
                </button>
                <button type="button" className="sheet-cancel" onClick={() => setRenaming(false)}>
                  Cancelar
                </button>
              </form>
            ) : confirmDelete ? (
              <>
                <p className="sheet-title">¿Borrar “{menuBinder.name}”?</p>
                <p className="sheet-text">
                  {menuCards > 0
                    ? `Se borran sus ${plural(menuCards, 'carta', 'cartas')}. No se puede deshacer.`
                    : 'Está vacío. No se puede deshacer.'}
                </p>
                <button
                  className="sheet-danger"
                  onClick={() => {
                    onDelete(menuBinder.id)
                    closeMenu()
                  }}
                >
                  Sí, borrar binder
                </button>
                <button className="sheet-cancel" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <p className="sheet-title">{menuBinder.name}</p>
                <button
                  className="sheet-option"
                  onClick={() => {
                    onOpen(menuBinder.id)
                    closeMenu()
                  }}
                >
                  Abrir
                </button>
                <button className="sheet-option" onClick={() => setRenaming(true)}>
                  Renombrar
                </button>
                {binders.length > 1 ? (
                  <button className="sheet-option danger-text" onClick={() => setConfirmDelete(true)}>
                    Borrar
                  </button>
                ) : (
                  <p className="sheet-text">Es tu único binder, por eso no se puede borrar.</p>
                )}
                <button className="sheet-cancel" onClick={closeMenu}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
