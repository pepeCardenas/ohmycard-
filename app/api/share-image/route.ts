import { fail, withUser } from '@/lib/api'

// Trae imágenes de cartas desde nuestro dominio para poder dibujarlas en la imagen
// que se comparte (el navegador no deja leer en un canvas imágenes de otros sitios).
const ALLOWED = (host: string) => host === 'assets.tcgdex.net' || host === 'images.pokemontcg.io' || host.endsWith('.public.blob.vercel-storage.com')

export async function GET(req: Request) {
  return withUser(async () => {
    const raw = new URL(req.url).searchParams.get('url') ?? ''
    let target: URL
    try {
      target = new URL(raw)
    } catch {
      return fail('URL inválida', 400)
    }
    if (target.protocol !== 'https:' || !ALLOWED(target.hostname)) return fail('Origen no permitido', 400)

    const res = await fetch(target, { redirect: 'error' }).catch(() => null)
    const type = res?.headers.get('content-type') ?? ''
    if (!res?.ok || !type.startsWith('image/')) return fail('No se pudo traer la imagen', 502)
    return new Response(res.body, {
      headers: { 'content-type': type, 'cache-control': 'private, max-age=86400' },
    })
  })
}
