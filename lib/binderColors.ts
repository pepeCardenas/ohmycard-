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
  { id: 'morado', label: 'Morado', edge: '#3a2f66', base: '#2c2350', pocket: 'rgba(255,255,255,0.06)', pocketBorder: 'rgba(255,255,255,0.14)', plus: '#a99fcc' },
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

/** Variables CSS para pintar una hoja (.sheet) o una miniatura (.cover) con el color elegido. */
export function binderColorStyle(id?: string | null): Record<string, string> {
  const c = binderColor(id)
  return {
    '--leather-edge': c.edge,
    '--leather': c.base,
    '--pocket': c.pocket,
    '--pocket-border': c.pocketBorder,
    '--plus': c.plus,
  }
}
