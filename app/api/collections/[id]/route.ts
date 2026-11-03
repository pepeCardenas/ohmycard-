import { eq } from 'drizzle-orm'
import { fail, json, ownCollection, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { collection } from '@/lib/schema'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownCollection(user.id, id))) return fail('No existe', 404)
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    if (name) await db.update(collection).set({ name }).where(eq(collection.id, id))
    return json({ ok: true })
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownCollection(user.id, id))) return fail('No existe', 404)
    await db.delete(collection).where(eq(collection.id, id)) // las cartas se borran en cascada
    return json({ ok: true })
  })
}
