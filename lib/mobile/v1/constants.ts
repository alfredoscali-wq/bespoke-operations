export const MOBILE_API_VERSION = "v1" as const

export const MOBILE_API_BASE_PATH = `/api/mobile/${MOBILE_API_VERSION}` as const

export const MOBILE_SUPPORTED_PLATFORMS = ["android"] as const

export type MobilePlatform = (typeof MOBILE_SUPPORTED_PLATFORMS)[number]
