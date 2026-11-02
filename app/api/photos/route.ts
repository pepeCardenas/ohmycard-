import { put } from '@vercel/blob'
import { fail, json, withUser } from '@/lib/api'
import { db } from '@/lib/db'
import { photo } from '@/lib/schema'

const MAX_BYTES = 3 * 1024 * 1024

/** Sube una foto de carta. Usa Vercel Blob si está configurado; si no, la guarda en la base. */
export async function POST(req: Request) {
  return withUser(async (user) => {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof Blob)) return fail('Falta la foto', 400)
    if (!file.type.startsWith('image/')) return fail('El archivo no es una imagen', 400)
    if (file.size > MAX_BYTES) return fail('La foto es demasiado grande', 413)

    const id = crypto.randomUUID()
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const res = await put(`fotos/${user.id}/${id}.jpg`, file, {
        access: 'public',
        contentType: file.type,
        addRandomSuffix: true,
      })
      return json({ url: res.url }, 201)
    }
    await db.insert(photo).values({ id, userId: user.id, mime: file.type, data: Buffer.from(await file.arrayBuffer()) })
    return json({ url: `/api/photos/${id}` }, 201)
  })
}
