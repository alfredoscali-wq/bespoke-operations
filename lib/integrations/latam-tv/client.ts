import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import type {
  LatamTvAccountStatus,
  LatamTvClient,
  LatamTvFetch,
  LatamTvLookup,
  LatamTvPlan,
} from "@/lib/integrations/latam-tv/types"

const GET_CLIENTS_PATH = "/api/get-clients"
const REQUEST_TIMEOUT_MS = 12_000

export type LatamTvClientDeps = {
  baseUrl: string
  token: string
  fetchImpl?: LatamTvFetch
  timeoutMs?: number
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function wholeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

function accountStatus(value: unknown): LatamTvAccountStatus | null {
  const raw = wholeNumber(value)
  if (raw === 1) return "enabled"
  if (raw === 0) return "disabled"
  return null
}

function macs(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()]
    return []
  })
}

function plan(record: Record<string, unknown>): LatamTvPlan | null {
  const id = text(record.plan_id)
  const name = text(record.plan_name)
  if (!id && !name) return null
  return { id, name }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function responseCode(payload: Record<string, unknown>): number | null {
  return wholeNumber(payload.code)
}

function clientRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
  const listed = payload.clients
  if (Array.isArray(listed)) {
    return listed.flatMap((item) => {
      const record = asRecord(item)
      return record ? [record] : []
    })
  }
  const single = asRecord(payload.client)
  return single ? [single] : []
}

function recordIdentifier(record: Record<string, unknown>): string | null {
  return (
    abnetNumberFromExternalCode(text(record.id_crm)) ??
    abnetNumberFromExternalCode(text(record.identificador))
  )
}

function toClient(record: Record<string, unknown>, identifier: string): LatamTvClient {
  return {
    identifier,
    iptvId: text(record.id_iptv),
    username: text(record.usuario),
    nationalId: text(record.dni),
    status: accountStatus(record.status),
    firstName: text(record.nombre),
    lastName: text(record.apellido),
    address: text(record.direccion),
    phone: text(record.telefono),
    deviceCount: wholeNumber(record.cantidad_dispositivos),
    createdAt: text(record.fecha_creacion),
    updatedAt: text(record.fecha_modificacion),
    plan: plan(record),
    macs: macs(record.macs),
  }
}

function selectClient(
  records: readonly Record<string, unknown>[],
  identifier: string
): LatamTvClient | null {
  const matched = records.filter((record) => recordIdentifier(record) === identifier)
  if (matched.length > 0) return toClient(matched[0], identifier)
  if (records.length === 1 && recordIdentifier(records[0]) == null) {
    return toClient(records[0], identifier)
  }
  return null
}

/**
 * Read-only lookup. The only LATAM call is POST /api/get-clients.
 */
export async function getLatamTvClientByIdentifier(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamTvLookup> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const token = deps.token.trim()
  const baseUrl = deps.baseUrl.trim()
  if (!token || !baseUrl) throw new LatamTvRequestError("not_configured")

  let endpoint: URL
  try {
    endpoint = new URL(GET_CLIENTS_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
  } catch {
    throw new LatamTvRequestError("not_configured")
  }
  if (endpoint.protocol !== "https:" || endpoint.pathname !== GET_CLIENTS_PATH) {
    throw new LatamTvRequestError("not_configured")
  }
  endpoint.searchParams.set("token", token)

  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  let response: Response
  try {
    response = await fetchImpl(endpoint.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identificador: [identifier] }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    })
  } catch {
    throw new LatamTvRequestError("unavailable")
  }

  if (!response.ok) throw new LatamTvRequestError("unavailable")

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new LatamTvRequestError("unavailable")
  }
  const record = asRecord(payload)
  if (!record) throw new LatamTvRequestError("unavailable")

  const code = responseCode(record)
  if (code === 3) return { found: false }
  if (code !== 1) throw new LatamTvRequestError("unavailable")

  const client = selectClient(clientRecords(record), identifier)
  if (!client) return { found: false }
  return { found: true, client }
}
