// Validación de lo que se guarda en un casillero o en una colección.

/** Un casillero sólo puede tener una carta oficial o una foto, con campos conocidos. */
export function cleanItem(raw: unknown): Record<string, string | number> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (k: string, max = 300) => (typeof r[k] === 'string' ? (r[k] as string).slice(0, max) : undefined)
  if (r.kind === 'card') {
    const id = str('id', 80)
    const name = str('name', 120)
    if (!id || !name) return null
    const item: Record<string, string> = { kind: 'card', id, name, lang: str('lang', 5) ?? 'en' }
    for (const k of ['image', 'setName', 'localId', 'rarity']) {
      const v = str(k)
      if (v) item[k] = v
    }
    if (item.image && !item.image.startsWith('https://assets.tcgdex.net/')) delete item.image
    return item
  }
  if (r.kind === 'photo') {
    const url = str('url', 500)
    if (!url || !(url.startsWith('/api/photos/') || url.startsWith('https://'))) return null
    const item: Record<string, string | number> = { kind: 'photo', url }
    // Fotos grandes: 2 casilleros horizontal o vertical, o 2x2
    if (r.cols === 2) item.cols = 2
    if (r.rows === 2) item.rows = 2
    return item
  }
  return null
}

/** URL chica de la imagen de un casillero (carta oficial o foto). */
export function thumb(data: unknown): string | null {
  const d = data as { kind?: string; image?: string; url?: string }
  if (d?.kind === 'card') return d.image ? `${d.image}/low.webp` : null
  if (d?.kind === 'photo') return d.url ?? null
  return null
}
