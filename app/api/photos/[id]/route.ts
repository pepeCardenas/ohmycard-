import { and, eq } from 'drizzle-orm'
import { fail, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { photo } from '@/lib/schema'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  return withUser(async (user) => {
    const [row] = await db
      .select()
      .from(photo)
      .where(and(eq(photo.id, id), eq(photo.userId, user.id)))
    if (!row) return fail('No existe', 404)
    return new Response(new Uint8Array(row.data), {
      headers: { 'content-type': row.mime, 'cache-control': 'private, max-age=31536000, immutable' },
    })
  })
}
