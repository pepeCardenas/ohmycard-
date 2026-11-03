import { count } from 'drizzle-orm'
import { databaseProblem, db, dbHostName, dbUrl, ensureDb } from '@/lib/db'
import { user } from '@/lib/schema'

export const dynamic = 'force-dynamic'

// Diagnóstico: a qué base está conectada esta versión y cuántas cuentas ve.
// No muestra datos de nadie, solo el host de la base y el total de cuentas.
export async function GET() {
  const info: Record<string, unknown> = {
    base: dbUrl ? 'turso' : 'local',
    variable: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.TURSO_DATABASE_URL ? 'TURSO_DATABASE_URL' : null,
    host: dbHostName || 'archivo local',
    token: Boolean(process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN),
    problema: databaseProblem,
    secreto: Boolean(process.env.BETTER_AUTH_SECRET),
    deploy: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    entorno: process.env.VERCEL_ENV ?? null,
  }
  try {
    await ensureDb()
    const [row] = await db.select({ n: count() }).from(user)
    info.cuentas = row?.n ?? 0
  } catch (e) {
    // La causa real (ej. token inválido) viene anidada en `cause`.
    const parts: string[] = []
    let cur: unknown = e
    while (cur && parts.length < 4) {
      parts.push(cur instanceof Error ? cur.message.split('\n')[0] : String(cur))
      cur = cur instanceof Error ? cur.cause : undefined
    }
    info.error = parts.join(' ← ')
  }
  return Response.json(info, { headers: { 'cache-control': 'no-store' } })
}
