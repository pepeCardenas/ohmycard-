'use client'

import { useEffect, useRef, useState } from 'react'
import { BINDER_COLORS, binderColor, binderColorStyle } from '@/lib/binderColors'
import { type Mode, SKINS } from '@/lib/skins'
import { type BinderMeta, type CollectionMeta, listBinders, listCollections } from './store'

export type Kind = 'binder' | 'collection'

interface Props {
  binders: BinderMeta[]
  collections: CollectionMeta[]
  current: { kind: Kind; id: string }
  onOpen: (kind: Kind, id: string) => void
  onCreate: (kind: Kind, name: string) => void
  onRename: (kind: Kind, id: string, name: string) => void
  onColor: (id: string, color: string) => void
  onDelete: (kind: Kind, id: string) => void
  onClose: () => void
  userEmail: string
  onSignOut: () => void
  skin: string
  onSkin: (id: string) => void
  mode: Mode
  onMode: (mode: Mode) => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Miniatura de la primera página: una hoja 3x3 como la del binder. */
function Cover({ preview, color }: { preview?: (string | null)[]; color?: string }) {
  const cells = preview ?? Array(9).fill(null)
  return (
    <div className="cover" aria-hidden="true" style={binderColorStyle(color)}>
      {cells.map((src, i) => (
        <span key={i} className="cover-slot">
          {src && <img src={src} alt="" loading="lazy" draggable={false} />}
        </span>
      ))}
    </div>
  )
}

/** Portada de una colección: las últimas 4 cartas agregadas. */
function Stack({ preview }: { preview?: string[] }) {
  const cells = Array.from({ length: 4 }, (_, i) => preview?.[i] ?? null)
  return (
    <div className="cover stack" aria-hidden="true">
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
  collections,
  current,
  onOpen,
  onCreate,
  onRename,
  onColor,
  onDelete,
  onClose,
  userEmail,
  onSignOut,
  skin,
  onSkin,
  mode,
  onMode,
}: Props) {
  // Conteos y miniaturas frescos (pueden haber cambiado desde que se abrió la app)
  const [fresh, setFresh] = useState<Map<string, BinderMeta>>(new Map())
  const [freshCols, setFreshCols] = useState<Map<string, CollectionMeta>>(new Map())
  const [tab, setTab] = useState<Kind>(current.kind)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [choosingSkin, setChoosingSkin] = useState(false)
  const newInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listBinders()
      .then((list) => setFresh(new Map(list.map((b) => [b.id, b]))))
      .catch(() => {})
  }, [binders])

  useEffect(() => {
    listCollections()
      .then((list) => setFreshCols(new Map(list.map((c) => [c.id, c]))))
      .catch(() => {})
  }, [collections])

  useEffect(() => {
    if (creating) newInput.current?.focus()
  }, [creating])

  const info = (b: BinderMeta) => ({ ...b, ...fresh.get(b.id), name: b.name, pageCount: b.pageCount, color: b.color })
  const colInfo = (c: CollectionMeta) => ({ ...c, ...freshCols.get(c.id), name: c.name })
  const totalCards =
    tab === 'binder'
      ? binders.reduce((n, b) => n + (info(b).cardCount ?? 0), 0)
      : collections.reduce((n, c) => n + (colInfo(c).cardCount ?? 0), 0)

  const create = () => {
    const name = newName.trim()
    if (!name) return
    onCreate(tab, name)
    setNewName('')
    setCreating(false)
  }

  const closeMenu = () => {
    setMenuFor(null)
    setRenaming(false)
    setConfirmDelete(false)
  }

  // Elemento del menú ⋯ (binder o colección, según la pestaña)
  const menuBinder: { id: string; name: string } | undefined = menuFor
    ? tab === 'binder'
      ? binders.find((b) => b.id === menuFor)
      : collections.find((c) => c.id === menuFor)
    : undefined
  const menuCards = menuBinder
    ? tab === 'binder'
      ? (info(menuBinder as BinderMeta).cardCount ?? 0)
      : (colInfo(menuBinder as CollectionMeta).cardCount ?? 0)
    : 0
  const canDelete = tab === 'collection' || binders.length > 1
  const noun = tab === 'binder' ? 'binder' : 'colección'

  return (
    <div className="sheet-screen binders-screen" role="dialog" aria-label="Mis binders">
      <header className="list-top">
        <div className="list-title">
          <h1>{tab === 'binder' ? 'Mis binders' : 'Mis colecciones'}</h1>
          <p>
            {tab === 'binder'
              ? plural(binders.length, 'binder', 'binders')
              : plural(collections.length, 'colección', 'colecciones')}{' '}
            · {plural(totalCards, 'carta', 'cartas')}
          </p>
        </div>
        <div className="list-actions">
          <button className="skin-btn" onClick={() => setChoosingSkin(true)} aria-label="Cambiar skin y fondo">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="7.5" cy="11" r="1.4" fill="currentColor" />
              <circle cx="10.5" cy="7.5" r="1.4" fill="currentColor" />
              <circle cx="15" cy="7.8" r="1.4" fill="currentColor" />
            </svg>
            Skin
          </button>
          <button className="done" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {(['binder', 'collection'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={`tab${tab === k ? ' on' : ''}`}
            onClick={() => {
              setTab(k)
              setCreating(false)
            }}
          >
            {k === 'binder' ? 'Binders' : 'Colecciones'}
          </button>
        ))}
      </div>

      <div className="binder-scroll">
        <ul className="binder-grid">
          {tab === 'collection' &&
            collections.map((c) => {
              const meta = colInfo(c)
              const n = meta.cardCount ?? 0
              const isCurrent = current.kind === 'collection' && c.id === current.id
              return (
                <li key={c.id} className={`binder-card${isCurrent ? ' current' : ''}`}>
                  <button className="binder-open" onClick={() => onOpen('collection', c.id)} aria-label={`Abrir ${c.name}`}>
                    <Stack preview={meta.preview} />
                    <span className="binder-name">{c.name}</span>
                    <span className="binder-info">{plural(n, 'carta', 'cartas')}</span>
                    {isCurrent && <span className="badge">Abierta</span>}
                  </button>
                  <button className="binder-more" onClick={() => setMenuFor(c.id)} aria-label={`Opciones de ${c.name}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <circle cx="5" cy="12" r="2" fill="currentColor" />
                      <circle cx="12" cy="12" r="2" fill="currentColor" />
                      <circle cx="19" cy="12" r="2" fill="currentColor" />
                    </svg>
                  </button>
                </li>
              )
            })}
          {tab === 'binder' && binders.map((b) => {
            const meta = info(b)
            const n = meta.cardCount ?? 0
            const isCurrent = current.kind === 'binder' && b.id === current.id
            return (
              <li key={b.id} className={`binder-card${isCurrent ? ' current' : ''}`}>
                <button className="binder-open" onClick={() => onOpen('binder', b.id)} aria-label={`Abrir ${b.name}`}>
                  <Cover preview={meta.preview} color={b.color} />
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
                {tab === 'binder' ? 'Nuevo binder' : 'Nueva colección'}
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

      {choosingSkin && (
        <div className="viewer action-backdrop" onClick={() => setChoosingSkin(false)}>
          <div className="action-sheet" role="dialog" aria-label="Elegir skin" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Skin de la app</p>
            <p className="sheet-text">Cambia los colores y la decoración. Se guarda en tu cuenta.</p>
            <div className="mode-switch" role="radiogroup" aria-label="Fondo">
              {(
                [
                  ['dark', 'Oscuro'],
                  ['light', 'Claro'],
                ] as const
              ).map(([m, label]) => (
                <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => onMode(m)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="skin-grid" role="radiogroup" aria-label="Skin">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={skin === s.id}
                  className={`skin-option${skin === s.id ? ' on' : ''}`}
                  onClick={() => onSkin(s.id)}
                >
                  <span className="skin-preview" data-skin={s.id} data-mode={mode} aria-hidden="true">
                    <span className="mini-sheet">
                      {Array.from({ length: 9 }, (_, i) => (
                        <span key={i} />
                      ))}
                    </span>
                    <span className="mini-accent" />
                  </span>
                  <span className="skin-name">
                    {s.label}
                    <small>{s.hint}</small>
                  </span>
                </button>
              ))}
            </div>
            <button className="sheet-cancel" onClick={() => setChoosingSkin(false)}>
              Listo
            </button>
          </div>
        </div>
      )}

      {menuBinder && (
        <div className="viewer action-backdrop" onClick={closeMenu}>
          <div className="action-sheet" role="dialog" aria-label={`Opciones de ${menuBinder.name}`} onClick={(e) => e.stopPropagation()}>
            {renaming ? (
              <form
                className="sheet-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = e.currentTarget.elements.namedItem('name') as HTMLInputElement
                  onRename(tab, menuBinder.id, input.value.trim() || menuBinder.name)
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
                    : 'No tiene cartas. No se puede deshacer.'}
                </p>
                <button
                  className="sheet-danger"
                  onClick={() => {
                    onDelete(tab, menuBinder.id)
                    closeMenu()
                  }}
                >
                  Sí, borrar {noun}
                </button>
                <button className="sheet-cancel" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <p className="sheet-title">{menuBinder.name}</p>
                {tab === 'binder' && (
                  <div className="color-picker">
                    <span className="sheet-label">Color del binder</span>
                    <div className="swatches" role="radiogroup" aria-label="Color del binder">
                      {BINDER_COLORS.map((c) => {
                        const on = binderColor((menuBinder as BinderMeta).color).id === c.id
                        return (
                          <button
                            key={c.id}
                            role="radio"
                            aria-checked={on}
                            aria-label={c.label}
                            title={c.label}
                            className={`swatch${on ? ' on' : ''}`}
                            style={{
                              background:
                                c.id === 'morado'
                                  ? 'linear-gradient(160deg, var(--sheet-edge), var(--sheet))'
                                  : `linear-gradient(160deg, ${c.edge}, ${c.base})`,
                            }}
                            onClick={() => onColor(menuBinder.id, c.id)}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
                <button
                  className="sheet-option"
                  onClick={() => {
                    onOpen(tab, menuBinder.id)
                    closeMenu()
                  }}
                >
                  Abrir
                </button>
                <button className="sheet-option" onClick={() => setRenaming(true)}>
                  Renombrar
                </button>
                {canDelete ? (
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
