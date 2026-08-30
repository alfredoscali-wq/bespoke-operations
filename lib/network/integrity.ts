import {
  NETWORK_AGENT_HEARTBEAT_STATUSES,
  NETWORK_AGENT_STATUSES,
  NETWORK_JOB_TYPES,
  NETWORK_SITE_KINDS,
  NETWORK_TARGET_PROTOCOLS,
  NETWORK_VENDORS,
  type NetworkAgentHeartbeatStatus,
  type NetworkAgentStatus,
  type NetworkJobType,
  type NetworkSiteKind,
  type NetworkTargetProtocol,
  type NetworkVendor,
} from "@/lib/network/constants"
import type {
  NetworkDiscoveryTargetDraft,
  NetworkHeartbeatReport,
  NetworkSiteDraft,
} from "@/lib/network/types"

export function isNetworkSiteKind(value: unknown): value is NetworkSiteKind {
  return (
    typeof value === "string" &&
    (NETWORK_SITE_KINDS as readonly string[]).includes(value)
  )
}

export function isNetworkAgentStatus(value: unknown): value is NetworkAgentStatus {
  return (
    typeof value === "string" &&
    (NETWORK_AGENT_STATUSES as readonly string[]).includes(value)
  )
}

export function isNetworkAgentHeartbeatStatus(
  value: unknown
): value is NetworkAgentHeartbeatStatus {
  return (
    typeof value === "string" &&
    (NETWORK_AGENT_HEARTBEAT_STATUSES as readonly string[]).includes(value)
  )
}

export function isNetworkJobType(value: unknown): value is NetworkJobType {
  return (
    typeof value === "string" &&
    (NETWORK_JOB_TYPES as readonly string[]).includes(value)
  )
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function validateNetworkSiteDraft(input: {
  name?: unknown
  kind?: unknown
  description?: unknown
  address?: unknown
  locality?: unknown
}): { ok: true; draft: NetworkSiteDraft } | { ok: false; message: string } {
  const name = trimToNull(input.name)
  if (!name) {
    return { ok: false, message: "El nombre del sitio es obligatorio." }
  }

  if (!isNetworkSiteKind(input.kind)) {
    return { ok: false, message: "El tipo de sitio no es válido." }
  }

  return {
    ok: true,
    draft: {
      name,
      kind: input.kind,
      description: trimToNull(input.description) ?? undefined,
      address: trimToNull(input.address) ?? undefined,
      locality: trimToNull(input.locality) ?? undefined,
    },
  }
}

export function isNetworkVendor(value: unknown): value is NetworkVendor {
  return typeof value === "string" && (NETWORK_VENDORS as readonly string[]).includes(value)
}

export function isNetworkTargetProtocol(
  value: unknown
): value is NetworkTargetProtocol {
  return (
    typeof value === "string" &&
    (NETWORK_TARGET_PROTOCOLS as readonly string[]).includes(value)
  )
}

export function defaultNetworkTargetPort(protocol: NetworkTargetProtocol): number {
  return protocol === "rest" ? 443 : 8728
}

export function validateNetworkAgentDraft(input: {
  name?: unknown
  siteId?: unknown
}):
  | { ok: true; name: string; siteId: string | null }
  | { ok: false; message: string } {
  const name = trimToNull(input.name)
  const siteId = trimToNull(input.siteId)

  if (!name) {
    return { ok: false, message: "El nombre del agent es obligatorio." }
  }

  return { ok: true, name, siteId }
}

export function validateNetworkDiscoveryTargetDraft(input: {
  agentId?: unknown
  siteId?: unknown
  name?: unknown
  vendor?: unknown
  host?: unknown
  port?: unknown
  protocol?: unknown
  username?: unknown
  password?: unknown
}): { ok: true; draft: NetworkDiscoveryTargetDraft } | { ok: false; message: string } {
  const agentId = trimToNull(input.agentId)
  const name = trimToNull(input.name)
  const host = trimToNull(input.host)
  const username = trimToNull(input.username)
  const password = typeof input.password === "string" ? input.password : ""

  if (!agentId) {
    return { ok: false, message: "El destino debe asociarse a un Network Agent." }
  }
  if (!name) {
    return { ok: false, message: "El nombre del destino es obligatorio." }
  }
  if (!isNetworkVendor(input.vendor)) {
    return { ok: false, message: "El vendor no es válido." }
  }
  if (input.vendor !== "mikrotik") {
    return {
      ok: false,
      message: "Sprint 1 solo admite destinos MikroTik.",
    }
  }
  if (!host) {
    return { ok: false, message: "El host/IP de gestión es obligatorio." }
  }
  if (!isNetworkTargetProtocol(input.protocol)) {
    return { ok: false, message: "El protocolo debe ser api o rest." }
  }
  if (!username) {
    return { ok: false, message: "El usuario del equipo es obligatorio." }
  }
  if (!password.trim()) {
    return { ok: false, message: "La contraseña del equipo es obligatoria." }
  }

  let port = defaultNetworkTargetPort(input.protocol)
  if (input.port != null && input.port !== "") {
    const parsed = typeof input.port === "number" ? input.port : Number(input.port)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      return { ok: false, message: "El puerto no es válido." }
    }
    port = parsed
  }

  return {
    ok: true,
    draft: {
      agentId,
      siteId: trimToNull(input.siteId),
      name,
      vendor: input.vendor,
      host,
      port,
      protocol: input.protocol,
      username,
      password,
    },
  }
}

/**
 * Tenant is always the authenticated agent row. Any company_id in the payload
 * is ignored so the agent cannot claim another tenant.
 */
export function resolveTrustedCompanyId(
  authenticatedCompanyId: string,
  claimedCompanyId?: unknown
): string {
  void claimedCompanyId
  return authenticatedCompanyId
}

export function parseHeartbeatReport(
  body: unknown
): { ok: true; report: NetworkHeartbeatReport } | { ok: false; message: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: true, report: {} }
  }

  const record = body as Record<string, unknown>
  const report: NetworkHeartbeatReport = {}

  if (record.status != null && record.status !== "") {
    if (!isNetworkAgentHeartbeatStatus(record.status)) {
      return { ok: false, message: "El estado de heartbeat no es válido." }
    }
    report.status = record.status
  }

  if (record.version != null) {
    report.version = trimToNull(record.version)
  }

  if (record.hostname != null) {
    report.hostname = trimToNull(record.hostname)
  }

  return { ok: true, report }
}

export function parseEnrollRequest(body: unknown):
  | {
      ok: true
      enrollmentToken: string
      version: string | null
      hostname: string | null
    }
  | { ok: false; message: string } {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Cuerpo JSON inválido." }
  }

  const record = body as Record<string, unknown>
  const enrollmentToken = trimToNull(record.enrollmentToken)

  if (!enrollmentToken) {
    return { ok: false, message: "El token de enrollment es obligatorio." }
  }

  return {
    ok: true,
    enrollmentToken,
    version: trimToNull(record.version),
    hostname: trimToNull(record.hostname),
  }
}
