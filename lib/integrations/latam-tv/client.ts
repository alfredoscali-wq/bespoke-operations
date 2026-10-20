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
  LATAM_SIGNUP_MISSING_BOTH,
  LATAM_SIGNUP_MISSING_DNI,
  LATAM_SIGNUP_MISSING_EMAIL,
  latamInitialPassword,
  latamRegisterRejectionMessage,
  toLatamRegisterRequest,
  type LatamRegisterBody,
} from "@/lib/integrations/latam-tv/signup"
import {
  latamIptvId,
  type LatamSignupAttemptSnapshot,
  type LatamSignupAttemptStore,
} from "@/lib/integrations/latam-tv/signup-attempt"
import { latamCatalogClient, readLatamClientCatalog, resolveLatamIdentity } from "@/lib/integrations/latam-tv/identity"
import {
  confirmLatamSyncLink,
  planLatamSyncBatch,
  type LatamSyncCatalogRow,
} from "@/lib/integrations/latam-tv/sync-batch"
import { readLatamOperationalIdentifier } from "@/lib/integrations/latam-tv/operational-identifier"
import type { LatamCatalogClient } from "@/lib/integrations/latam-tv/identity"
import type { LatamBatchClient } from "@/lib/integrations/latam-tv/lookup-state"
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
const SYNC_CLIENT_PATH = "/api/sync-client"
const REQUEST_TIMEOUT_MS = 12_000

const signupTails = new Map<string, Promise<unknown>>()

function identitySignupKey(body: LatamRegisterBody): string {
  return `identity:${body.dni.replace(/\D/g, "")}:${body.correo.trim().toLowerCase()}`
}

export type LatamTvClientDeps = {
  baseUrl: string
  token: string
  fetchImpl?: LatamTvFetch
  timeoutMs?: number
  /** Reserva persistente del alta nueva. El alta histórico no la usa. */
  signupAttempt?: LatamSignupAttemptStore
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

/** Alta documentada: error false y code 1. Un HTTP 200 sin ese par no es éxito. */
function documentedRegisterSuccess(record: Record<string, unknown>): boolean {
  return record.error === false && responseCode(record) === 1
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

/**
 * get-clients filtrado por un solo N° ABNet.
 * Una fila única sin `identificador` ni `id_crm` es el padrón real: el `id_iptv` de esa fila es el abonado.
 * Dos filas, o una fila con otro `id_crm` / `identificador`, no se asocian.
 * El nombre, el correo y el DNI no eligen la fila.
 */
function filteredCatalogShape(
  records: readonly Record<string, unknown>[],
  identifier: string
): "unique" | "ambiguous" | "absent" {
  if (records.length === 0) return "absent"
  let ours = 0
  let others = 0
  let unkeyed = 0
  for (const row of records) {
    const id = recordIdentifier(row)
    if (id == null) unkeyed += 1
    else if (id === identifier) ours += 1
    else others += 1
  }
  if (ours > 1 || unkeyed > 1) return "ambiguous"
  if (ours === 1 && unkeyed === 0 && others === 0) return "unique"
  if (ours === 1 && (unkeyed > 0 || others > 0)) return "ambiguous"
  if (others > 0) return "absent"
  if (unkeyed === 1) return "unique"
  return "absent"
}

function selectClient(
  records: readonly Record<string, unknown>[],
  identifier: string
): LatamTvClient | null {
  if (filteredCatalogShape(records, identifier) !== "unique") return null
  const matched = records.filter((record) => recordIdentifier(record) === identifier)
  if (matched.length === 1) return toClient(matched[0], identifier)
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
    if (path === REGISTER_CLIENT_PATH) {
      logRegisterClient({ httpStatus: null, responseCode: null, error: "network" })
    }
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
        throw new LatamTvRequestError("unavailable", response.status)
      }
    }
    if (path === REGISTER_CLIENT_PATH) {
      logRegisterClient({
        httpStatus: response.status,
        responseCode: await responseCodeOf(response),
        error: "http",
      })
    }
    throw new LatamTvRequestError("unavailable", response.status)
  }

  let parsed: unknown
  try {
    parsed = await response.json()
  } catch {
    if (path === REGISTER_CLIENT_PATH) {
      logRegisterClient({
        httpStatus: response.status,
        responseCode: null,
        error: "invalid_json",
      })
    }
    throw new LatamTvRequestError("unavailable")
  }
  const record = asRecord(parsed)
  if (!record) {
    if (path === REGISTER_CLIENT_PATH) {
      logRegisterClient({
        httpStatus: response.status,
        responseCode: null,
        error: "invalid_json",
      })
    }
    throw new LatamTvRequestError("unavailable")
  }
  if (path === REGISTER_CLIENT_PATH) {
    logRegisterClient({
      httpStatus: response.status,
      responseCode: responseCode(record),
      error: null,
    })
  }
  return record
}

/** Diagnóstico de register-client. No incluye el cuerpo, el token ni la contraseña. */
function logRegisterClient(detail: {
  httpStatus: number | null
  responseCode: number | null
  error: "network" | "http" | "invalid_json" | null
}) {
  console.error(
    "LATAM register-client",
    JSON.stringify({
      httpStatus: detail.httpStatus,
      responseCode: detail.responseCode,
      error: detail.error,
    })
  )
}

async function responseCodeOf(response: Response): Promise<number | null> {
  try {
    const record = asRecord(await response.clone().json())
    return record ? responseCode(record) : null
  } catch {
    return null
  }
}

/** Catálogo de solo lectura. POST /api/get-plans. Éxito: error false y planes. */
export async function getLatamTvPlans(deps: LatamTvClientDeps): Promise<LatamTvCatalogPlan[]> {
  const record = await postLatam(GET_PLANS_PATH, {}, deps)
  return readLatamTvPlansPayload(record)
}

/**
 * Padrón de solo lectura. GET /api/get-clients sin identificador.
 * LATAM no filtra por DNI ni por email.
 */
export async function listLatamTvClients(
  deps: LatamTvClientDeps
): Promise<LatamCatalogClient[]> {
  const record = await postLatam(GET_CLIENTS_PATH, {}, deps, { method: "GET" })
  return readLatamClientCatalog(record)
}

export type LatamTvIdentifierProbe = {
  code: number | null
  message: string | null
  client: LatamCatalogClient | null
}

/** Lectura. GET /api/get-clients con { identificador: [n] }. No escribe. */
export async function probeLatamTvIdentifier(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamTvIdentifierProbe> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const record = await postLatam(
    GET_CLIENTS_PATH,
    { identificador: [identifier] },
    deps,
    { method: "GET" }
  )
  const rows = clientRecords(record)
  return {
    code: responseCode(record),
    message: text(record.message),
    client: rows[0] ? latamCatalogClient(rows[0]) : null,
  }
}

export type LatamTvClientLink = {
  code: number | null
  iptvId: string | null
  crmId: string | null
}

/** Lee el id_crm guardado en el cliente. No usa id_iptv como identificador. */
export async function readLatamClientLink(
  identificador: string,
  deps: LatamTvClientDeps
): Promise<LatamTvClientLink> {
  const identifier = abnetNumberFromExternalCode(identificador)
  if (!identifier) throw new LatamTvRequestError("invalid_identifier")
  const record = await postLatam(
    GET_CLIENTS_PATH,
    { identificador: [identifier] },
    deps,
    { method: "GET" }
  )
  const rows = clientRecords(record)
  const matched =
    rows.find((row) => abnetNumberFromExternalCode(text(row.id_crm)) === identifier) ??
    (rows.length === 1 ? rows[0] : null)
  return {
    code: responseCode(record),
    iptvId: matched ? text(matched.id_iptv) : null,
    crmId: matched ? abnetNumberFromExternalCode(text(matched.id_crm)) : null,
  }
}

export type LatamTvSyncResult = {
  outcome: "updated" | "iptv_not_found" | "crm_already_registered" | "update_failed" | "rejected"
  code: number | null
  error: number | null
  message: string | null
}

/**
 * Vincula id_iptv con id_crm. POST /api/sync-client, una sola vez.
 * id_iptv y id_crm son campos distintos: no se copia uno en el otro.
 * Una respuesta sin code 1, 3, 4 o 5 no se reintenta.
 */
export function latamSyncClientBody(input: {
  idIptv: string
  idCrm: string
}): { id_iptv: string; id_crm: string } {
  const idIptv = abnetNumberFromExternalCode(input.idIptv)
  const idCrm = abnetNumberFromExternalCode(input.idCrm)
  if (!idIptv || !idCrm || idIptv === idCrm) {
    throw new LatamTvRequestError("invalid_identifier")
  }
  return { id_iptv: idIptv, id_crm: idCrm }
}

export async function syncLatamTvClient(
  input: { idIptv: string; idCrm: string },
  deps: LatamTvClientDeps
): Promise<LatamTvSyncResult> {
  const body = latamSyncClientBody(input)
  const record = await postLatam(SYNC_CLIENT_PATH, body, deps)
  const code = responseCode(record)
  const error = wholeNumber(record.error)
  const message = text(record.message)
  if (code === 1) return { outcome: "updated", code: 1, error, message }
  if (code === 3) return { outcome: "iptv_not_found", code: 3, error, message }
  if (code === 4) return { outcome: "crm_already_registered", code: 4, error, message }
  if (code === 5) return { outcome: "update_failed", code: 5, error, message }
  return { outcome: "rejected", code, error, message }
}

export type LatamAbnetLinkPlan =
  | { action: "link"; iptvId: string; crmId: string }
  | { action: "already_linked"; iptvId: string; crmId: string }
  | { action: "signup" }
  | { action: "review"; reason: "missing_identity" | "ambiguous" | "partial" | "incompatible" }

/**
 * Decide si un abonado ABNet puede vincularse a una ficha LATAM ya existente.
 * Exige DNI y email en una sola fila, un id_iptv distinto del N° ABNet
 * y ningún id_crm incompatible. No llama a la red.
 */
export function planLatamAbnetLink(input: {
  abnetNumber: string
  nationalId: string | null
  email: string | null
  catalog: readonly LatamCatalogClient[]
}): LatamAbnetLinkPlan {
  const crmId = abnetNumberFromExternalCode(input.abnetNumber)
  if (!crmId) return { action: "review", reason: "incompatible" }
  const nationalDigits = (input.nationalId ?? "").replace(/\D/g, "")
  const emailAddress = (input.email ?? "").trim().toLowerCase()
  if (!nationalDigits || !emailAddress.includes("@")) {
    return { action: "review", reason: "missing_identity" }
  }
  const identity = resolveLatamIdentity(input.catalog, {
    nationalId: input.nationalId,
    email: input.email,
  })
  if (identity.outcome === "not_found") {
    return identity.reason === "missing_identity"
      ? { action: "review", reason: "missing_identity" }
      : { action: "signup" }
  }
  if (identity.outcome === "partial_match") return { action: "review", reason: "partial" }
  if (identity.outcome === "ambiguous") return { action: "review", reason: "ambiguous" }
  if (identity.outcome !== "matched" || identity.source !== "dni_email") {
    return { action: "review", reason: "incompatible" }
  }
  const nationalId = nationalDigits
  const email = emailAddress
  const rows = input.catalog.filter(
    (client) => client.nationalId === nationalId && client.email === email
  )
  if (rows.length !== 1) return { action: "review", reason: "ambiguous" }
  const iptvId = latamIptvId(rows[0].iptvId)
  if (!iptvId || iptvId === crmId) return { action: "review", reason: "incompatible" }
  const catalogRows: LatamSyncCatalogRow[] = input.catalog.map((client) => ({
    iptvId: client.iptvId,
    crmId: client.identifier,
    nationalId: client.nationalId,
    email: client.email,
    status: client.status,
    planName: client.planName,
  }))
  const decision = planLatamSyncBatch(
    [
      {
        iptvId,
        crmId,
        match: "dni_email",
        latamNationalId: rows[0].nationalId,
        latamEmail: rows[0].email,
        bespokeNationalId: nationalId,
        bespokeEmail: email,
      },
    ],
    catalogRows
  )[0]
  if (decision.status === "already_synced") return { action: "already_linked", iptvId, crmId }
  if (decision.status === "ready") return { action: "link", iptvId, crmId }
  return { action: "review", reason: "incompatible" }
}

export type LatamAbnetLinkResult =
  | { outcome: "linked"; iptvId: string; crmId: string }
  | { outcome: "signup" }
  | { outcome: "review"; reason: "missing_identity" | "ambiguous" | "partial" | "incompatible" | "unavailable" }
  | { outcome: "sync_failed" }
  | { outcome: "verification_failed" }
  | { outcome: "busy" }

const latamLinkInFlight = new Set<string>()

/**
 * Vincula una ficha LATAM existente. Vuelve a leer el padrón antes de escribir.
 * Como máximo un POST /api/sync-client, y solo si el plan sigue siendo vinculable.
 * Después exige que get-clients confirme el mismo id_iptv y el mismo id_crm.
 */
export async function linkExistingLatamTvClient(
  input: {
    customerId: string
    abnetNumber: string
    nationalId: string | null
    email: string | null
  },
  deps: LatamTvClientDeps
): Promise<LatamAbnetLinkResult> {
  const customerId = input.customerId.trim()
  if (!customerId) return { outcome: "review", reason: "incompatible" }
  if (latamLinkInFlight.has(customerId)) return { outcome: "busy" }
  const preliminary = planLatamAbnetLink({ ...input, catalog: [] })
  if (
    preliminary.action === "review" &&
    (preliminary.reason === "missing_identity" ||
      (preliminary.reason === "incompatible" && !abnetNumberFromExternalCode(input.abnetNumber)))
  ) {
    return { outcome: "review", reason: preliminary.reason }
  }
  latamLinkInFlight.add(customerId)
  try {
    let catalog: LatamCatalogClient[]
    try {
      catalog = await listLatamTvClients(deps)
    } catch {
      return { outcome: "review", reason: "unavailable" }
    }
    const plan = planLatamAbnetLink({ ...input, catalog })
    if (plan.action === "signup") return { outcome: "signup" }
    if (plan.action === "review") return { outcome: "review", reason: plan.reason }
    if (plan.action === "link") {
      let synced: LatamTvSyncResult
      try {
        synced = await syncLatamTvClient({ idIptv: plan.iptvId, idCrm: plan.crmId }, deps)
      } catch {
        return { outcome: "sync_failed" }
      }
      if (synced.outcome !== "updated") return { outcome: "sync_failed" }
    }
    let probe: LatamTvClientLink
    try {
      probe = await readLatamClientLink(plan.crmId, deps)
    } catch {
      return { outcome: "verification_failed" }
    }
    const confirmed = confirmLatamSyncLink({
      iptvId: plan.iptvId,
      crmId: plan.crmId,
      probeIptvId: probe.iptvId,
      probeCrmId: probe.crmId,
    })
    if (!confirmed) return { outcome: "verification_failed" }
    return { outcome: "linked", iptvId: plan.iptvId, crmId: plan.crmId }
  } finally {
    latamLinkInFlight.delete(customerId)
  }
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
  const records = clientRecords(record)
  if (filteredCatalogShape(records, identifier) === "ambiguous") {
    return { found: false, ambiguous: true }
  }
  const client = selectClient(records, identifier)
  if (!client) return { found: false }
  if (!client.status) throw new LatamTvRequestError("unavailable")
  return { found: true, client }
}

const LATAM_FALLBACK_CONCURRENCY = 4

export type LatamIdentifierClassification =
  | LatamBatchClient
  | {
      phase: "unresolved"
      identifier: null
      iptvId: null
      username: null
      planName: null
    }

function batchEntry(
  phase: LatamBatchClient["phase"] | "unresolved",
  identifier: string | null = null,
  username: string | null = null,
  planName: string | null = null,
  iptvId: string | null = null
): LatamIdentifierClassification {
  if (phase === "unresolved") {
    return { phase, identifier: null, iptvId: null, username: null, planName: null }
  }
  return { phase, identifier, iptvId, username, planName }
}

function isResolvedLatamClient(
  entry: LatamIdentifierClassification
): entry is LatamBatchClient {
  return entry.phase !== "unresolved"
}

function listedIdentifierSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set()
  return new Set(
    value.flatMap((item) => {
      const number = abnetNumberFromExternalCode(text(item))
      return number ? [number] : []
    })
  )
}

/**
 * Clasifica un GET /api/get-clients con varios identificadores.
 * La clave es id_crm o identificador. id_iptv no identifica la fila.
 * code 3 no alcanza para marcar a todo el lote: solo noregistrados es no registrado.
 * Un id ausente de clients y de noregistrados queda unresolved.
 */
export function classifyLatamIdentifierBatch(
  requested: readonly string[],
  record: Record<string, unknown> | null
): Record<string, LatamIdentifierClassification> {
  const ids = [
    ...new Set(
      requested.flatMap((value) => {
        const number = abnetNumberFromExternalCode(value)
        return number ? [number] : []
      })
    ),
  ]
  const unavailable = Object.fromEntries(ids.map((id) => [id, batchEntry("unavailable")]))
  if (!record) return unavailable
  const code = responseCode(record)
  if (code !== 1 && code !== 3) return unavailable
  const found = new Map<string, LatamBatchClient>()
  for (const row of clientRecords(record)) {
    const identifier = recordIdentifier(row)
    if (!identifier || !ids.includes(identifier)) continue
    const client = latamCatalogClient(row)
    if (client.status === "enabled") {
      found.set(identifier, {
        phase: "active",
        identifier,
        iptvId: client.iptvId,
        username: client.email,
        planName: client.planName,
      })
    } else if (client.status === "disabled") {
      found.set(identifier, {
        phase: "suspended",
        identifier,
        iptvId: client.iptvId,
        username: client.email,
        planName: client.planName,
      })
    } else {
      found.set(identifier, {
        phase: "unavailable",
        identifier: null,
        iptvId: client.iptvId,
        username: null,
        planName: null,
      })
    }
  }
  const unregistered = listedIdentifierSet(record.noregistrados)
  return Object.fromEntries(
    ids.map((id) => {
      const client = found.get(id)
      if (client) return [id, client]
      if (unregistered.has(id)) return [id, batchEntry("unregistered")]
      return [id, batchEntry("unresolved")]
    })
  )
}

async function fallbackLatamIdentifier(
  id: string,
  deps: LatamTvClientDeps
): Promise<LatamBatchClient> {
  try {
    const record = await postLatam(
      GET_CLIENTS_PATH,
      { identificador: [id] },
      deps,
      { method: "GET" }
    )
    const entry = classifyLatamIdentifierBatch([id], record)[id]
    if (entry && isResolvedLatamClient(entry)) return entry
    if (responseCode(record) === 3) return { phase: "unregistered", identifier: null, iptvId: null, username: null, planName: null }
    return { phase: "unavailable", identifier: null, iptvId: null, username: null, planName: null }
  } catch {
    return { phase: "unavailable", identifier: null, iptvId: null, username: null, planName: null }
  }
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await run(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

/** Lectura agrupada. GET /api/get-clients con { identificador: [n, ...] }. No escribe. */
export async function readLatamClientsByIdentifiers(
  identificadores: readonly string[],
  deps: LatamTvClientDeps
): Promise<Record<string, LatamBatchClient>> {
  const ids = [
    ...new Set(
      identificadores.flatMap((value) => {
        const number = abnetNumberFromExternalCode(value)
        return number ? [number] : []
      })
    ),
  ]
  if (ids.length === 0) return {}
  const record = await postLatam(GET_CLIENTS_PATH, { identificador: ids }, deps, { method: "GET" })
  const classified = classifyLatamIdentifierBatch(ids, record)
  const pending = ids.filter((id) => classified[id]?.phase === "unresolved")
  const resolved = new Map<string, LatamBatchClient>()
  for (const id of ids) {
    const entry = classified[id]
    if (entry && isResolvedLatamClient(entry)) resolved.set(id, entry)
  }
  const fallbacks = await mapWithConcurrency(pending, LATAM_FALLBACK_CONCURRENCY, (id) =>
    fallbackLatamIdentifier(id, deps)
  )
  pending.forEach((id, index) => resolved.set(id, fallbacks[index]))
  return Object.fromEntries(
    ids.map((id) => [
      id,
      resolved.get(id) ?? {
        phase: "unavailable",
        identifier: null,
        iptvId: null,
        username: null,
        planName: null,
      },
    ])
  )
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
  | {
      outcome: "created"
      status: "enabled" | "disabled"
      identifier: string
      iptvId: string | null
      planName: string | null
      username: string | null
    }
  | {
      outcome: "already_exists"
      status: LatamTvAccountStatus | null
      identifier?: string | null
      iptvId?: string | null
    }
  | { outcome: "pending_sync"; message: string }
  | { outcome: "failed"; message: string }
  | { outcome: "unverified"; message: string }
  | { outcome: "rejected"; code: number; message: string }

const SIGNUP_PENDING =
  "LATAM todavía no informó el identificador del alta. Se puede reintentar la consulta sin crear otro usuario."
const SIGNUP_STILL_PENDING =
  "El alta anterior sigue pendiente. LATAM todavía no informó el identificador del alta. Se puede reintentar la consulta sin crear otro usuario."
const SIGNUP_QUERIED_STILL_PENDING =
  "Consulta realizada. LATAM todavía no informa el identificador del alta; el estado sigue pendiente. Podés volver a consultar más tarde."
const SIGNUP_FAILED =
  "LATAM no muestra este usuario. La consulta cerró el intento anterior y no creó otro. Se puede iniciar un alta nuevo."
const SIGNUP_REVIEW =
  "La identidad no quedó confirmada en Latam. El alta sigue pendiente de confirmación y no se enviará de nuevo automáticamente. Hay que reconsultar la identidad en Latam."

const SIGNUP_UNVERIFIED =
  "LATAM no confirmó el alta. Las acciones siguen deshabilitadas."

function enqueueSignup<T>(identifier: string, run: () => Promise<T>): Promise<T> {
  const previous = signupTails.get(identifier) ?? Promise.resolve()
  const current = previous.then(run, run)
  signupTails.set(identifier, current)
  return current.finally(() => {
    if (signupTails.get(identifier) === current) signupTails.delete(identifier)
  })
}

/**
 * Alta. Consulta get-clients y solo entonces llama a register-client.
 * El alta nuevo reserva la ficha en Supabase antes de enviarla.
 * Si esa reserva no se obtiene, no se envía otra alta.
 */
export function signUpLatamTvClient(
  body: LatamRegisterBody,
  deps: LatamTvClientDeps
): Promise<LatamTvSignupCallResult> {
  const numeric = abnetNumberFromExternalCode(body.identificador)
  const queueKey = numeric ?? identitySignupKey(body)
  return enqueueSignup(queueKey, async () => {
    if (!numeric) return signUpLatamClientByIdentity(body, deps)
    const lookup = await getLatamTvClientByIdentifier(body.identificador ?? "", deps)
    if (!lookup.found && lookup.ambiguous) {
      return { outcome: "rejected", code: 2, message: SIGNUP_REVIEW }
    }
    if (lookup.found) {
      const iptvId = lookup.client.iptvId
      if (iptvId) await deps.signupAttempt?.rememberIptv?.(iptvId).catch(() => "unavailable" as const)
      return {
        outcome: "already_exists",
        status: lookup.client.status,
        identifier: lookup.client.identifier,
        iptvId,
      }
    }
    if (deps.signupAttempt) {
      const held = await reservedAttempt(deps.signupAttempt)
      if (held && held.state !== "rejected") return pendingSignupResult(held)
      let reservation: Awaited<ReturnType<LatamSignupAttemptStore["reserve"]>>
      try {
        reservation = await deps.signupAttempt.reserve()
      } catch {
        throw new LatamTvRequestError("unavailable")
      }
      if (!reservation.granted) {
        return pendingSignupResult({ state: reservation.state, latamCode: reservation.latamCode })
      }
    }
    let record: Record<string, unknown>
    try {
      record = await postLatam(REGISTER_CLIENT_PATH, toLatamRegisterRequest(body), deps)
    } catch (error) {
      if (!deps.signupAttempt) throw error
      await rememberSignupAttempt(deps.signupAttempt, "pending_sync", null)
      if (error instanceof LatamTvRequestError && error.kind === "not_configured") throw error
      return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
    }
    const code = responseCode(record)
    if (documentedRegisterSuccess(record)) {
      const expected = abnetNumberFromExternalCode(body.identificador)
      const confirmed = expected
        ? await getLatamTvClientByIdentifier(expected, deps)
        : { found: false as const }
      if (
        !expected ||
        !confirmed.found ||
        confirmed.client.identifier !== expected ||
        (confirmed.client.status !== "enabled" && confirmed.client.status !== "disabled")
      ) {
        if (deps.signupAttempt) {
          await rememberSignupAttempt(deps.signupAttempt, "pending_sync", code)
          return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
        }
        return { outcome: "unverified", message: SIGNUP_UNVERIFIED }
      }
      const iptvId = latamIptvId(confirmed.client.iptvId, code)
      if (!iptvId) {
        if (deps.signupAttempt) {
          await rememberSignupAttempt(deps.signupAttempt, "pending_sync", code)
          return { outcome: "pending_sync", message: SIGNUP_PENDING }
        }
        return {
          outcome: "created",
          status: confirmed.client.status,
          identifier: expected,
          iptvId: null,
          planName: confirmed.client.plan?.name ?? null,
          username: confirmed.client.username,
        }
      }
      const closed = await rememberSignupAttempt(
        deps.signupAttempt,
        "confirmed",
        code,
        iptvId
      )
      if (deps.signupAttempt && closed !== "saved") {
        return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
      }
      return {
        outcome: "created",
        status: confirmed.client.status,
        identifier: expected,
        iptvId,
        planName: confirmed.client.plan?.name ?? null,
        username: confirmed.client.username,
      }
    }
    if (code === 3) {
      await rememberSignupAttempt(deps.signupAttempt, "pending_sync", code)
      return { outcome: "already_exists", status: null }
    }
    if (deps.signupAttempt) {
      await rememberSignupAttempt(deps.signupAttempt, "pending_sync", code)
      if (storedRejectionCode(code)) await deps.signupAttempt.release().catch(() => "unavailable" as const)
    }
    return {
      outcome: "rejected",
      code: code ?? 2,
      message: latamRegisterRejectionMessage(code ?? 2),
    }
  })
}

type IdentityLocation =
  | {
      kind: "operational"
      status: "enabled" | "disabled"
      identifier: string
      iptvId: string | null
      planName: string | null
    }
  | { kind: "linked" }
  | { kind: "review" }
  | { kind: "missing" }

function locateSignupIdentity(
  catalog: Awaited<ReturnType<typeof listLatamTvClients>>,
  body: LatamRegisterBody
): IdentityLocation {
  const identity = resolveLatamIdentity(catalog, { nationalId: body.dni, email: body.correo })
  if (identity.outcome === "ambiguous" || identity.outcome === "partial_match") {
    return { kind: "review" }
  }
  if (identity.outcome !== "matched") return { kind: "missing" }
  if (identity.status !== "enabled" && identity.status !== "disabled") return { kind: "linked" }
  const nationalId = body.dni.replace(/\D/g, "")
  const email = body.correo.trim().toLowerCase()
  const row = catalog.find(
    (client) =>
      client.nationalId === nationalId &&
      client.email === email &&
      (identity.identifier == null || client.identifier === identity.identifier)
  )
  const operational = abnetNumberFromExternalCode(row?.operationalIdentifier)
  const sent = abnetNumberFromExternalCode(body.identificador)
  if (!operational || (sent != null && operational === sent)) return { kind: "linked" }
  return {
    kind: "operational",
    status: identity.status,
    identifier: operational,
    iptvId: row?.iptvId ?? null,
    planName: identity.planName,
  }
}

function embeddedSignupClient(record: Record<string, unknown>): LatamCatalogClient | null {
  const nested = asRecord(record.client) ?? asRecord(record.cliente)
  const hasClientFields =
    record.dni != null ||
    record.usuario != null ||
    record.correo != null ||
    Object.prototype.hasOwnProperty.call(record, "identificador")
  const source = nested ?? (hasClientFields ? record : null)
  return source ? latamCatalogClient(source) : null
}

function responseOperationalId(record: Record<string, unknown>): string | null {
  const reading = readLatamOperationalIdentifier(record)
  const embedded = embeddedSignupClient(record)
  return (
    abnetNumberFromExternalCode(reading.case === "confirmed" ? reading.value : null) ??
    abnetNumberFromExternalCode(embedded?.operationalIdentifier)
  )
}

function identityResult(location: IdentityLocation): LatamTvSignupCallResult | null {
  if (location.kind === "operational") {
    return {
      outcome: "already_exists",
      status: location.status,
      identifier: location.identifier,
      iptvId: location.iptvId,
    }
  }
  if (location.kind === "linked") return { outcome: "pending_sync", message: SIGNUP_PENDING }
  if (location.kind === "review") {
    return { outcome: "rejected", code: 2, message: SIGNUP_REVIEW }
  }
  return null
}

/** Identificador confirmado de una coincidencia única. No crea usuarios. */
export async function findConfirmedLatamIdentifier(
  input: { dni: string; email: string },
  deps: LatamTvClientDeps
): Promise<string | null> {
  const location = locateSignupIdentity(await listLatamTvClients(deps), {
    nombres: "",
    dni: input.dni,
    correo: input.email,
    password: input.dni,
    plan: "",
  })
  return location.kind === "operational" ? location.identifier : null
}

async function reservedAttempt(
  store: LatamSignupAttemptStore | undefined
): Promise<LatamSignupAttemptSnapshot | null> {
  if (!store) return null
  try {
    return await store.read()
  } catch {
    return null
  }
}

/** Actualiza una reserva ya existente. No crea una fila. */
async function syncReservedAttempt(
  store: LatamSignupAttemptStore | undefined,
  state: "pending_sync" | "confirmed",
  latamCode: number | null,
  iptvId: string | null = null
): Promise<void> {
  const current = await reservedAttempt(store)
  if (!current || current.state === "rejected") return
  if (state === "pending_sync" && current.state !== "register_sent" && current.state !== "pending_sync") return
  await store?.finish(state, latamCode, iptvId).catch(() => "unavailable" as const)
}

function identityCredentialMessage(body: LatamRegisterBody): string | null {
  const dni = latamInitialPassword(body.dni)
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.correo?.trim() ?? "")
  if (!dni && !email) return LATAM_SIGNUP_MISSING_BOTH
  if (!email) return LATAM_SIGNUP_MISSING_EMAIL
  if (!dni) return LATAM_SIGNUP_MISSING_DNI
  return null
}

/** Un código null o no informado deja el alta pendiente.
 *  release solo corre con un código distinto de 1 y 3. */
function storedRejectionCode(code: number | null | undefined): code is number {
  return typeof code === "number" && code !== 1 && code !== 3
}

function pendingSignupResult(
  attempt: LatamSignupAttemptSnapshot | null
): { outcome: "pending_sync"; message: string } {
  if (attempt?.state === "pending_sync" && attempt.latamCode == null) {
    return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
  }
  return { outcome: "pending_sync", message: SIGNUP_PENDING }
}

/** La vista previa no ofrece otro alta mientras la reserva sigue abierta. */
export function heldLatamSignup(
  attempt: LatamSignupAttemptSnapshot | null
): { outcome: "pending_sync"; message: string } | null {
  if (!attempt || attempt.state === "rejected") return null
  return pendingSignupResult(attempt)
}

/** Un padrón completo sin coincidencia cierra un pending_sync con código distinto de 1 y 3.
 *  Un código null no se cierra. Si la fila ya está rejected, se informa sin escribir de nuevo. */
async function catalogMissClosesAttempt(
  store: LatamSignupAttemptStore | undefined
): Promise<boolean> {
  if (!store) return false
  const current = await reservedAttempt(store)
  if (!current) return false
  if (current.state === "rejected") return true
  if (current.state !== "pending_sync") return false
  if (!storedRejectionCode(current.latamCode)) return false
  const released = await store.release().catch(() => "unavailable" as const)
  if (released === "released") return true
  return (await reservedAttempt(store))?.state === "rejected"
}

/** Reconsulta el padrón. No llama a register-client ni crea una reserva. */
export async function refreshLatamSignupIdentity(
  body: LatamRegisterBody,
  deps: LatamTvClientDeps
): Promise<LatamTvSignupCallResult> {
  const before = await reservedAttempt(deps.signupAttempt)
  const location = locateSignupIdentity(await listLatamTvClients(deps), body)
  if (location.kind === "operational") {
    if (location.iptvId) {
      await deps.signupAttempt?.rememberIptv?.(location.iptvId).catch(() => "unavailable" as const)
      await syncReservedAttempt(deps.signupAttempt, "confirmed", null, location.iptvId)
    }
    return identityResult(location) ?? pendingSignupResult(before)
  }
  if (location.kind === "missing") {
    if (await catalogMissClosesAttempt(deps.signupAttempt)) {
      return { outcome: "failed", message: SIGNUP_FAILED }
    }
  }
  if (location.kind !== "review") {
    await syncReservedAttempt(deps.signupAttempt, "pending_sync", null)
  }
  const located = identityResult(location)
  if (located) return located
  if (location.kind === "missing" && before?.state === "pending_sync" && before.latamCode == null) {
    return { outcome: "pending_sync", message: SIGNUP_QUERIED_STILL_PENDING }
  }
  return pendingSignupResult(before)
}

function confirmedIdentitySignup(
  location: IdentityLocation,
  code: number,
  hinted: string | null,
  correo: string
): LatamTvSignupCallResult | null {
  if (location.kind !== "operational") return null
  if (!location.iptvId) return null
  if (hinted && hinted !== location.identifier) return null
  if (code === 3) {
    return {
      outcome: "already_exists",
      status: location.status,
      identifier: location.identifier,
      iptvId: location.iptvId,
    }
  }
  return {
    outcome: "created",
    status: location.status,
    identifier: location.identifier,
    iptvId: location.iptvId,
    planName: location.planName,
    username: correo,
  }
}

/** Un alta confirmada en Latam no se informa si el cierre local no quedó guardado. */
async function closeIdentitySignup(
  store: LatamSignupAttemptStore | undefined,
  code: number | null,
  located: LatamTvSignupCallResult
): Promise<LatamTvSignupCallResult> {
  const iptvId = "iptvId" in located ? located.iptvId ?? null : null
  const closed = await rememberSignupAttempt(store, "confirmed", code, iptvId)
  if (located.outcome === "created" && closed !== "saved") {
    return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
  }
  return located
}

async function rememberSignupAttempt(
  store: LatamSignupAttemptStore | undefined,
  state: "pending_sync" | "confirmed",
  latamCode: number | null,
  iptvId: string | null = null
): Promise<"saved" | "saved_without_iptv" | "unavailable"> {
  if (!store) return "unavailable"
  return store.finish(state, latamCode, iptvId).catch(() => "unavailable" as const)
}

async function signUpLatamClientByIdentity(
  body: LatamRegisterBody,
  deps: LatamTvClientDeps
): Promise<LatamTvSignupCallResult> {
  const credentialMessage = identityCredentialMessage(body)
  if (credentialMessage) return { outcome: "rejected", code: 2, message: credentialMessage }
  const opened = locateSignupIdentity(await listLatamTvClients(deps), body)
  if (opened.kind === "operational") {
    if (opened.iptvId) {
      await deps.signupAttempt?.rememberIptv?.(opened.iptvId).catch(() => "unavailable" as const)
      await syncReservedAttempt(deps.signupAttempt, "confirmed", null, opened.iptvId)
    }
    return identityResult(opened) ?? { outcome: "pending_sync", message: SIGNUP_PENDING }
  }
  const before = identityResult(opened)
  if (before) return before
  if (!deps.signupAttempt) throw new LatamTvRequestError("unavailable")

  let reservation: Awaited<ReturnType<LatamSignupAttemptStore["reserve"]>>
  try {
    reservation = await deps.signupAttempt.reserve()
  } catch {
    throw new LatamTvRequestError("unavailable")
  }
  if (!reservation.granted) {
    return pendingSignupResult({
      state: reservation.state,
      latamCode: reservation.latamCode,
    })
  }

  const payload = { ...body }
  delete payload.identificador
  let record: Record<string, unknown>
  try {
    record = await postLatam(REGISTER_CLIENT_PATH, toLatamRegisterRequest(payload), deps)
  } catch (error) {
    await rememberSignupAttempt(deps.signupAttempt, "pending_sync", null)
    if (error instanceof LatamTvRequestError && error.kind === "not_configured") throw error
    return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
  }

  const code = responseCode(record)
  const accepted = documentedRegisterSuccess(record)
  let catalog: Awaited<ReturnType<typeof listLatamTvClients>> | null = null
  try {
    catalog = await listLatamTvClients(deps)
  } catch {
    catalog = null
  }
  const hinted = responseOperationalId(record)
  const embedded = embeddedSignupClient(record)
  const fromCatalog = catalog ? locateSignupIdentity(catalog, body) : null
  const fromResponse = embedded ? locateSignupIdentity([embedded], body) : null
  if (
    fromCatalog?.kind === "review" ||
    (fromCatalog?.kind !== "operational" && fromResponse?.kind === "review")
  ) {
    await rememberSignupAttempt(deps.signupAttempt, "pending_sync", code)
    return { outcome: "pending_sync", message: SIGNUP_REVIEW }
  }
  const fromCatalogConfirmed = accepted && fromCatalog
    ? confirmedIdentitySignup(fromCatalog, 1, hinted, body.correo)
    : null
  const fromCatalogExisting = code === 3 && fromCatalog
    ? confirmedIdentitySignup(fromCatalog, 3, hinted, body.correo)
    : null
  const locatedInCatalog = fromCatalogConfirmed ?? fromCatalogExisting
  if (locatedInCatalog) {
    return closeIdentitySignup(deps.signupAttempt, code, locatedInCatalog)
  }
  const fromResponseConfirmed = accepted && fromResponse
    ? confirmedIdentitySignup(fromResponse, 1, hinted, body.correo)
    : null
  const fromResponseExisting = code === 3 && fromResponse
    ? confirmedIdentitySignup(fromResponse, 3, hinted, body.correo)
    : null
  const locatedInResponse = fromResponseConfirmed ?? fromResponseExisting
  if (locatedInResponse) {
    return closeIdentitySignup(deps.signupAttempt, code, locatedInResponse)
  }
  await rememberSignupAttempt(deps.signupAttempt, "pending_sync", code)
  if (accepted) return { outcome: "pending_sync", message: SIGNUP_PENDING }
  if (code == null) {
    return { outcome: "pending_sync", message: SIGNUP_STILL_PENDING }
  }
  return {
    outcome: "pending_sync",
    message: `${latamRegisterRejectionMessage(code)} La reserva sigue activa y no se creará otro usuario.`,
  }
}

/** Reconsulta un N° ABNet. No llama a register-client. */
export async function refreshLatamSignupByNumber(
  body: LatamRegisterBody,
  deps: LatamTvClientDeps
): Promise<LatamTvSignupCallResult> {
  const numeric = abnetNumberFromExternalCode(body.identificador)
  if (!numeric) return refreshLatamSignupIdentity(body, deps)
  const before = await reservedAttempt(deps.signupAttempt)
  let lookup: Awaited<ReturnType<typeof getLatamTvClientByIdentifier>>
  try {
    lookup = await getLatamTvClientByIdentifier(numeric, deps)
  } catch {
    return pendingSignupResult(before)
  }
  if (!lookup.found || lookup.client.identifier !== numeric || !lookup.client.iptvId) {
    return pendingSignupResult(before)
  }
  if (lookup.client.status !== "enabled" && lookup.client.status !== "disabled") {
    return pendingSignupResult(before)
  }
  await deps.signupAttempt?.rememberIptv?.(lookup.client.iptvId).catch(() => "unavailable" as const)
  await syncReservedAttempt(
    deps.signupAttempt,
    "confirmed",
    before?.latamCode ?? null,
    lookup.client.iptvId
  )
  return {
    outcome: "already_exists",
    status: lookup.client.status,
    identifier: numeric,
    iptvId: lookup.client.iptvId,
  }
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
