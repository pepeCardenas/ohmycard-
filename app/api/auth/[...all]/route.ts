import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'
import { ensureDb } from '@/lib/db'

const handler = toNextJsHandler(auth)

export async function GET(req: Request) {
  await ensureDb()
  return handler.GET(req)
}

export async function POST(req: Request) {
  await ensureDb()
  return handler.POST(req)
}
