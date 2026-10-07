import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { readLatamTvPlansPayload, type LatamTvCatalogPlan } from "@/lib/integrations/latam-tv/plans"
import {
  latamRegisterRejectionMessage,
  type LatamRegisterBody,
} from "@/lib/integrations/latam-tv/signup"
import type {
  LatamTvAccountStatus,
  LatamTvClient,
  LatamTvFetch,
  LatamTvLookup,
  LatamTvPlan,
} from "@/lib/integrations/latam-tv/types"

const GET_CLIENTS_PATH = "/api/get-clients"
const GET_PLANS_PATH = "/api/get-plans"
const REGISTER_CLIENT_PATH = "/api/register-client"
const REQUEST_TIMEOUT_MS = 12_000

const signupTails = new Map<string, Promise<unknown>>()

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

async function postLatam(
  path: string,
  body: unknown,
  deps: LatamTvClientDeps
): Promise<Record<string, unknown>> {
  const token = deps.token.trim()
  const baseUrl = deps.baseUrl.trim()
  if (!token || !baseUrl) throw new LatamTvRequestError("not_configured")

  let endpoint: URL
  try {
    endpoint = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`)
  } catch {
    throw new LatamTvRequestError("not_configured")
  }
  if (endpoint.protocol !== "https:" || endpoint.pathname !== path) {
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
      body: JSON.stringify(body),
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
  return record
}

/** Catálogo de solo lectura. POST /api/get-plans. */
export async function getLatamTvPlans(deps: LatamTvClientDeps): Promise<LatamTvCatalogPlan[]> {
  const record = await postLatam(GET_PLANS_PATH, {}, deps)
  return readLatamTvPlansPayload(record)
}

/** Lookup. POST /api/get-clients. */
export async function getLatamTvClientByIdentifier(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamTvLookup> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const record = await postLatam(GET_CLIENTS_PATH, { identificador: [identifier] }, deps)
  const code = responseCode(record)
  if (code === 3) return { found: false }
  if (code !== 1) throw new LatamTvRequestError("unavailable")

  const client = selectClient(clientRecords(record), identifier)
  if (!client) return { found: false }
  return { found: true, client }
}

export type LatamTvSignupCallResult =
  | { outcome: "created" }
  | { outcome: "already_exists"; status: LatamTvAccountStatus | null }
  | { outcome: "rejected"; code: number; message: string }

function enqueueSignup<T>(identifier: string, run: () => Promise<T>): Promise<T> {
  const previous = signupTails.get(identifier) ?? Promise.resolve()
  const current = previous.then(run, run)
  signupTails.set(identifier, current)
  return current.finally(() => {
    if (signupTails.get(identifier) === current) signupTails.delete(identifier)
  })
}

/**
 * Alta. Vuelve a consultar get-clients y solo entonces llama a register-client.
 * Dos altas del mismo identificador quedan en serie para no crearlo dos veces.
 */
export function signUpLatamTvClient(
  body: LatamRegisterBody,
  deps: LatamTvClientDeps
): Promise<LatamTvSignupCallResult> {
  return enqueueSignup(body.identificador, async () => {
    const lookup = await getLatamTvClientByIdentifier(body.identificador, deps)
    if (lookup.found) {
      return { outcome: "already_exists", status: lookup.client.status }
    }
    const record = await postLatam(REGISTER_CLIENT_PATH, body, deps)
    const code = responseCode(record)
    if (code === 1) return { outcome: "created" }
    if (code === 3) return { outcome: "already_exists", status: null }
    return {
      outcome: "rejected",
      code: code ?? 2,
      message: latamRegisterRejectionMessage(code ?? 2),
    }
  })
}
