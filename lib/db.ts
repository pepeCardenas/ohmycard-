import path from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'

// Turso en producción; un archivo local cuando no hay variables (desarrollo).
const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })

let ready: Promise<void> | null = null

/** Crea o actualiza las tablas la primera vez que se usa la base (una vez por arranque). */
export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') }).catch((e) => {
      ready = null
      throw e
    })
  }
  return ready
}
