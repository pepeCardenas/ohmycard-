// Colores para las hojas de un binder. Se usan en el binder abierto, en la
// miniatura de "Mis binders" y en la imagen para compartir.

export interface BinderColor {
  id: string
  label: string
  /** Degradado de la hoja: del borde claro (arriba a la izquierda) a la base. */
  edge: string
  base: string
  /** Fondo y borde de los bolsillos vacíos. */
  pocket: string
  pocketBorder: string
  /** Color del "+" de los casilleros vacíos. */
  plus: string
}

export const BINDER_COLORS: BinderColor[] = [
  { id: 'morado', label: 'Como el skin', edge: '#3a2f66', base: '#2c2350', pocket: 'rgba(255,255,255,0.06)', pocketBorder: 'rgba(255,255,255,0.14)', plus: '#a99fcc' },
  { id: 'rosa', label: 'Rosa', edge: '#f7a8cb', base: '#e0679f', pocket: 'rgba(255,255,255,0.2)', pocketBorder: 'rgba(255,255,255,0.55)', plus: '#ffffff' },
  { id: 'blanco', label: 'Blanco', edge: '#ffffff', base: '#e4e1ec', pocket: 'rgba(40,30,80,0.05)', pocketBorder: 'rgba(40,30,80,0.22)', plus: '#7b7398' },
  { id: 'negro', label: 'Negro', edge: '#2b2b30', base: '#0d0d0f', pocket: 'rgba(255,255,255,0.05)', pocketBorder: 'rgba(255,255,255,0.13)', plus: '#8a8a94' },
  { id: 'naranja', label: 'Naranja', edge: '#ffa04a', base: '#e2650f', pocket: 'rgba(255,255,255,0.18)', pocketBorder: 'rgba(255,255,255,0.5)', plus: '#ffffff' },
  { id: 'verde', label: 'Verde', edge: '#45b571', base: '#1d7442', pocket: 'rgba(255,255,255,0.12)', pocketBorder: 'rgba(255,255,255,0.32)', plus: '#e6f7ec' },
]

export const DEFAULT_BINDER_COLOR = 'morado'

export const isBinderColor = (id: unknown): id is string => typeof id === 'string' && BINDER_COLORS.some((c) => c.id === id)

export const binderColor = (id?: string | null): BinderColor =>
  BINDER_COLORS.find((c) => c.id === id) ?? BINDER_COLORS[0]

/** El color por defecto no pinta nada: la hoja toma los colores del skin elegido. */
export const followsSkin = (id?: string | null) => binderColor(id).id === DEFAULT_BINDER_COLOR

/** Variables CSS para pintar una hoja (.sheet) o una miniatura (.cover) con el color elegido. */
export function binderColorStyle(id?: string | null): Record<string, string> {
  if (followsSkin(id)) return {}
  const c = binderColor(id)
  return {
    '--sheet-edge': c.edge,
    '--sheet': c.base,
    '--sheet-pocket': c.pocket,
    '--sheet-pocket-border': c.pocketBorder,
    '--plus': c.plus,
  }
}

/** Colores con que se ve la hoja ahora (para dibujarla en la imagen para compartir). */
export function sheetColorNow(id?: string | null): BinderColor {
  if (!followsSkin(id) || typeof document === 'undefined') return binderColor(id)
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const c = binderColor(id)
  return {
    ...c,
    edge: v('--sheet-edge', c.edge),
    base: v('--sheet', c.base),
    pocket: v('--sheet-pocket', c.pocket),
    pocketBorder: v('--sheet-pocket-border', c.pocketBorder),
    plus: v('--plus', c.plus),
  }
}
