import { LatamTvRequestError } from "@/lib/integrations/latam-tv/errors"
import { readLatamOperationalIdentifier } from "@/lib/integrations/latam-tv/operational-identifier"
import type { LatamTvAccountStatus } from "@/lib/integrations/latam-tv/types"

/**
 * LATAM no ofrece búsqueda por DNI ni por email.
 * GET /api/get-clients sin filtro devuelve el padrón, con `dni` y `usuario`.
 * El parámetro operativo se llama `identificador`, pero el padrón real no lo
 * trae e `id_crm` llega vacío. Esos dos campos son solo candidatos de catálogo.
 * `id_iptv` y el N° ABNet no son el identificador operativo.
 */
export type LatamCatalogClient = {
  identifier: string | null
  iptvId: string | null
  nationalId: string | null
  email: string | null
  status: LatamTvAccountStatus | null
  planName: string | null
  displayName: string | null
  /** Campo `identificador` confirmado. No es id_crm, id_iptv ni el N° de Bespoke. */
  operationalIdentifier: string | null
}

export type LatamIdentityCandidate = {
  identifier: string | null
  matchedOn: "dni" | "email" | "both"
  status: LatamTvAccountStatus | null
  planName: string | null
  displayName: string | null
}

export type LatamIdentityResolution =
  | {
      outcome: "matched"
      identifier: string | null
      status: LatamTvAccountStatus | null
      planName: string | null
      displayName: string | null
      source: "dni_email" | "link"
    }
  | {
      outcome: "partial_match"
      matchedOn: "dni" | "email"
      candidates: LatamIdentityCandidate[]
    }
  | { outcome: "not_found"; reason: "no_match" | "missing_identity" }
  | { outcome: "ambiguous"; candidates: LatamIdentityCandidate[] }

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function digits(value: string | null | undefined): string | null {
  const parsed = (value ?? "").replace(/\D/g, "")
  return parsed || null
}

function emailAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? ""
  if (!trimmed.includes("@")) return null
  return trimmed
}

function accountStatus(value: unknown): LatamTvAccountStatus | null {
  const raw = text(value)
  if (raw === "1" || raw === "enabled") return "enabled"
  if (raw === "0" || raw === "disabled") return "disabled"
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function displayName(record: Record<string, unknown>): string | null {
  const first = text(record.nombre ?? record.nombres)
  const last =
    text(record.apellido) ??
    [text(record.appaterno), text(record.apmaterno)].filter((part): part is string => part != null).join(" ")
  const parts = [first, last || null].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" ") : null
}

/** Candidato leído del padrón. No confirma el identificador operativo. */
export function latamApiIdentifier(record: Record<string, unknown>): string | null {
  return text(record.id_crm) ?? text(record.identificador)
}

export function latamCatalogClient(record: Record<string, unknown>): LatamCatalogClient {
  const operational = readLatamOperationalIdentifier(record)
  return {
    identifier: latamApiIdentifier(record),
    iptvId: text(record.id_iptv),
    nationalId: digits(text(record.dni)),
    email: emailAddress(text(record.usuario) ?? text(record.correo)),
    status: accountStatus(record.status ?? record.estado),
    planName: text(record.plan_name ?? record.plan_nombre),
    displayName: displayName(record),
    operationalIdentifier: operational.case === "confirmed" ? operational.value : null,
  }
}

export function readLatamClientCatalog(payload: Record<string, unknown>): LatamCatalogClient[] {
  const code = text(payload.code)
  if (code !== "1") throw new LatamTvRequestError("unavailable")
  const listed = Array.isArray(payload.clients)
    ? payload.clients
    : Array.isArray(payload.clientes)
      ? payload.clientes
      : null
  if (!listed) throw new LatamTvRequestError("unavailable")
  return listed.flatMap((item) => {
    const record = asRecord(item)
    return record ? [latamCatalogClient(record)] : []
  })
}

function candidate(
  client: LatamCatalogClient,
  matchedOn: LatamIdentityCandidate["matchedOn"]
): LatamIdentityCandidate {
  return {
    identifier: client.identifier,
    matchedOn,
    status: client.status,
    planName: client.planName,
    displayName: client.displayName,
  }
}

export function resolveLatamIdentity(
  clients: readonly LatamCatalogClient[],
  input: {
    nationalId?: string | null
    email?: string | null
    linkedIdentifier?: string | null
  }
): LatamIdentityResolution {
  const nationalId = digits(input.nationalId)
  const email = emailAddress(input.email)
  const linkedIdentifier = input.linkedIdentifier?.trim() || null

  if (linkedIdentifier) {
    const linked = clients.find((client) => client.identifier === linkedIdentifier)
    if (linked) {
      return {
        outcome: "matched",
        identifier: linked.identifier,
        status: linked.status,
        planName: linked.planName,
        displayName: linked.displayName,
        source: "link",
      }
    }
  }

  if (!nationalId && !email) {
    return { outcome: "not_found", reason: "missing_identity" }
  }

  const hits = clients.flatMap((client) => {
    const dni = nationalId != null && client.nationalId === nationalId
    const mail = email != null && client.email === email
    if (!dni && !mail) return []
    const matchedOn: LatamIdentityCandidate["matchedOn"] =
      dni && mail ? "both" : dni ? "dni" : "email"
    return [{ client, matchedOn }]
  })
  const full = hits.filter((hit) => hit.matchedOn === "both")
  if (full.length === 1) {
    const client = full[0].client
    return {
      outcome: "matched",
      identifier: client.identifier,
      status: client.status,
      planName: client.planName,
      displayName: client.displayName,
      source: "dni_email",
    }
  }
  if (full.length > 1 || hits.length > 1) {
    return {
      outcome: "ambiguous",
      candidates: hits.map((hit) => candidate(hit.client, hit.matchedOn)),
    }
  }
  if (hits.length === 1) {
    const hit = hits[0]
    return {
      outcome: "partial_match",
      matchedOn: hit.matchedOn === "email" ? "email" : "dni",
      candidates: [candidate(hit.client, hit.matchedOn === "email" ? "email" : "dni")],
    }
  }
  return { outcome: "not_found", reason: "no_match" }
}
