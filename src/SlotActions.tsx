'use client'

import { useState } from 'react'

interface Props {
  /** Nombre de la carta, para la confirmación de quitar. Sin nombre, es una foto. */
  name?: string
  onMove: () => void
  onChange: () => void
  onRemove: () => void
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Barra inferior del detalle de una carta: mover, cambiar y quitar (con confirmación). */
export default function SlotActions({ name, onMove, onChange, onRemove }: Props) {
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <nav className="detail-bar" aria-label="Acciones de la carta">
        <button onClick={onMove}>
          {icon('M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20')}
          Mover
        </button>
        <button onClick={onChange}>
          {icon('M4 7h13l-3-3M20 17H7l3 3')}
          Cambiar
        </button>
        <button className="danger-text" onClick={() => setConfirm(true)}>
          {icon('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')}
          Quitar
        </button>
      </nav>

      {confirm && (
        <div className="viewer action-backdrop" onClick={() => setConfirm(false)}>
          <div className="action-sheet" role="dialog" aria-label="Quitar carta" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">{name ? `¿Quitar “${name}”?` : '¿Quitar esta foto?'}</p>
            <p className="sheet-text">El casillero queda vacío.</p>
            <button className="sheet-danger" onClick={onRemove}>
              Sí, quitar del binder
            </button>
            <button className="sheet-cancel" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
