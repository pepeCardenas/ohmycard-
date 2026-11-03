import { and, eq } from 'drizzle-orm'
import { fail, json, ownBinder, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { binder, slot } from '@/lib/schema'

type Ctx = { params: Promise<{ id: string }> }

const SLOTS_PER_PAGE = 9
const MAX_PAGES = 500

function validPos(page: unknown, s: unknown): page is number {
  return (
    Number.isInteger(page) &&
    Number.isInteger(s) &&
    (page as number) >= 0 &&
    (page as number) < MAX_PAGES &&
    (s as number) >= 0 &&
    (s as number) < SLOTS_PER_PAGE
  )
}

/** Un casillero sólo puede tener una carta oficial o una foto, con campos conocidos. */
function cleanItem(raw: unknown): Record<string, string> | null {
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
    return { kind: 'photo', url }
  }
  return null
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownBinder(user.id, id))) return fail('No existe', 404)
    const rows = await db.select().from(slot).where(eq(slot.binderId, id))
    return json(rows.map((r) => ({ page: r.page, slot: r.slot, item: r.data })))
  })
}

/** Guarda un elemento en un casillero (reemplaza si había otro). Agranda el binder si hace falta. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    const b = await ownBinder(user.id, id)
    if (!b) return fail('No existe', 404)
    const body = (await req.json().catch(() => ({}))) as { page?: number; slot?: number; item?: unknown }
    if (!validPos(body.page, body.slot)) return fail('Casillero inválido', 400)
    const item = cleanItem(body.item)
    if (!item) return fail('Contenido inválido', 400)
    await db
      .insert(slot)
      .values({ binderId: id, page: body.page, slot: body.slot!, data: item })
      .onConflictDoUpdate({ target: [slot.binderId, slot.page, slot.slot], set: { data: item } })
    if (body.page >= b.pageCount) await db.update(binder).set({ pageCount: body.page + 1 }).where(eq(binder.id, id))
    return json({ ok: true })
  })
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownBinder(user.id, id))) return fail('No existe', 404)
    const url = new URL(req.url)
    const page = Number(url.searchParams.get('page'))
    const s = Number(url.searchParams.get('slot'))
    if (!validPos(page, s)) return fail('Casillero inválido', 400)
    await db.delete(slot).where(and(eq(slot.binderId, id), eq(slot.page, page), eq(slot.slot, s)))
    return json({ ok: true })
  })
}

/** Intercambia el contenido de dos casilleros (para "Mover"). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownBinder(user.id, id))) return fail('No existe', 404)
    const body = (await req.json().catch(() => ({}))) as {
      from?: { page?: number; slot?: number }
      to?: { page?: number; slot?: number }
    }
    const { from, to } = body
    if (!from || !to || !validPos(from.page, from.slot) || !validPos(to.page, to.slot)) {
      return fail('Casillero inválido', 400)
    }
    const at = (p: { page?: number; slot?: number }) =>
      and(eq(slot.binderId, id), eq(slot.page, p.page!), eq(slot.slot, p.slot!))
    const [a] = await db.select().from(slot).where(at(from))
    const [b] = await db.select().from(slot).where(at(to))
    await db.batch([
      db.delete(slot).where(at(from)),
      db.delete(slot).where(at(to)),
      ...(a ? [db.insert(slot).values({ binderId: id, page: to.page!, slot: to.slot!, data: a.data })] : []),
      ...(b ? [db.insert(slot).values({ binderId: id, page: from.page!, slot: from.slot!, data: b.data })] : []),
    ] as unknown as Parameters<typeof db.batch>[0])
    return json({ ok: true })
  })
}
