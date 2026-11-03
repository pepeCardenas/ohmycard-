import { eq } from 'drizzle-orm'
import { fail, json, ownBinder, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { isBinderColor } from '@/lib/binderColors'
import { binder } from '@/lib/schema'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownBinder(user.id, id))) return fail('No existe', 404)
    const body = (await req.json().catch(() => ({}))) as { name?: string; pageCount?: number; color?: string }
    const changes: { name?: string; pageCount?: number; color?: string } = {}
    if (typeof body.name === 'string' && body.name.trim()) changes.name = body.name.trim().slice(0, 40)
    if (Number.isInteger(body.pageCount)) changes.pageCount = Math.min(Math.max(body.pageCount!, 1), 500)
    if (isBinderColor(body.color)) changes.color = body.color
    if (Object.keys(changes).length) await db.update(binder).set(changes).where(eq(binder.id, id))
    return json({ ok: true })
  })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    if (!(await ownBinder(user.id, id))) return fail('No existe', 404)
    await db.delete(binder).where(eq(binder.id, id)) // los casilleros se borran en cascada
    return json({ ok: true })
  })
}
