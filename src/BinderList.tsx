'use client'

import { useEffect, useState } from 'react'
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
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    listBinders()
      .then((list) => setCounts(new Map(list.map((b) => [b.id, b.cardCount ?? 0]))))
      .catch(() => {})
  }, [binders])

  const create = () => {
    const name = newName.trim()
    if (!name) return
    onCreate(name)
    setNewName('')
  }

  return (
    <div className="sheet-screen" role="dialog" aria-label="Mis binders">
      <header className="list-top">
        <h1>Mis binders</h1>
        <button className="done" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <ul className="binder-list">
        {binders.map((b) => {
          const n = counts.get(b.id) ?? 0
          return (
            <li key={b.id} className={b.id === currentId ? 'current' : ''}>
              {editing === b.id ? (
                <input
                  className="name-input"
                  autoFocus
                  defaultValue={b.name}
                  maxLength={40}
                  onBlur={(e) => {
                    onRename(b.id, e.target.value.trim() || b.name)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button className="binder-open" onClick={() => onOpen(b.id)}>
                  <span className="binder-name">{b.name}</span>
                  <span className="binder-info">
                    {n} {n === 1 ? 'carta' : 'cartas'} · {b.pageCount} {b.pageCount === 1 ? 'página' : 'páginas'}
                  </span>
                </button>
              )}
              <div className="binder-actions">
                <button onClick={() => setEditing(b.id)}>Renombrar</button>
                {binders.length > 1 &&
                  (confirmDelete === b.id ? (
                    <button className="danger-text" onClick={() => onDelete(b.id)}>
                      ¿Borrar todo?
                    </button>
                  ) : (
                    <button className="danger-text" onClick={() => setConfirmDelete(b.id)}>
                      Borrar
                    </button>
                  ))}
              </div>
            </li>
          )
        })}
      </ul>

      <form
        className="new-binder"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <input
          className="search-input"
          placeholder="Nombre del nuevo binder"
          maxLength={40}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="primary" disabled={!newName.trim()}>
          Crear
        </button>
      </form>

      <footer className="account">
        <span>{userEmail}</span>
        <button className="link" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </footer>
    </div>
  )
}
