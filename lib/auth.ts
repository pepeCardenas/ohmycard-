import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { headers } from 'next/headers'
import { db, ensureDb } from './db'
import * as schema from './schema'

/** Convierte "ohmycard.vercel.app", "https://x.app/" o "https://x.app/login" en "https://x.app". */
function toOrigin(value?: string): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  try {
    return new URL(v.includes('://') ? v : `https://${v}`).origin
  } catch {
    return undefined
  }
}

const baseURL =
  toOrigin(process.env.BETTER_AUTH_URL) ??
  toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  toOrigin(process.env.VERCEL_URL)

// Direcciones desde las que se acepta iniciar sesión: la configurada y todas las que asigna Vercel
// (producción, rama y despliegue). TRUSTED_ORIGINS permite sumar otras separadas por coma.
const trustedOrigins = [
  baseURL,
  toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  toOrigin(process.env.VERCEL_BRANCH_URL),
  toOrigin(process.env.VERCEL_URL),
  ...(process.env.TRUSTED_ORIGINS ?? '').split(',').map(toOrigin),
].filter((o): o is string => !!o)

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 días: es una app de uso personal en el celular
  },
  plugins: [nextCookies()],
})

/** Usuario de la sesión actual, o null. */
export async function currentUser() {
  await ensureDb()
  const s = await auth.api.getSession({ headers: await headers() })
  return s?.user ?? null
}
