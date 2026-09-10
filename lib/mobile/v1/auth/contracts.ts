/**
 * Stable contracts for Mobile API auth endpoints.
 *
 * Implemented: POST /api/mobile/v1/auth/login
 * Implemented: POST /api/mobile/v1/auth/refresh
 * Implemented: POST /api/mobile/v1/auth/change-password
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

export type MobileChangePasswordRequest = {
  newPassword: string
}

export type MobileChangePasswordResponse = {
  ok: true
}
