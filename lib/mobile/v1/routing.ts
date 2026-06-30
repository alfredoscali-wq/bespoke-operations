import { MOBILE_API_BASE_PATH } from "@/lib/mobile/v1/constants"

const MOBILE_PUBLIC_PATHS = new Set([
  `${MOBILE_API_BASE_PATH}/auth/login`,
])

/** Any route under /api/mobile/v1/ — bypasses web cookie middleware entirely. */
export function isMobileApiPath(pathname: string): boolean {
  return (
    pathname === MOBILE_API_BASE_PATH ||
    pathname.startsWith(`${MOBILE_API_BASE_PATH}/`)
  )
}

export function isMobileApiPublicPath(pathname: string): boolean {
  return MOBILE_PUBLIC_PATHS.has(pathname)
}
