 
/**
 * Bespoke Operations — Service Worker (PWA 1.0)
 * Cache: solo recursos estáticos del mismo origen.
 * No cachea: /api/*, datos de usuario, respuestas dinámicas.
 */

const CACHE_VERSION = "bespoke-static-v1"
const STATIC_CACHE = CACHE_VERSION

const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
  "/images/logo/LOGO_BESPOKE.png",
]

function isStaticAssetRequest(url) {
  if (url.origin !== self.location.origin) {
    return false
  }

  const pathname = url.pathname

  if (pathname.startsWith("/api/")) {
    return false
  }

  if (pathname.startsWith("/_next/static/")) {
    return true
  }

  if (pathname.startsWith("/icons/")) {
    return true
  }

  if (pathname.startsWith("/images/")) {
    return true
  }

  if (pathname === "/manifest.webmanifest") {
    return true
  }

  if (pathname === "/icons/favicon-32x32.png") {
    return true
  }

  return /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(pathname)
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)

    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    if (cached) {
      return cached
    }

    throw error
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("bespoke-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

self.addEventListener("fetch", (event) => {
  const request = event.request

  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (!isStaticAssetRequest(url)) {
    return
  }

  event.respondWith(cacheFirst(request))
})
