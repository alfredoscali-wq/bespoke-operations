export const MIKROTIK_DEFAULT_PROTOCOL = "https-rest" as const
export const MIKROTIK_DEFAULT_PORT = 443
export const MIKROTIK_REQUEST_TIMEOUT_MS = 8_000
export const MIKROTIK_PASSWORD_PACK_PREFIX = "aes256gcm.v1"
export const MIKROTIK_SECRET_ENV = "BESPOKE_MIKROTIK_SECRET"

export const MIKROTIK_PROTOCOLS = ["https-rest", "api", "api-ssl"] as const
export const MIKROTIK_CONNECTION_STATUSES = [
  "never_checked",
  "connected",
  "error",
  "disabled",
] as const