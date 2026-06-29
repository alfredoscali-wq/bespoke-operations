export const MOBILE_HEADER_CLIENT = "X-Mobile-Client"
export const MOBILE_HEADER_APP_VERSION = "X-App-Version"
export const MOBILE_HEADER_PLATFORM = "X-Platform"

export type MobileClientHeaders = {
  client: string | null
  appVersion: string | null
  platform: string | null
}

export function readMobileClientHeaders(request: Request): MobileClientHeaders {
  return {
    client: request.headers.get(MOBILE_HEADER_CLIENT)?.trim() || null,
    appVersion: request.headers.get(MOBILE_HEADER_APP_VERSION)?.trim() || null,
    platform: request.headers.get(MOBILE_HEADER_PLATFORM)?.trim() || null,
  }
}

export function hasMobileClientHeaders(headers: MobileClientHeaders): boolean {
  return Boolean(headers.client || headers.appVersion || headers.platform)
}
