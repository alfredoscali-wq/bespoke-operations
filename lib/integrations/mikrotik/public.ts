import type {
  MikrotikConnectionStatus,
  MikrotikIntegrationPublic,
  MikrotikIntegrationSecretRow,
  MikrotikProtocol,
  MikrotikRouterIdentity,
} from "@/lib/integrations/mikrotik/types"
import {
  MIKROTIK_CONNECTION_STATUSES,
  MIKROTIK_PROTOCOLS,
} from "@/lib/integrations/mikrotik/types"

const PUBLIC_KEYS = [
  "id",
  "companyId",
  "name",
  "host",
  "port",
  "protocol",
  "username",
  "enabled",
  "hasPassword",
  "lastConnectionAt",
  "lastConnectionStatus",
  "lastConnectionError",
  "lastRouterIdentity",
  "createdAt",
  "updatedAt",
] as const

function isProtocol(value: string): value is MikrotikProtocol {
  return (MIKROTIK_PROTOCOLS as readonly string[]).includes(value)
}

function isStatus(value: string): value is MikrotikConnectionStatus {
  return (MIKROTIK_CONNECTION_STATUSES as readonly string[]).includes(value)
}

export function mapMikrotikIntegrationPublic(
  row: MikrotikIntegrationSecretRow
): MikrotikIntegrationPublic {
  const mapped: MikrotikIntegrationPublic = {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    host: row.host,
    port: row.port,
    protocol: isProtocol(row.protocol) ? row.protocol : "https-rest",
    username: row.username,
    enabled: row.enabled,
    hasPassword: true,
    lastConnectionAt: row.last_connection_at,
    lastConnectionStatus: isStatus(row.last_connection_status)
      ? row.last_connection_status
      : "never_checked",
    lastConnectionError: row.last_connection_error,
    lastRouterIdentity: row.last_router_identity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  for (const key of Object.keys(mapped)) {
    if (!(PUBLIC_KEYS as readonly string[]).includes(key)) {
      delete (mapped as Record<string, unknown>)[key]
    }
  }

  return mapped
}

export function assertNoMikrotikSecrets(payload: unknown): void {
  const serialized = JSON.stringify(payload ?? null)
  if (!serialized) return
  const forbidden = [
    "password_encrypted",
    "passwordEncrypted",
    '"password"',
    "BESPOKE_MIKROTIK_SECRET",
  ]
  for (const token of forbidden) {
    if (serialized.includes(token)) {
      throw new Error("Respuesta MikroTik contiene un secreto prohibido.")
    }
  }
}

export function compactRouterIdentity(
  identity: MikrotikRouterIdentity
): MikrotikRouterIdentity {
  return {
    identity: identity.identity,
    version: identity.version,
    uptime: identity.uptime,
    cpuLoad: identity.cpuLoad,
    freeMemory: identity.freeMemory,
    totalMemory: identity.totalMemory,
    boardName: identity.boardName,
    architectureName: identity.architectureName,
    ...(identity.interfaces ? { interfaces: identity.interfaces } : {}),
  }
}
