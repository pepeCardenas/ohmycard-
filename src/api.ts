// Cliente de la API pública de TCGdex (https://tcgdex.dev): gratis, sin clave y con cartas en español.

import { cardImageUrl } from './cardImage'
import { normalize, translateQuery } from './names'
import type { CardRef } from './store'

const BASE = 'https://api.tcgdex.net/v2'

/** Idiomas de cartas que ofrece TCGdex. */
export const LANGS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-tw', label: '中文 (繁體)' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'th', label: 'ไทย' },
] as const

export type Lang = (typeof LANGS)[number]['code']
/** "any" busca en todos los idiomas a la vez. */
export type LangChoice = Lang | 'any'

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v)

export interface CardBrief {
  id: string
  localId: string
  name: string
  image?: string
  /** Idioma de la versión encontrada. */
  lang: Lang
}

interface CardFull extends CardBrief {
  rarity?: string
  set?: { id: string; name: string }
}

/** URL de imagen lista para usar. `image` es la URL base que devuelve la API. */
export const imageUrl = cardImageUrl

/** Por qué campo se busca: nombre de la carta o ilustrador. */
export type SearchBy = 'name' | 'illustrator'

async function searchIn(
  name: string,
  lang: Lang,
  perPage: number,
  signal?: AbortSignal,
  by: SearchBy = 'name',
  page = 1,
): Promise<CardBrief[]> {
  const params = new URLSearchParams({
    [by]: `like:${name}`,
    'pagination:page': String(page),
    'pagination:itemsPerPage': String(perPage),
  })
  const res = await fetch(`${BASE}/${lang}/cards?${params}`, { signal })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status}`)
  const data = (await res.json()) as Omit<CardBrief, 'lang'>[]
  return Array.isArray(data) ? data.map((c) => ({ ...c, lang })) : []
}

/**
 * Busca en un idioma probando el nombre traducido del Pokémon (si se reconoce) y lo
 * que escribió el usuario, sin repetir cartas.
 */
async function searchTranslated(
  query: string,
  lang: Lang,
  perPage: number,
  signal?: AbortSignal,
  page = 1,
): Promise<SearchPage> {
  const t = await translateQuery(query, lang).catch(() => null)
  const terms = [...new Set([...(t?.names ?? []), ...(t?.exact ? [] : [query])])]
  const per = Math.max(10, Math.ceil(perPage / terms.length))
  const settled = await Promise.allSettled(terms.map((term) => searchIn(term, lang, per, signal, 'name', page)))
  const ok = settled.filter((r): r is PromiseFulfilledResult<CardBrief[]> => r.status === 'fulfilled')
  if (ok.length === 0) throw (settled[0] as PromiseRejectedResult).reason
  const more = ok.some((r) => r.value.length >= per)
  const seen = new Set<string>()
  let cards = ok.flatMap((r) => r.value).filter((c) => !seen.has(c.id) && seen.add(c.id))
  if (t?.suffix) {
    // "sylveon ex": se traduce "sylveon" y se dejan las cartas que además dicen "ex".
    const withSuffix = cards.filter((c) => normalize(c.name).includes(t.suffix))
    if (withSuffix.length) cards = withSuffix
  }
  return { cards, more }
}

/** Una página de resultados; `more` indica si puede haber más. */
export interface SearchPage {
  cards: CardBrief[]
  more: boolean
}

/**
 * Busca cartas por nombre o ilustrador, de a páginas (`page` empieza en 1). El nombre del
 * Pokémon se traduce solo al idioma de las cartas, así "Sylveon" encuentra ニンフィア en
 * japonés. Con "any" consulta todos los idiomas en paralelo y junta los resultados (los
 * idiomas que fallan se ignoran; si fallan todos, es un error).
 */
export async function searchCards(
  name: string,
  lang: LangChoice,
  signal?: AbortSignal,
  by: SearchBy = 'name',
  page = 1,
): Promise<SearchPage> {
  // Los nombres de ilustradores no se traducen: se buscan tal cual en cada idioma.
  const one = async (l: Lang, perPage: number): Promise<SearchPage> => {
    if (by !== 'illustrator') return searchTranslated(name, l, perPage, signal, page)
    const cards = await searchIn(name, l, perPage, signal, 'illustrator', page)
    return { cards, more: cards.length >= perPage }
  }
  if (lang !== 'any') return one(lang, 60)
  const settled = await Promise.allSettled(LANGS.map((l) => one(l.code, 30)))
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const ok = settled.filter((r): r is PromiseFulfilledResult<SearchPage> => r.status === 'fulfilled')
  if (ok.length === 0) throw new Error('No se pudo buscar')
  return { cards: ok.flatMap((r) => r.value.cards), more: ok.some((r) => r.value.more) }
}

/** Idiomas donde se busca la imagen de una carta que no la tiene en el suyo. */
const IMAGE_FALLBACK: Lang[] = ['en', 'fr', 'de', 'it', 'pt']
const fallbackCache = new Map<string, Promise<string | undefined>>()

/**
 * A algunas cartas les falta la imagen en un idioma (pasa mucho en español). La carta tiene el
 * mismo id en los otros idiomas, así que se usa la imagen de la primera versión que la tenga.
 */
export function fallbackImage(
  id: string,
  lang: Lang,
  card?: { name: string; localId: string },
): Promise<string | undefined> {
  const key = id
  let hit = fallbackCache.get(key)
  if (!hit) {
    hit = (async () => {
      for (const l of IMAGE_FALLBACK) {
        if (l === lang) continue
        try {
          const res = await fetch(`${BASE}/${l}/cards/${encodeURIComponent(id)}`)
          if (!res.ok) continue
          const card = (await res.json()) as { image?: string }
          if (card.image) return card.image
        } catch {
          // probar el siguiente idioma
        }
      }
      return card ? pokemonTcgImage(id, card.name, card.localId, lang).catch(() => undefined) : undefined
    })()
    fallbackCache.set(key, hit)
  }
  return hit
}

/** Id de set de TCGdex en el formato de pokemontcg.io: "sv02" → "sv2", "swsh12.5" → "swsh12pt5". */
const ptcgSetId = (cardId: string, localId: string) =>
  cardId
    .slice(0, cardId.length - localId.length - 1)
    .toLowerCase()
    .replace(/\.5/g, 'pt5')
    .replace(/([a-z])0+(\d)/g, '$1$2')

/**
 * Último recurso: la imagen en pokemontcg.io (sólo cartas en inglés). Se busca por nombre en
 * inglés y número; si hay varias, se elige la del mismo set y si no se puede saber, ninguna
 * (mejor sin imagen que con la de otra carta).
 */
async function pokemonTcgImage(id: string, name: string, localId: string, lang: Lang): Promise<string | undefined> {
  const number = localId.replace(/^0+(?=\d)/, '')
  let english = name
  if (lang !== 'en') {
    const t = await translateQuery(name, 'en', 1).catch(() => null)
    if (t?.names.length) english = t.suffix ? `${t.names[0]} ${t.suffix}` : t.names[0]
  }
  const q = `name:"${english.replace(/"/g, '')}" number:${number}`
  const params = new URLSearchParams({ q, select: 'id,set,images', pageSize: '20' })
  const res = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`)
  if (!res.ok) return undefined
  const { data } = (await res.json()) as { data?: { id: string; set: { id: string }; images?: { small?: string } }[] }
  if (!data?.length) return undefined
  const set = ptcgSetId(id, localId)
  const match = data.find((c) => c.set.id.toLowerCase() === set) ?? (data.length === 1 ? data[0] : undefined)
  const img = match?.images?.small
  return img?.startsWith('https://images.pokemontcg.io/') ? img : undefined
}

/** Trae los datos completos de una carta para guardarla en el binder. */
export async function fetchCardRef(brief: CardBrief): Promise<CardRef> {
  const lang = brief.lang
  const ref: CardRef = { kind: 'card', id: brief.id, lang, name: brief.name, image: brief.image, localId: brief.localId }
  try {
    const res = await fetch(`${BASE}/${lang}/cards/${encodeURIComponent(brief.id)}`)
    if (res.ok) {
      const full = (await res.json()) as CardFull
      ref.setName = full.set?.name
      ref.rarity = full.rarity
      ref.image = full.image ?? ref.image
    }
  } catch {
    // Sin detalle igual se guarda la carta con nombre e imagen.
  }
  if (!ref.image) ref.image = await fallbackImage(brief.id, lang, brief)
  return ref
}

// --- Detalle completo y precios -----------------------------------------------

export interface TcgplayerVariant {
  lowPrice?: number
  midPrice?: number
  highPrice?: number
  marketPrice?: number
  directLowPrice?: number
}

export interface Pricing {
  cardmarket?: { updated?: string; unit?: string } & Record<string, number | string | undefined>
  tcgplayer?: { updated?: string; unit?: string } & Record<string, TcgplayerVariant | string | undefined>
}

export interface CardDetail {
  id: string
  localId: string
  name: string
  image?: string
  category?: string
  illustrator?: string
  rarity?: string
  hp?: number
  types?: string[]
  stage?: string
  evolveFrom?: string
  description?: string
  regulationMark?: string
  retreat?: number
  set?: { id: string; name: string; cardCount?: { official?: number; total?: number } }
  attacks?: { name: string; cost?: string[]; damage?: string | number; effect?: string }[]
  weaknesses?: { type: string; value?: string }[]
  pricing?: Pricing | null
}

const detailCache = new Map<string, Promise<CardDetail>>()

async function getCard(id: string, lang: string): Promise<CardDetail> {
  const res = await fetch(`${BASE}/${lang}/cards/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status}`)
  return (await res.json()) as CardDetail
}

/**
 * Datos completos de una carta con sus precios. Si la versión en el idioma
 * elegido no trae precios, los toma de la versión en inglés (mismo id).
 */
export function fetchCardDetail(id: string, lang: string): Promise<CardDetail> {
  const key = `${lang}:${id}`
  let p = detailCache.get(key)
  if (!p) {
    p = (async () => {
      const card = await getCard(id, lang)
      if (!card.pricing && lang !== 'en') {
        try {
          card.pricing = (await getCard(id, 'en')).pricing
        } catch {
          /* sin precios en inglés tampoco */
        }
      }
      return card
    })()
    p.catch(() => detailCache.delete(key))
    detailCache.set(key, p)
  }
  return p
}
