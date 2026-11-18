/* Harbor shell cache.
 * Same-origin static files only. Never cache or intercept api.deepseek.com.
 */
const CACHE = 'harbor-shell-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) {
    return
  }
  if (url.hostname === 'api.deepseek.com') {
    return
  }
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/anthropic/')) {
    return
  }
  if (event.request.method !== 'GET') {
    return
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      if (event.request.mode === 'navigate') {
        try {
          const fresh = await fetch(event.request)
          cache.put(event.request, fresh.clone())
          return fresh
        } catch {
          return (await cache.match(event.request)) || (await cache.match('/index.html')) || Response.error()
        }
      }
      const cached = await cache.match(event.request)
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone())
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })(),
  )
})
