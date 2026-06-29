/**
 * Stable contracts for Mobile API auth endpoints.
 *
 * Implemented: POST /api/mobile/v1/auth/login
 * Prepared:    POST /api/mobile/v1/auth/refresh (future sprint)
 * Prepared:    POST /api/mobile/v1/auth/logout (future sprint)
 */

export type MobileRefreshTokenRequest = {
  refreshToken: string
  deviceId: string
}

export type MobileRefreshTokenResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type MobileLogoutRequest = {
  deviceId: string
}
