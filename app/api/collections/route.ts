import { asc, count, desc, eq, inArray, max } from 'drizzle-orm'
import { fail, json, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { thumb } from '@/lib/items'
import { collection, collectionItem } from '@/lib/schema'

const newId = () => `c${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

/** Colecciones del usuario con la cantidad de cartas y las 4 últimas como vista previa. */
export async function GET() {
  return withUser(async (user) => {
    const rows = await db
      .select({ id: collection.id, name: collection.name, cardCount: count(collectionItem.id) })
      .from(collection)
      .leftJoin(collectionItem, eq(collectionItem.collectionId, collection.id))
      .where(eq(collection.userId, user.id))
      .groupBy(collection.id)
      .orderBy(asc(collection.position), asc(collection.createdAt))
    const ids = rows.map((r) => r.id)
    const items = ids.length
      ? await db
          .select({ collectionId: collectionItem.collectionId, data: collectionItem.data })
          .from(collectionItem)
          .where(inArray(collectionItem.collectionId, ids))
          .orderBy(desc(collectionItem.createdAt))
      : []
    const previews = new Map<string, string[]>()
    for (const it of items) {
      const list = previews.get(it.collectionId) ?? []
      const t = thumb(it.data)
      if (t && list.length < 4) list.push(t)
      previews.set(it.collectionId, list)
    }
    return json(rows.map((r) => ({ ...r, preview: previews.get(r.id) ?? [] })))
  })
}

export async function POST(req: Request) {
  return withUser(async (user) => {
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = String(body.name ?? '').trim().slice(0, 40)
    if (!name) return fail('Falta el nombre', 400)
    const [{ last }] = await db
      .select({ last: max(collection.position) })
      .from(collection)
      .where(eq(collection.userId, user.id))
    const row = { id: newId(), userId: user.id, name, position: (last ?? -1) + 1 }
    await db.insert(collection).values(row)
    return json({ id: row.id, name, cardCount: 0, preview: [] }, 201)
  })
}
