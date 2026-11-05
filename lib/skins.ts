// Skins: cambian los colores y la decoración de toda la app. Los colores de
// cada skin están en app/globals.css ([data-skin='...']).

export interface Skin {
  id: string
  label: string
  hint: string
  /** Color de la barra del sistema (meta theme-color), en modo oscuro y claro. */
  theme: string
  lightTheme: string
}

export const SKINS: Skin[] = [
  { id: 'clasico', label: 'Clásico', hint: 'Morado y dorado', theme: '#1b1530', lightTheme: '#f4f1fb' },
  { id: 'pikachu', label: 'Pikachu', hint: 'Amarillo con rayos', theme: '#1d1708', lightTheme: '#fff8dc' },
  { id: 'sylveon', label: 'Sylveon', hint: 'Rosa con lazos', theme: '#22132a', lightTheme: '#fff0f6' },
  { id: 'snorlax', label: 'Snorlax', hint: 'Turquesa con Zzz', theme: '#0f2128', lightTheme: '#eaf4f2' },
]

export const DEFAULT_SKIN = 'clasico'

export const isSkin = (id: unknown): id is string => typeof id === 'string' && SKINS.some((s) => s.id === id)

/** Fondo oscuro (el de siempre) o claro. Funciona con cualquier skin. */
export type Mode = 'dark' | 'light'

export const DEFAULT_MODE: Mode = 'dark'

export const isMode = (m: unknown): m is Mode => m === 'dark' || m === 'light'

export const SKIN_KEY = 'ohmycard:skin'
export const MODE_KEY = 'ohmycard:mode'

/** Aplica el skin y el modo a la página y los recuerda en este teléfono para la próxima carga. */
export function applySkin(id: string, mode: Mode = DEFAULT_MODE) {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0]
  const root = document.documentElement
  root.dataset.skin = skin.id
  root.dataset.mode = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? skin.lightTheme : skin.theme)
  try {
    localStorage.setItem(SKIN_KEY, skin.id)
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* sin almacenamiento */
  }
}

/** Script que corre antes de pintar, para que no se vea el skin clásico un instante. */
export const EARLY_SKIN_SCRIPT = `try{var d=document.documentElement,s=localStorage.getItem('${SKIN_KEY}'),m=localStorage.getItem('${MODE_KEY}');if(s)d.dataset.skin=s;if(m)d.dataset.mode=m}catch(e){}`
