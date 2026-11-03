import { and, eq } from 'drizzle-orm'
import { fail, json, ownBinder, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { cleanItem } from '@/lib/items'
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

const spanOf = (data: unknown) => {
  const d = (data ?? {}) as { kind?: string; cols?: number; rows?: number }
  return d.kind === 'photo' ? { cols: d.cols === 2 ? 2 : 1, rows: d.rows === 2 ? 2 : 1 } : { cols: 1, rows: 1 }
}

/** Casilleros que ocupa un bloque, o null si se sale de la página 3x3. */
function blockCells(s: number, cols: number, rows: number): number[] | null {
  const c = s % 3
  const r = Math.floor(s / 3)
  if (c + cols > 3 || r + rows > 3) return null
  const cells: number[] = []
  for (let dr = 0; dr < rows; dr++) for (let dc = 0; dc < cols; dc++) cells.push((r + dr) * 3 + c + dc)
  return cells
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
    const span = spanOf(item)
    if (span.cols > 1 || span.rows > 1) {
      const cells = blockCells(body.slot!, span.cols, span.rows)
      if (!cells) return fail('La foto no entra en la página', 400)
      // Los otros casilleros que tapa tienen que estar libres
      const others = await db
        .select()
        .from(slot)
        .where(and(eq(slot.binderId, id), eq(slot.page, body.page)))
      const busy = others.some(
        (o) => o.slot !== body.slot && (blockCells(o.slot, spanOf(o.data).cols, spanOf(o.data).rows) ?? [o.slot]).some((c) => cells.includes(c)),
      )
      if (busy) return fail('No hay lugar para la foto ahí', 409)
    }
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
    const fits = (row: typeof a | undefined, dest: { slot?: number }) =>
      !row || !!blockCells(dest.slot!, spanOf(row.data).cols, spanOf(row.data).rows)
    if (!fits(a, to) || !fits(b, from)) return fail('No hay lugar para la foto ahí', 409)
    await db.batch([
      db.delete(slot).where(at(from)),
      db.delete(slot).where(at(to)),
      ...(a ? [db.insert(slot).values({ binderId: id, page: to.page!, slot: to.slot!, data: a.data })] : []),
      ...(b ? [db.insert(slot).values({ binderId: id, page: from.page!, slot: from.slot!, data: b.data })] : []),
    ] as unknown as Parameters<typeof db.batch>[0])
    return json({ ok: true })
  })
}
