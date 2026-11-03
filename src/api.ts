// Cliente de la API pública de TCGdex (https://tcgdex.dev): gratis, sin clave y con cartas en español.

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
export const imageUrl = (image: string, quality: 'low' | 'high') => `${image}/${quality}.webp`

async function searchIn(name: string, lang: Lang, perPage: number, signal?: AbortSignal): Promise<CardBrief[]> {
  const params = new URLSearchParams({
    name: `like:${name}`,
    'pagination:page': '1',
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
async function searchTranslated(query: string, lang: Lang, perPage: number, signal?: AbortSignal): Promise<CardBrief[]> {
  const t = await translateQuery(query, lang).catch(() => null)
  const terms = [...new Set([...(t?.names ?? []), ...(t?.exact ? [] : [query])])]
  const per = Math.max(10, Math.ceil(perPage / terms.length))
  const settled = await Promise.allSettled(terms.map((term) => searchIn(term, lang, per, signal)))
  const ok = settled.filter((r): r is PromiseFulfilledResult<CardBrief[]> => r.status === 'fulfilled')
  if (ok.length === 0) throw (settled[0] as PromiseRejectedResult).reason
  const seen = new Set<string>()
  let cards = ok.flatMap((r) => r.value).filter((c) => !seen.has(c.id) && seen.add(c.id))
  if (t?.suffix) {
    // "sylveon ex": se traduce "sylveon" y se dejan las cartas que además dicen "ex".
    const withSuffix = cards.filter((c) => normalize(c.name).includes(t.suffix))
    if (withSuffix.length) cards = withSuffix
  }
  return cards
}

/**
 * Busca cartas por nombre. El nombre del Pokémon se traduce solo al idioma de las
 * cartas, así "Sylveon" encuentra ニンフィア en japonés. Con "any" consulta todos los
 * idiomas en paralelo y junta los resultados (los idiomas que fallan se ignoran; si
 * fallan todos, es un error).
 */
export async function searchCards(name: string, lang: LangChoice, signal?: AbortSignal): Promise<CardBrief[]> {
  if (lang !== 'any') return searchTranslated(name, lang, 60, signal)
  const settled = await Promise.allSettled(LANGS.map((l) => searchTranslated(name, l.code, 30, signal)))
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const ok = settled.filter((r): r is PromiseFulfilledResult<CardBrief[]> => r.status === 'fulfilled')
  if (ok.length === 0) throw new Error('No se pudo buscar')
  return ok.flatMap((r) => r.value)
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
