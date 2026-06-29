import { MOBILE_API_BASE_PATH } from "@/lib/mobile/v1/constants"

const MOBILE_PUBLIC_PATHS = new Set([
  `${MOBILE_API_BASE_PATH}/auth/login`,
])

export function isMobileApiPublicPath(pathname: string): boolean {
  return MOBILE_PUBLIC_PATHS.has(pathname)
}
