// Skins: cambian los colores y la decoración de toda la app. Los colores de
// cada skin están en app/globals.css ([data-skin='...']).

export interface Skin {
  id: string
  label: string
  hint: string
  /** Color de la barra del sistema (meta theme-color). */
  theme: string
}

export const SKINS: Skin[] = [
  { id: 'clasico', label: 'Clásico', hint: 'Morado y dorado', theme: '#1b1530' },
  { id: 'pikachu', label: 'Pikachu', hint: 'Amarillo con rayos', theme: '#1d1708' },
  { id: 'sylveon', label: 'Sylveon', hint: 'Rosa con lazos', theme: '#22132a' },
  { id: 'snorlax', label: 'Snorlax', hint: 'Turquesa con Zzz', theme: '#0f2128' },
]

export const DEFAULT_SKIN = 'clasico'

export const isSkin = (id: unknown): id is string => typeof id === 'string' && SKINS.some((s) => s.id === id)

export const SKIN_KEY = 'ohmycard:skin'

/** Aplica el skin a la página y lo recuerda en este teléfono para la próxima carga. */
export function applySkin(id: string) {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0]
  document.documentElement.dataset.skin = skin.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', skin.theme)
  try {
    localStorage.setItem(SKIN_KEY, skin.id)
  } catch {
    /* sin almacenamiento */
  }
}

/** Script que corre antes de pintar, para que no se vea el skin clásico un instante. */
export const EARLY_SKIN_SCRIPT = `try{var s=localStorage.getItem('${SKIN_KEY}');if(s)document.documentElement.dataset.skin=s}catch(e){}`
