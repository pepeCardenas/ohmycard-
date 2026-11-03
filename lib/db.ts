import path from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'

// Turso en producción; un archivo local cuando no hay variables (desarrollo).
// DATABASE_URL / DATABASE_AUTH_TOKEN tienen prioridad: la integración de Turso en Vercel
// carga TURSO_* apuntando a una base nueva por cada deploy (host "dpl-..."), y ahí las
// cuentas se pierden en cada deploy. Con DATABASE_* se usa siempre la misma base.
export const dbUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || undefined
const dbToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined

function dbHost(url?: string) {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

export const dbHostName = dbHost(dbUrl)

/** Motivo por el que en Vercel no se puede usar la base configurada, o null si está bien. */
export const databaseProblem: string | null = !process.env.VERCEL
  ? null
  : !dbUrl
    ? 'Falta configurar DATABASE_URL en Vercel. Sin ella las cuentas no se guardan.'
    : dbHostName.startsWith('dpl-')
      ? 'La base de Turso de este deploy es temporal (se crea una nueva en cada deploy). Configurá DATABASE_URL y DATABASE_AUTH_TOKEN en Vercel con una base fija.'
      : null

const client = createClient({
  url: dbUrl ?? 'file:local.db',
  authToken: dbToken,
})

export const db = drizzle(client, { schema })

let ready: Promise<void> | null = null

/** Crea o actualiza las tablas la primera vez que se usa la base (una vez por arranque). */
export function ensureDb(): Promise<void> {
  if (databaseProblem) return Promise.reject(new Error(databaseProblem))
  if (!ready) {
    ready = migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') }).catch((e) => {
      ready = null
      throw e
    })
  }
  return ready
}
