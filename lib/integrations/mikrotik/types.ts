export const MIKROTIK_PROTOCOLS = ["https-rest", "api", "api-ssl"] as const
export type MikrotikProtocol = (typeof MIKROTIK_PROTOCOLS)[number]

export const MIKROTIK_CONNECTION_STATUSES = [
  "never_checked",
  "connected",
  "error",
  "disabled",
] as const
export type MikrotikConnectionStatus =
  (typeof MIKROTIK_CONNECTION_STATUSES)[number]

export const MIKROTIK_ERROR_CODES = [
  "CONNECTION_TIMEOUT",
  "CONNECTION_REFUSED",
  "AUTHENTICATION_FAILED",
  "HTTP_ERROR",
  "INVALID_RESPONSE",
  "TLS_ERROR",
  "ROUTER_DISABLED",
  "PROTOCOL_NOT_IMPLEMENTED",
  "SECRET_MISSING",
  "NOT_FOUND",
] as const
export type MikrotikErrorCode = (typeof MIKROTIK_ERROR_CODES)[number]

export type MikrotikHttpFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

export type MikrotikClientConfig = {
  host: string
  port: number
  protocol: MikrotikProtocol
  username: string
  password: string
  timeoutMs?: number
  fetchImpl?: MikrotikHttpFetch
}

export type MikrotikIdentity = {
  name: string
}

export type MikrotikSystemResource = {
  version: string
  uptime: string | null
  cpuLoad: string | null
  freeMemory: number | null
  totalMemory: number | null
  boardName: string | null
  architectureName: string | null
}

export type MikrotikInterfacesSummary = {
  total: number
  running: number
  disabled: number
}

export type MikrotikRouterIdentity = {
  identity: string
  version: string
  uptime: string | null
  cpuLoad: string | null
  freeMemory: number | null
  totalMemory: number | null
  boardName: string | null
  architectureName: string | null
  interfaces?: MikrotikInterfacesSummary
}

export type MikrotikConnectionTestResult = {
  ok: true
  identity: MikrotikIdentity
  resource: MikrotikSystemResource
  interfaces: MikrotikInterfacesSummary | null
  snapshot: MikrotikRouterIdentity
}

export type MikrotikIntegrationPublic = {
  id: string
  companyId: string
  name: string
  host: string
  port: number
  protocol: MikrotikProtocol
  username: string
  enabled: boolean
  hasPassword: boolean
  lastConnectionAt: string | null
  lastConnectionStatus: MikrotikConnectionStatus
  lastConnectionError: string | null
  lastRouterIdentity: MikrotikRouterIdentity | null
  createdAt: string
  updatedAt: string
}

export type MikrotikIntegrationSecretRow = {
  id: string
  company_id: string
  name: string
  host: string
  port: number
  protocol: string
  username: string
  password_encrypted: string
  enabled: boolean
  last_connection_at: string | null
  last_connection_status: string
  last_connection_error: string | null
  last_router_identity: MikrotikRouterIdentity | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type MikrotikCreateInput = {
  name: string
  host: string
  port: number
  protocol: MikrotikProtocol
  username: string
  password: string
  enabled: boolean
}

export type MikrotikUpdateInput = {
  name?: string
  host?: string
  port?: number
  protocol?: MikrotikProtocol
  username?: string
  password?: string
  enabled?: boolean
}
