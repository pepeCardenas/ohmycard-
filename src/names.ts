// Traduce nombres de Pokémon entre idiomas para que la búsqueda encuentre cartas
// aunque el nombre se escriba en otro idioma (ej. "Sylveon" → ニンフィア en japonés).
// Los nombres vienen del paquete `pokemon` (MIT, https://github.com/sindresorhus/pokemon).

import type { Lang } from './api'

type Col = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ko' | 'zh-hant' | 'th'
type Table = Record<Col, string[]>

/** Columna de la tabla que usa cada idioma de cartas. Italiano, portugués e indonesio usan los nombres en inglés. */
const COLUMN: Record<Lang, Col> = {
  es: 'es',
  en: 'en',
  fr: 'fr',
  de: 'de',
  it: 'en',
  pt: 'en',
  ja: 'ja',
  ko: 'ko',
  'zh-tw': 'zh-hant',
  id: 'en',
  th: 'th',
}

let table: Promise<{ names: Table; index: string[][] }> | null = null

function loadTable() {
  table ??= import('./pokemon-names.json').then((m) => {
    const names = (m.default ?? m) as Table
    const cols = Object.values(names)
    const index = names.en.map((_, i) => [...new Set(cols.map((c) => normalize(c[i])))])
    return { names, index }
  })
  return table
}

/** Minúsculas, sin acentos ni signos, y hiragana pasado a katakana. */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[\s'’.\-:]/g, '')
}

export interface Translation {
  /** Nombres a buscar en el idioma de destino. */
  names: string[]
  /** Lo que el usuario escribió después del nombre del Pokémon (ej. "ex", "V"), ya normalizado. */
  suffix: string
  /** true si lo escrito es exactamente el nombre de un Pokémon. */
  exact: boolean
}

/**
 * Busca qué Pokémon escribió el usuario (en cualquier idioma) y devuelve sus nombres
 * en `lang`. Coincidencia exacta primero, después por comienzo y, con 3+ letras, por contenido.
 * También reconoce "nombre + sufijo", como "sylveon ex".
 */
export async function translateQuery(query: string, lang: Lang, max = 4): Promise<Translation | null> {
  const q = normalize(query)
  if (!q) return null
  const { names, index } = await loadTable()
  const col = names[COLUMN[lang]]

  const pick = (ids: number[]) => [...new Set(ids.slice(0, max).map((i) => col[i]))]

  const exact: number[] = []
  const prefix: number[] = []
  const contains: number[] = []
  index.forEach((variants, i) => {
    if (variants.includes(q)) exact.push(i)
    else if (variants.some((v) => v.startsWith(q))) prefix.push(i)
    else if (q.length >= 3 && variants.some((v) => v.includes(q))) contains.push(i)
  })
  if (exact.length) return { names: pick(exact), suffix: '', exact: true }

  // "sylveon ex": el nombre completo de un Pokémon al comienzo y algo más después.
  let best = -1
  let bestLen = 0
  index.forEach((variants, i) => {
    for (const v of variants) {
      if (v.length > bestLen && q.startsWith(v)) {
        best = i
        bestLen = v.length
      }
    }
  })
  if (best >= 0 && bestLen >= 3) return { names: [col[best]], suffix: q.slice(bestLen), exact: false }

  const byLength = (a: number, b: number) => names.en[a].length - names.en[b].length
  const partial = [...prefix.sort(byLength), ...contains.sort(byLength)]
  return partial.length ? { names: pick(partial), suffix: '', exact: false } : null
}
