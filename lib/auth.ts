import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { headers } from 'next/headers'
import { db, ensureDb } from './db'
import * as schema from './schema'

const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? (vercelUrl ? `https://${vercelUrl}` : undefined),
  trustedOrigins: [process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`].filter(Boolean) as string[],
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
