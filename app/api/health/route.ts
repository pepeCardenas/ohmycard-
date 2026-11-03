import { count } from 'drizzle-orm'
import { db, ensureDb } from '@/lib/db'
import { user } from '@/lib/schema'

export const dynamic = 'force-dynamic'

// Diagnóstico: a qué base está conectada esta versión y cuántas cuentas ve.
// No muestra datos de nadie, solo el host de la base y el total de cuentas.
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL
  let host = 'archivo local'
  if (url) {
    try {
      host = new URL(url).host || url.split(':')[0]
    } catch {
      host = 'URL inválida'
    }
  }
  const info: Record<string, unknown> = {
    base: url ? 'turso' : 'local',
    host,
    token: Boolean(process.env.TURSO_AUTH_TOKEN),
    secreto: Boolean(process.env.BETTER_AUTH_SECRET),
    deploy: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    entorno: process.env.VERCEL_ENV ?? null,
  }
  try {
    await ensureDb()
    const [row] = await db.select({ n: count() }).from(user)
    info.cuentas = row?.n ?? 0
  } catch (e) {
    info.error = e instanceof Error ? e.message : String(e)
  }
  return Response.json(info, { headers: { 'cache-control': 'no-store' } })
}
