'use client'

import { useEffect, useRef, useState } from 'react'
import { imageUrl } from './api'
import CardDetailView from './CardDetailView'
import { prepareCardImage } from './image'
import SearchSheet from './SearchSheet'
import SlotActions from './SlotActions'
import {
  type CardRef,
  type CollectionEntry,
  type CollectionMeta,
  type SlotItem,
  addToCollection,
  isCard,
  loadCollection,
  removeFromCollection,
  uploadPhoto,
} from './store'

interface Props {
  collection: CollectionMeta
  onOpenList: () => void
  /** Avisa cuántas cartas tiene, para la lista de colecciones. */
  onCount: (n: number) => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const srcOf = (item: SlotItem, quality: 'low' | 'high') =>
  isCard(item) ? (item.image ? imageUrl(item.image, quality) : undefined) : item.url

export default function CollectionView({ collection, onOpenList, onCount }: Props) {
  const [entries, setEntries] = useState<CollectionEntry[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [searching, setSearching] = useState(false)
  const [viewing, setViewing] = useState<CollectionEntry | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCollection(collection.id)
      .then(setEntries)
      .catch(() => setError('No se pudo cargar la colección. Revisa tu conexión.'))
  }, [collection.id])

  useEffect(() => {
    if (entries) onCount(entries.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries?.length])

  const addItems = async (items: SlotItem[]) => {
    const added = await addToCollection(collection.id, items)
    setEntries((list) => [...added, ...(list ?? [])])
  }

  const addCards = async (cards: CardRef[]) => {
    await addItems(cards)
    setSearching(false)
  }

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(null)
    let done = 0
    try {
      // De a una para no saturar el teléfono; se van mostrando a medida que suben
      for (const file of files) {
        setBusy(files.length > 1 ? `Subiendo ${done + 1} de ${files.length}…` : 'Subiendo foto…')
        await addItems([await uploadPhoto(await prepareCardImage(file))])
        done++
      }
    } catch {
      setError(
        done > 0
          ? `Se subieron ${done} de ${files.length} fotos. Prueba de nuevo con las que faltan.`
          : 'No se pudo cargar la foto. Prueba con JPG o PNG.',
      )
    } finally {
      setBusy(null)
    }
  }

  const remove = async (entry: CollectionEntry) => {
    try {
      await removeFromCollection(collection.id, entry.id)
      setEntries((list) => list?.filter((x) => x.id !== entry.id) ?? null)
      setViewing(null)
    } catch {
      setError('No se pudo quitar la carta.')
    }
  }

  const count = entries?.length ?? collection.cardCount ?? 0

  return (
    <div className="app collection-app">
      <header className="top">
        <div className="top-left">
          <button className="name" onClick={onOpenList} aria-label="Cambiar de colección">
            {collection.name} <span className="caret">▾</span>
          </button>
          <span className="count">
            {entries === null ? 'Cargando…' : `Colección · ${plural(count, 'carta', 'cartas')}`}
          </span>
        </div>
      </header>

      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <div className="collection-scroll">
        {entries && entries.length === 0 ? (
          <div className="collection-empty">
            <div className="empty-stack" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="empty-title">Tu colección está vacía</p>
            <p className="empty-text">Agrega cartas buscándolas, desde tu galería o sacándoles una foto.</p>
            <button className="primary empty-cta" onClick={() => setAdding(true)}>
              + Agregar cartas
            </button>
          </div>
        ) : (
          <ul className="collection-grid">
            {(entries ?? []).map((entry) => {
              const src = srcOf(entry.item, 'low')
              const name = isCard(entry.item) ? entry.item.name : 'Foto'
              return (
                <li key={entry.id}>
                  <button className="collection-card" onClick={() => setViewing(entry)} aria-label={`Ver ${name}`}>
                    {src ? <img src={src} alt="" loading="lazy" /> : <span className="noimg">{name}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {entries && entries.length > 0 && (
        <footer className="collection-bottom">
          <button className="primary add-cards" onClick={() => setAdding(true)}>
            + Agregar cartas
          </button>
        </footer>
      )}

      {busy && <div className="busy">{busy}</div>}

      {adding && (
        <div className="viewer action-backdrop" onClick={() => setAdding(false)}>
          <div className="action-sheet" role="dialog" aria-label="Agregar cartas" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Agregar a {collection.name}</p>
            <p className="sheet-text">Puedes elegir varias de una vez.</p>
            <button
              className="sheet-option big primary"
              onClick={() => {
                setAdding(false)
                setSearching(true)
              }}
            >
              <span className="opt-icon" aria-hidden="true">🔍</span>
              <span className="opt-text">
                Buscar cartas oficiales
                <small>Marca todas las que quieras</small>
              </span>
            </button>
            <button
              className="sheet-option big"
              onClick={() => {
                setAdding(false)
                galleryRef.current?.click()
              }}
            >
              <span className="opt-icon" aria-hidden="true">🖼️</span>
              <span className="opt-text">
                Elegir de la galería
                <small>Una o varias fotos</small>
              </span>
            </button>
            <button
              className="sheet-option big"
              onClick={() => {
                setAdding(false)
                cameraRef.current?.click()
              }}
            >
              <span className="opt-icon" aria-hidden="true">📷</span>
              <span className="opt-text">
                Sacar una foto
                <small>Con la cámara del teléfono</small>
              </span>
            </button>
            <button className="sheet-cancel" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {searching && (
        <SearchSheet
          targetLabel={`Van a ${collection.name}`}
          onAddMany={addCards}
          onClose={() => setSearching(false)}
        />
      )}

      {viewing && isCard(viewing.item) && (
        <CardDetailView
          card={viewing.item}
          where={collection.name}
          onRemove={() => remove(viewing)}
          onClose={() => setViewing(null)}
          removeNote="Se quita de la colección."
          removeLabel="Sí, quitar de la colección"
        />
      )}

      {viewing && !isCard(viewing.item) && (
        <div className="sheet-screen detail" role="dialog" aria-label="Foto de la carta">
          <header className="list-top">
            <div className="list-title">
              <h1>Tu foto</h1>
              <p>{collection.name}</p>
            </div>
            <button className="done" onClick={() => setViewing(null)}>
              Cerrar
            </button>
          </header>
          <div className="detail-body photo-body">
            <img className="detail-img photo" src={srcOf(viewing.item, 'high')} alt="Foto de la carta" />
          </div>
          <SlotActions
            onRemove={() => remove(viewing)}
            removeNote="Se quita de la colección."
            removeLabel="Sí, quitar de la colección"
          />
        </div>
      )}

      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
    </div>
  )
}
