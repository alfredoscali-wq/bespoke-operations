import { request as httpsRequest } from "node:https"

import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { validateLatamTvPassword } from "@/lib/integrations/latam-tv/password"
import {
  latamChangePlanTarget,
  latamCommercialPlanOptions,
  latamPlanNameKey,
  LATAM_FULL_PLAN_UNAVAILABLE,
  matchLatamTvPlans,
  readLatamTvPlansPayload,
  type LatamCommercialPlanOption,
  type LatamTvBespokePlanKind,
  type LatamTvCatalogPlan,
} from "@/lib/integrations/latam-tv/plans"
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
const MODIFY_PASSWORD_PATH = "/api/modify-password"
const MODIFY_CLIENT_PATH = "/api/modify-client"
const DISABLE_CLIENT_PATH = "/api/disable-client"
const ENABLE_CLIENT_PATH = "/api/enable-client"
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
  const name = text(record.plan_name ?? record.plan_nombre)
  if (!id && !name) return null
  return { id, name }
}

function lastName(record: Record<string, unknown>): string | null {
  const combined = text(record.apellido)
  if (combined) return combined
  const parts = [text(record.appaterno), text(record.apmaterno)].filter(
    (part): part is string => part != null
  )
  return parts.length > 0 ? parts.join(" ") : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function responseCode(payload: Record<string, unknown>): number | null {
  return wholeNumber(payload.code)
}

function clientRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
  const listed = Array.isArray(payload.clients)
    ? payload.clients
    : Array.isArray(payload.clientes)
      ? payload.clientes
      : null
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
    status: accountStatus(record.status ?? record.estado),
    firstName: text(record.nombre ?? record.nombres),
    lastName: lastName(record),
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

type LatamRequestOptions = {
  method?: "GET" | "POST"
}

/**
 * get-clients is GET-only. POST returns 405.
 * Node fetch refuses a GET body, and LATAM reads that JSON body, so the
 * real call uses https. Tests pass fetchImpl and never open the network.
 */
function sendGetWithJsonBody(
  endpoint: URL,
  body: string,
  timeoutMs: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      endpoint,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (incoming) => {
        const chunks: Buffer[] = []
        incoming.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        incoming.on("end", () => {
          const payload = Buffer.concat(chunks)
          const contentType = incoming.headers["content-type"]
          resolve(
            new Response(payload, {
              status: incoming.statusCode ?? 502,
              headers: contentType ? { "Content-Type": contentType } : undefined,
            })
          )
        })
      }
    )
    req.on("timeout", () => {
      req.destroy()
      reject(new Error("timeout"))
    })
    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

async function postLatam(
  path: string,
  body: unknown,
  deps: LatamTvClientDeps,
  options: LatamRequestOptions = {}
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

  const method = options.method ?? "POST"
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  const payload = JSON.stringify(body)
  let response: Response
  try {
    if (method === "GET" && !deps.fetchImpl) {
      response = await sendGetWithJsonBody(endpoint, payload, timeoutMs)
    } else {
      const fetchImpl = deps.fetchImpl ?? fetch
      response = await fetchImpl(endpoint.toString(), {
        method: method === "GET" ? "GET" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      })
    }
  } catch {
    throw new LatamTvRequestError("unavailable")
  }

  if (!response.ok) {
    if (path === GET_CLIENTS_PATH && response.status === 404) {
      try {
        const missing = asRecord(await response.json())
        if (
          missing &&
          (responseCode(missing) === 3 || Array.isArray(missing.noregistrados))
        ) {
          return missing
        }
      } catch {
        throw new LatamTvRequestError("unavailable")
      }
    }
    throw new LatamTvRequestError("unavailable")
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    throw new LatamTvRequestError("unavailable")
  }
  const record = asRecord(parsed)
  if (!record) throw new LatamTvRequestError("unavailable")
  return record
}

/** Catálogo de solo lectura. POST /api/get-plans. Éxito: error false y planes. */
export async function getLatamTvPlans(deps: LatamTvClientDeps): Promise<LatamTvCatalogPlan[]> {
  const record = await postLatam(GET_PLANS_PATH, {}, deps)
  return readLatamTvPlansPayload(record)
}

function hasClientList(record: Record<string, unknown>): boolean {
  return (
    Array.isArray(record.clients) ||
    Array.isArray(record.clientes) ||
    asRecord(record.client) != null
  )
}

function interpretGetClients(
  record: Record<string, unknown>,
  identifier: string
): LatamTvLookup {
  const code = responseCode(record)
  if (code === 3) return { found: false }
  if (code !== 1) {
    if (Array.isArray(record.noregistrados)) return { found: false }
    throw new LatamTvRequestError("unavailable")
  }
  if (!hasClientList(record)) throw new LatamTvRequestError("unavailable")
  const client = selectClient(clientRecords(record), identifier)
  if (!client) return { found: false }
  if (!client.status) throw new LatamTvRequestError("unavailable")
  return { found: true, client }
}

/** Lookup. GET /api/get-clients with JSON body { identificador: [n° ABNet] }. */
export async function getLatamTvClientByIdentifier(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamTvLookup> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const record = await postLatam(
    GET_CLIENTS_PATH,
    { identificador: [identifier] },
    deps,
    { method: "GET" }
  )
  return interpretGetClients(record, identifier)
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

export type LatamPasswordChangeResult =
  | { outcome: "changed" }
  | { outcome: "not_found"; message: string }
  | { outcome: "rejected"; message: string }
  | { outcome: "invalid"; message: string }
  | { outcome: "busy"; message: string }

const PASSWORD_NOT_FOUND_NOW =
  "El cliente ya no existe en LATAM TV. No se modificó la contraseña."
const PASSWORD_NOT_FOUND =
  "El cliente no existe en LATAM TV. No se modificó la contraseña."
const PASSWORD_REJECTED =
  "LATAM TV no pudo modificar la contraseña. No se realizaron cambios en Bespoke."
const PASSWORD_BUSY = "El cambio de contraseña ya se está procesando."

const passwordInflight = new Set<string>()

/**
 * Cambia la contraseña de un cliente que ya existe.
 * Vuelve a consultar get-clients y solo entonces llama a modify-password.
 * Un cliente suspendido se modifica igual, sin reactivarlo.
 */
export async function modifyClientPassword(
  identificador: string,
  password: string,
  deps: LatamTvClientDeps
): Promise<LatamPasswordChangeResult> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const invalid = validateLatamTvPassword(password)
  if (invalid) return { outcome: "invalid", message: invalid }
  if (passwordInflight.has(identifier)) {
    return { outcome: "busy", message: PASSWORD_BUSY }
  }

  passwordInflight.add(identifier)
  try {
    const lookup = await getLatamTvClientByIdentifier(identifier, deps)
    if (!lookup.found) {
      return { outcome: "not_found", message: PASSWORD_NOT_FOUND_NOW }
    }
    const record = await postLatam(
      MODIFY_PASSWORD_PATH,
      { identificador: identifier, password },
      deps
    )
    const code = responseCode(record)
    if (code === 1) return { outcome: "changed" }
    if (code === 3) return { outcome: "not_found", message: PASSWORD_NOT_FOUND }
    return { outcome: "rejected", message: PASSWORD_REJECTED }
  } finally {
    passwordInflight.delete(identifier)
  }
}

export type LatamAccountToggle = "disable" | "enable"

export type LatamAccountToggleResult =
  | { outcome: "updated"; status: "enabled" | "disabled" }
  | { outcome: "not_found"; message: string }
  | { outcome: "rejected"; message: string }
  | { outcome: "mismatch"; status: LatamTvAccountStatus | null; message: string }
  | { outcome: "unavailable"; message: string }
  | { outcome: "busy"; message: string }

const STATUS_NOT_FOUND_NOW = "El cliente no existe en LATAM TV."
const STATUS_NOT_FOUND =
  "El cliente no existe en LATAM TV. No se realizó ninguna modificación."
const STATUS_REJECTED =
  "LATAM TV no pudo completar la operación. No se realizaron cambios en Bespoke."
const STATUS_UNAVAILABLE = "No fue posible consultar LATAM TV."
const STATUS_BUSY = "La operación ya se está procesando."

const statusInflight = new Set<string>()

/**
 * Suspende o activa el usuario. Vuelve a consultar get-clients antes y después.
 * El cuerpo solo lleva el identificador: no cambia el plan.
 * Suspender y activar el mismo identificador no corren a la vez.
 */
export function disableClient(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamAccountToggleResult> {
  return toggleLatamClient("disable", identificador, deps)
}

export function enableClient(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamAccountToggleResult> {
  return toggleLatamClient("enable", identificador, deps)
}

async function toggleLatamClient(
  action: LatamAccountToggle,
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamAccountToggleResult> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  if (statusInflight.has(identifier)) {
    return { outcome: "busy", message: STATUS_BUSY }
  }

  statusInflight.add(identifier)
  try {
    const lookup = await getLatamTvClientByIdentifier(identifier, deps)
    if (!lookup.found) {
      return { outcome: "not_found", message: STATUS_NOT_FOUND_NOW }
    }
    const required = action === "disable" ? "enabled" : "disabled"
    if (lookup.client.status !== required) {
      const current = lookup.client.status
      return {
        outcome: "mismatch",
        status: current,
        message:
          current === "disabled"
            ? "El cliente ya está suspendido en LATAM TV."
            : current === "enabled"
              ? "El cliente ya está activo en LATAM TV."
              : STATUS_UNAVAILABLE,
      }
    }

    const record = await postLatam(
      action === "disable" ? DISABLE_CLIENT_PATH : ENABLE_CLIENT_PATH,
      { identificador: identifier },
      deps
    )
    const code = responseCode(record)
    if (code === 3) return { outcome: "not_found", message: STATUS_NOT_FOUND }
    if (code !== 1) return { outcome: "rejected", message: STATUS_REJECTED }

    const confirmed = await getLatamTvClientByIdentifier(identifier, deps)
    if (!confirmed.found) return { outcome: "not_found", message: STATUS_NOT_FOUND }
    if (confirmed.client.status !== "enabled" && confirmed.client.status !== "disabled") {
      return { outcome: "unavailable", message: STATUS_UNAVAILABLE }
    }
    return { outcome: "updated", status: confirmed.client.status }
  } finally {
    statusInflight.delete(identifier)
  }
}

export type LatamPlanChangeKind = LatamTvBespokePlanKind

export type LatamPlanPreview = {
  outcome: "preview"
  status: LatamTvAccountStatus | null
  currentPlanName: string | null
  currentPlanId: string | null
  options: LatamCommercialPlanOption[]
}

export type LatamPlanChangeResult =
  | {
      outcome: "updated"
      status: LatamTvAccountStatus | null
      planName: string | null
      planId: string | null
      previousPlanName: string | null
      requestedPlanName: string
    }
  | {
      outcome: "unverified"
      status: LatamTvAccountStatus | null
      planName: string | null
      planId: string | null
      previousPlanName: string | null
      requestedPlanName: string
      message: string
    }
  | { outcome: "not_found"; message: string; previousPlanName?: string | null; requestedPlanName?: string | null }
  | { outcome: "same_plan"; message: string; previousPlanName: string | null; requestedPlanName: string }
  | { outcome: "plan_missing"; message: string; previousPlanName?: string | null; requestedPlanName?: string | null }
  | { outcome: "rejected"; message: string; previousPlanName?: string | null; requestedPlanName?: string | null }
  | { outcome: "busy"; message: string }

const PLAN_NOT_FOUND = "El cliente no existe en LATAM TV. No se puede cambiar el plan."
const PLAN_NOT_FOUND_AFTER = "El cliente no existe en LATAM TV. No se realizó ningún cambio."
const PLAN_MISSING = "El plan seleccionado no existe en LATAM TV."
const PLAN_SAME = "El cliente ya tiene este plan en LATAM TV."
const PLAN_UNVERIFIED =
  "LATAM informó que el cambio fue realizado, pero no pudimos verificar el nuevo plan."
const PLAN_CURRENT_UNKNOWN = "No fue posible consultar el plan actual en LATAM TV."
const PLAN_BUSY = "El cambio de plan ya se está procesando."

const PLAN_CODE_MESSAGE: Record<number, string> = {
  2: "LATAM TV no pudo completar el cambio de plan.",
  5: "El plan seleccionado no existe en LATAM TV.",
  6: "LATAM TV no pudo asignar el plan seleccionado.",
}

const planInflight = new Set<string>()

function sameLatamPlan(
  currentId: string | null,
  currentName: string | null,
  targetId: string,
  targetName: string
): boolean {
  if (currentId && currentId === targetId) return true
  if (currentName && latamPlanNameKey(currentName) === latamPlanNameKey(targetName)) return true
  return false
}

function confirmedPlan(
  client: LatamTvClient,
  targetId: string,
  targetName: string
): boolean {
  return sameLatamPlan(client.plan?.id ?? null, client.plan?.name ?? null, targetId, targetName)
}

/**
 * Consulta el cliente y el catálogo. No llama a modify-client.
 */
export async function previewLatamPlanChange(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamPlanPreview | { outcome: "not_found"; message: string } | { outcome: "plan_missing"; message: string }> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const lookup = await getLatamTvClientByIdentifier(identifier, deps)
  if (!lookup.found) return { outcome: "not_found", message: PLAN_NOT_FOUND }
  if (!lookup.client.plan?.id && !lookup.client.plan?.name) {
    return { outcome: "plan_missing", message: PLAN_CURRENT_UNKNOWN }
  }
  const options = latamCommercialPlanOptions(matchLatamTvPlans(await getLatamTvPlans(deps)))
  return {
    outcome: "preview",
    status: lookup.client.status,
    currentPlanName: lookup.client.plan?.name ?? null,
    currentPlanId: lookup.client.plan?.id ?? null,
    options,
  }
}

/**
 * Cambia solo el plan. No envía estado, dispositivos ni macs, y no reactiva.
 * Después de code 1 vuelve a consultar get-clients.
 */
export async function changeLatamClientPlan(
  identificador: string,
  kind: LatamPlanChangeKind,
  deps: LatamTvClientDeps
): Promise<LatamPlanChangeResult> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  if (planInflight.has(identifier)) return { outcome: "busy", message: PLAN_BUSY }

  planInflight.add(identifier)
  try {
    const lookup = await getLatamTvClientByIdentifier(identifier, deps)
    if (!lookup.found) return { outcome: "not_found", message: PLAN_NOT_FOUND }
    const current = lookup.client.plan
    if (!current?.id && !current?.name) {
      return { outcome: "plan_missing", message: PLAN_CURRENT_UNKNOWN }
    }

    const diagnosis = matchLatamTvPlans(await getLatamTvPlans(deps))
    const target = latamChangePlanTarget(kind, diagnosis)
    if (!target) {
      return {
        outcome: "plan_missing",
        message: kind === "full" ? LATAM_FULL_PLAN_UNAVAILABLE : PLAN_MISSING,
        previousPlanName: current?.name ?? null,
        requestedPlanName: kind === "full" ? "Plan Full" : null,
      }
    }
    if (sameLatamPlan(current?.id ?? null, current?.name ?? null, target.planId, target.latamName)) {
      return {
        outcome: "same_plan",
        message: PLAN_SAME,
        previousPlanName: current?.name ?? null,
        requestedPlanName: target.latamName,
      }
    }

    const record = await postLatam(
      MODIFY_CLIENT_PATH,
      { identificador: identifier, id_plan: target.planId },
      deps
    )
    const code = responseCode(record)
    if (code === 3) {
      return {
        outcome: "not_found",
        message: PLAN_NOT_FOUND_AFTER,
        previousPlanName: current?.name ?? null,
        requestedPlanName: target.latamName,
      }
    }
    if (code === 5) {
      return {
        outcome: "plan_missing",
        message: PLAN_CODE_MESSAGE[5],
        previousPlanName: current?.name ?? null,
        requestedPlanName: target.latamName,
      }
    }
    if (code === 6 || code === 2 || code !== 1) {
      return {
        outcome: "rejected",
        message: PLAN_CODE_MESSAGE[code ?? 2] ?? PLAN_CODE_MESSAGE[2],
        previousPlanName: current?.name ?? null,
        requestedPlanName: target.latamName,
      }
    }

    const confirmed = await getLatamTvClientByIdentifier(identifier, deps)
    if (!confirmed.found) return { outcome: "not_found", message: PLAN_NOT_FOUND_AFTER }
    const planName = confirmed.client.plan?.name ?? null
    const planId = confirmed.client.plan?.id ?? null
    if (!confirmedPlan(confirmed.client, target.planId, target.latamName)) {
      return {
      outcome: "unverified",
      status: confirmed.client.status,
      planName,
      planId,
      previousPlanName: current?.name ?? null,
      requestedPlanName: target.latamName,
      message: PLAN_UNVERIFIED,
    }
  }
  return {
    outcome: "updated",
    status: confirmed.client.status,
    planName,
    planId,
    previousPlanName: current?.name ?? null,
    requestedPlanName: target.latamName,
  }
  } finally {
    planInflight.delete(identifier)
  }
}
