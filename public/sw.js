// Service worker mínimo: guarda la app en caché para que abra sin conexión.
const CACHE = 'ohmycard-v3'
const IMAGES = 'ohmycard-cartas'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMAGES).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

// Red primero (para recibir versiones nuevas), caché como respaldo sin conexión.
self.addEventListener('fetch', (event) => {
  const req = event.request

  // Imágenes de cartas oficiales: caché primero, así el binder se ve sin conexión.
  if (req.method === 'GET' && new URL(req.url).hostname === 'assets.tcgdex.net') {
    event.respondWith(
      caches.open(IMAGES).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok || res.type === 'opaque') c.put(req, res.clone())
              return res
            }),
        ),
      ),
    )
    return
  }
  const url = new URL(req.url)
  // Sesión y login siempre por red; nada de caché.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/auth') || url.pathname === '/login') return
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !res.redirected) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then((r) => r || Response.error())),
  )
})
