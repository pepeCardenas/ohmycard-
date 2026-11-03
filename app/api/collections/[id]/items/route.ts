import { and, desc, eq } from 'drizzle-orm'
import { fail, json, ownCollection, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { cleanItem } from '@/lib/items'
import { collectionItem } from '@/lib/schema'

type Ctx = { params: Promise<{ id: string }> }

const MAX_PER_REQUEST = 100
const newId = () => `i${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

/** Cartas de la colección, de la última agregada a la primera. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownCollection(user.id, id))) return fail('No existe', 404)
    const rows = await db
      .select()
      .from(collectionItem)
      .where(eq(collectionItem.collectionId, id))
      .orderBy(desc(collectionItem.createdAt))
    return json(rows.map((r) => ({ id: r.id, item: r.data })))
  })
}

/** Agrega varias cartas o fotos de una vez. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownCollection(user.id, id))) return fail('No existe', 404)
    const body = (await req.json().catch(() => ({}))) as { items?: unknown[] }
    if (!Array.isArray(body.items) || body.items.length === 0) return fail('No hay cartas para agregar', 400)
    if (body.items.length > MAX_PER_REQUEST) return fail(`Máximo ${MAX_PER_REQUEST} cartas por vez`, 400)
    const items = body.items.map(cleanItem)
    if (items.some((i) => !i)) return fail('Contenido inválido', 400)
    // Las fotos de una colección siempre ocupan un lugar
    const now = Date.now()
    const rows = items.map((data, n) => {
      const { cols: _c, rows: _r, ...clean } = data!
      // Orden estable: la primera de la lista queda como la más reciente
      return { id: newId(), collectionId: id, data: clean, createdAt: new Date(now + items.length - n) }
    })
    await db.insert(collectionItem).values(rows)
    return json(rows.map((r) => ({ id: r.id, item: r.data })), 201)
  })
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownCollection(user.id, id))) return fail('No existe', 404)
    const itemId = new URL(req.url).searchParams.get('item')
    if (!itemId) return fail('Falta la carta', 400)
    await db.delete(collectionItem).where(and(eq(collectionItem.id, itemId), eq(collectionItem.collectionId, id)))
    return json({ ok: true })
  })
}
