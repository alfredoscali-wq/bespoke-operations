import { NETWORK_API_BASE_PATH } from "@/lib/network/v1/constants"

/** Any route under /api/network/v1/ — bypasses web cookie middleware entirely. */
export function isNetworkApiPath(pathname: string): boolean {
  return (
    pathname === NETWORK_API_BASE_PATH ||
    pathname.startsWith(`${NETWORK_API_BASE_PATH}/`)
  )
}
