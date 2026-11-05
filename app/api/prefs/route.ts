import { eq } from 'drizzle-orm'
import { fail, json, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { userPref } from '@/lib/schema'
import { DEFAULT_SKIN, isSkin } from '@/lib/skins'

/** Preferencias del usuario. */
export async function GET() {
  return withUser(async (user) => {
    const [row] = await db.select().from(userPref).where(eq(userPref.userId, user.id)).limit(1)
    return json({ skin: row?.skin ?? DEFAULT_SKIN })
  })
}

export async function PATCH(req: Request) {
  return withUser(async (user) => {
    const body = (await req.json().catch(() => ({}))) as { skin?: string }
    if (!isSkin(body.skin)) return fail('Skin desconocido', 400)
    await db
      .insert(userPref)
      .values({ userId: user.id, skin: body.skin })
      .onConflictDoUpdate({ target: userPref.userId, set: { skin: body.skin } })
    return json({ ok: true })
  })
}
