import { asc, count, eq, max } from 'drizzle-orm'
import { fail, json, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { binder, slot } from '@/lib/schema'

const newId = () => `b${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

/** Lista de binders del usuario con la cantidad de cartas. Crea el primero si no hay. */
export async function GET() {
  return withUser(async (user) => {
    let rows = await db
      .select({
        id: binder.id,
        name: binder.name,
        pageCount: binder.pageCount,
        cardCount: count(slot.binderId),
      })
      .from(binder)
      .leftJoin(slot, eq(slot.binderId, binder.id))
      .where(eq(binder.userId, user.id))
      .groupBy(binder.id)
      .orderBy(asc(binder.position), asc(binder.createdAt))
    if (rows.length === 0) {
      const first = { id: newId(), userId: user.id, name: 'Mi binder', pageCount: 2, position: 0 }
      await db.insert(binder).values(first)
      rows = [{ id: first.id, name: first.name, pageCount: first.pageCount, cardCount: 0 }]
    }
    return json(rows)
  })
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = (await req.json().catch(() => ({}))) as { name?: string; pageCount?: number }
    const name = String(body.name ?? '').trim().slice(0, 40)
    if (!name) return fail('Falta el nombre', 400)
    const pageCount = Math.min(Math.max(Number(body.pageCount) || 2, 1), 500)
    const [{ last }] = await db
      .select({ last: max(binder.position) })
      .from(binder)
      .where(eq(binder.userId, user.id))
    const row = { id: newId(), userId: user.id, name, pageCount, position: (last ?? -1) + 1 }
    await db.insert(binder).values(row)
    return json({ id: row.id, name, pageCount, cardCount: 0 }, 201)
  })
}
