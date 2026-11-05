import { eq } from 'drizzle-orm'
import { fail, json, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { userPref } from '@/lib/schema'
import { DEFAULT_MODE, DEFAULT_SKIN, isMode, isSkin } from '@/lib/skins'

/** Preferencias del usuario: skin y modo claro/oscuro. */
export async function GET() {
  return withUser(async (user) => {
    const [row] = await db.select().from(userPref).where(eq(userPref.userId, user.id)).limit(1)
    return json({ skin: row?.skin ?? DEFAULT_SKIN, mode: row?.mode ?? DEFAULT_MODE })
  })
}

export async function PATCH(req: Request) {
  return withUser(async (user) => {
    const body = (await req.json().catch(() => ({}))) as { skin?: string; mode?: string }
    const changes: { skin?: string; mode?: string } = {}
    if (body.skin !== undefined) {
      if (!isSkin(body.skin)) return fail('Skin desconocido', 400)
      changes.skin = body.skin
    }
    if (body.mode !== undefined) {
      if (!isMode(body.mode)) return fail('Modo desconocido', 400)
      changes.mode = body.mode
    }
    if (!Object.keys(changes).length) return fail('Nada para guardar', 400)
    await db
      .insert(userPref)
      .values({ userId: user.id, ...changes })
      .onConflictDoUpdate({ target: userPref.userId, set: changes })
    return json({ ok: true })
  })
}
