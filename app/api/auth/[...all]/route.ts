import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'
import { ensureDb } from '@/lib/db'

const handler = toNextJsHandler(auth)

/** Si la base no está lista, responde con un mensaje que el formulario puede mostrar. */
async function withDb(req: Request, run: (req: Request) => Promise<Response>) {
  try {
    await ensureDb()
  } catch (e) {
    const message = e instanceof Error ? e.message : 'No se pudo abrir la base de datos.'
    return Response.json({ code: 'DATABASE_UNAVAILABLE', message }, { status: 503 })
  }
  return run(req)
}

export const GET = (req: Request) => withDb(req, handler.GET)
export const POST = (req: Request) => withDb(req, handler.POST)
