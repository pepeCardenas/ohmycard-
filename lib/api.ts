import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { currentUser } from './auth'
import { db } from './db'
import { binder, collection } from './schema'

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status })
export const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status })

type User = NonNullable<Awaited<ReturnType<typeof currentUser>>>

/** Ejecuta el handler sólo si hay sesión. */
export async function withUser(fn: (user: User) => Promise<Response>): Promise<Response> {
  const user = await currentUser()
  if (!user) return fail('No autorizado', 401)
  try {
    return await fn(user)
  } catch (e) {
    console.error(e)
    return fail('Error del servidor', 500)
  }
}

/** Devuelve el binder si pertenece al usuario. */
export async function ownBinder(userId: string, binderId: string) {
  const rows = await db
    .select()
    .from(binder)
    .where(and(eq(binder.id, binderId), eq(binder.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

/** Devuelve la colección si pertenece al usuario. */
export async function ownCollection(userId: string, collectionId: string) {
  const rows = await db
    .select()
    .from(collection)
    .where(and(eq(collection.id, collectionId), eq(collection.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}
