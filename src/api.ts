// Cliente de la API pública de TCGdex (https://tcgdex.dev): gratis, sin clave y con cartas en español.

import type { CardRef } from './db'

const BASE = 'https://api.tcgdex.net/v2'

export type Lang = 'es' | 'en'

export interface CardBrief {
  id: string
  localId: string
  name: string
  image?: string
}

interface CardFull extends CardBrief {
  rarity?: string
  set?: { id: string; name: string }
}

/** URL de imagen lista para usar. `image` es la URL base que devuelve la API. */
export const imageUrl = (image: string, quality: 'low' | 'high') => `${image}/${quality}.webp`

export async function searchCards(name: string, lang: Lang, signal?: AbortSignal): Promise<CardBrief[]> {
  const params = new URLSearchParams({
    name: `like:${name}`,
    'pagination:page': '1',
    'pagination:itemsPerPage': '60',
  })
  const res = await fetch(`${BASE}/${lang}/cards?${params}`, { signal })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`TCGdex respondió ${res.status}`)
  const data = (await res.json()) as CardBrief[]
  return Array.isArray(data) ? data : []
}

/** Trae los datos completos de una carta para guardarla en el binder. */
export async function fetchCardRef(brief: CardBrief, lang: Lang): Promise<CardRef> {
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
