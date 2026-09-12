export const BESPOKE_LOGO_SRC = "/images/logo/LOGO_BESPOKE.png"
export const ABNET_LOGO_SRC = "/images/logo/LOGO_ABNET.png"

export const BRAND_LOGO_SRC = {
  bespoke: BESPOKE_LOGO_SRC,
  abnet: ABNET_LOGO_SRC,
} as const

export type AppBrandId = keyof typeof BRAND_LOGO_SRC

const ABNET_HOSTS = ["app-abnet.com.ar"] as const
const BESPOKE_HOSTS = ["bespoke-app.com.ar"] as const

function normalizeHost(hostname?: string | null): string {
  return (hostname ?? "").split(":")[0].trim().toLowerCase()
}

function hostMatches(host: string, domains: readonly string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

/**
 * Resolves the chrome brand for the current app instance.
 * Company-specific logos can later override this without changing
 * login/sidebar call sites.
 */
export function resolveAppBrandId(hostname?: string | null): AppBrandId {
  const configured = process.env.NEXT_PUBLIC_APP_BRAND?.trim().toLowerCase()
  if (configured === "abnet" || configured === "bespoke") {
    return configured
  }

  const host = normalizeHost(hostname)
  if (hostMatches(host, ABNET_HOSTS)) return "abnet"
  if (hostMatches(host, BESPOKE_HOSTS)) return "bespoke"

  return "abnet"
}

export function getAppLogoSrc(hostname?: string | null): string {
  const explicit = process.env.NEXT_PUBLIC_APP_LOGO_SRC?.trim()
  if (explicit) return explicit
  return BRAND_LOGO_SRC[resolveAppBrandId(hostname)]
}

export function getAppLogoAlt(hostname?: string | null): string {
  return resolveAppBrandId(hostname) === "abnet" ? "ABNet" : "Bespoke Operations"
}
