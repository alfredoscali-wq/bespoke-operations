/**
 * PWA 1.0 — configuración central.
 * Punto único para manifest, colores, rutas de iconos y nombres de cache.
 */

export const PWA_APP_NAME = "Bespoke Operations"
export const PWA_SHORT_NAME = "Bespoke"
export const PWA_DESCRIPTION =
  "Gestión operativa para ISP: órdenes de trabajo, cuadrillas, clientes y portal operario de campo."

export const PWA_START_URL = "/"
export const PWA_SCOPE = "/"
export const PWA_DISPLAY = "standalone" as const
export const PWA_ORIENTATION = "portrait" as const

/** Aproximación del primary de la marca (oklch 0.46 0.14 255). */
export const PWA_THEME_COLOR = "#1e4d8c"
export const PWA_BACKGROUND_COLOR = "#ffffff"

export const PWA_MANIFEST_PATH = "/manifest.webmanifest"
export const PWA_SERVICE_WORKER_PATH = "/sw.js"

export const PWA_ICON_SIZES = [192, 256, 384, 512] as const

export const PWA_ICONS = PWA_ICON_SIZES.map((size) => ({
  src: `/icons/icon-${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: "image/png" as const,
  purpose: "any" as const,
}))

export const PWA_MASKABLE_ICON_SIZES = [192, 512] as const

export const PWA_MASKABLE_ICONS = PWA_MASKABLE_ICON_SIZES.map((size) => ({
  src: `/icons/icon-maskable-${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: "image/png" as const,
  purpose: "maskable" as const,
}))

export const PWA_MASKABLE_ICON = PWA_MASKABLE_ICONS[PWA_MASKABLE_ICONS.length - 1]

export const PWA_APPLE_TOUCH_ICON = "/icons/apple-touch-icon.png"

/** Versión del cache estático — incrementar al cambiar estrategia de SW. */
export const PWA_STATIC_CACHE_VERSION = "bespoke-static-v1"

/**
 * PWA 2.0 — reservado (no implementado).
 * Nombres de cache futuros para offline / sync.
 */
export const PWA_FUTURE_CACHE_NAMES = {
  offlineShell: "bespoke-offline-shell",
  runtime: "bespoke-runtime",
  syncQueue: "bespoke-sync-queue",
} as const

export const PWA_FUTURE_FEATURES = {
  offline: false,
  backgroundSync: false,
  pushNotifications: false,
  silentUpdate: false,
} as const
