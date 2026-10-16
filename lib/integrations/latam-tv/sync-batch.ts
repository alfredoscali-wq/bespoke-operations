import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"

export type LatamSyncMatch = "dni_email" | "dni" | "email"

export type LatamSyncCandidate = {
  iptvId: string
  crmId: string
  match: LatamSyncMatch | null
  latamNationalId: string | null
  latamEmail: string | null
  bespokeNationalId: string | null
  bespokeEmail: string | null
}

export type LatamSyncCatalogRow = {
  iptvId: string | null
  crmId: string | null
  nationalId: string | null
  email: string | null
  status: string | null
  planName: string | null
}

export type LatamSyncPlanStatus = "already_synced" | "ready" | "not_found" | "conflict"

export type LatamSyncDecision = {
  status: LatamSyncPlanStatus
  crmBefore: string | null
  latamStatus: string | null
  planName: string | null
  detail: string
}

export type LatamSyncResultStatus =
  | LatamSyncPlanStatus
  | "synced"
  | "rejected"
  | "error"
  | "verification_failed"

const RESULT_STATUSES = [
  "already_synced",
  "synced",
  "not_found",
  "conflict",
  "rejected",
  "error",
  "verification_failed",
] as const

function digits(value: string | null | undefined): string | null {
  const parsed = (value ?? "").replace(/\D/g, "")
  return parsed || null
}

function emailAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? ""
  if (!trimmed.includes("@")) return null
  return trimmed
}

function sameDigits(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = digits(left)
  const b = digits(right)
  return Boolean(a && b && a === b)
}

function sameEmail(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = emailAddress(left)
  const b = emailAddress(right)
  return Boolean(a && b && a === b)
}

function identityMatches(candidate: LatamSyncCandidate, live: LatamSyncCatalogRow): boolean {
  if (!sameDigits(live.nationalId, candidate.latamNationalId)) return false
  if (!sameEmail(live.email, candidate.latamEmail)) return false
  if (candidate.match === "dni_email" || candidate.match === "dni") {
    if (!sameDigits(live.nationalId, candidate.bespokeNationalId)) return false
  }
  if (candidate.match === "dni_email" || candidate.match === "email") {
    if (!sameEmail(live.email, candidate.bespokeEmail)) return false
  }
  return candidate.match != null
}

function decision(
  status: LatamSyncPlanStatus,
  detail: string,
  live: LatamSyncCatalogRow | null = null
): LatamSyncDecision {
  return {
    status,
    crmBefore: live?.crmId ?? null,
    latamStatus: live?.status ?? null,
    planName: live?.planName ?? null,
    detail,
  }
}

/**
 * Decide la acción de cada coincidencia contra el padrón LATAM ya leído.
 * No llama a la red y no marca `synced`: eso solo lo confirma la reconsulta.
 */
export function planLatamSyncBatch(
  candidates: readonly LatamSyncCandidate[],
  catalog: readonly LatamSyncCatalogRow[]
): LatamSyncDecision[] {
  const byIptv = new Map<string, LatamSyncCatalogRow[]>()
  const byCrm = new Map<string, LatamSyncCatalogRow[]>()
  for (const row of catalog) {
    const iptvId = abnetNumberFromExternalCode(row.iptvId)
    const crmId = abnetNumberFromExternalCode(row.crmId)
    const normalized = { ...row, iptvId, crmId }
    if (iptvId) {
      const group = byIptv.get(iptvId) ?? []
      group.push(normalized)
      byIptv.set(iptvId, group)
    }
    if (crmId && iptvId) {
      const group = byCrm.get(crmId) ?? []
      group.push(normalized)
      byCrm.set(crmId, group)
    }
  }

  const claimants = new Map<string, number>()
  for (const candidate of candidates) {
    const crmId = abnetNumberFromExternalCode(candidate.crmId)
    if (!crmId) continue
    claimants.set(crmId, (claimants.get(crmId) ?? 0) + 1)
  }

  return candidates.map((candidate) => {
    const iptvId = abnetNumberFromExternalCode(candidate.iptvId)
    const crmId = abnetNumberFromExternalCode(candidate.crmId)
    if (!iptvId || !crmId) {
      return decision("conflict", "Falta id_iptv o el N° Cliente.")
    }
    if (iptvId === crmId) {
      return decision("conflict", "id_iptv y id_crm no pueden ser el mismo valor.")
    }
    const rows = byIptv.get(iptvId) ?? []
    if (rows.length === 0) return decision("not_found", "LATAM no tiene ese id_iptv.")
    if (rows.length > 1) return decision("conflict", "Hay más de un cliente con ese id_iptv.", rows[0])
    const live = rows[0]
    if (!candidate.match || !identityMatches(candidate, live)) {
      return decision("conflict", "La identidad LATAM no coincide con el cliente Bespoke.", live)
    }
    const owners = (byCrm.get(crmId) ?? []).filter((row) => row.iptvId !== iptvId)
    if (owners.length > 0) {
      return decision("conflict", "Ese N° Cliente ya está asociado a otro id_iptv.", live)
    }
    if (live.crmId && live.crmId !== crmId) {
      return decision("conflict", "Ese id_iptv ya tiene otro id_crm.", live)
    }
    if (live.crmId === crmId) {
      return decision("already_synced", "El id_crm ya está asociado a ese id_iptv.", live)
    }
    if ((claimants.get(crmId) ?? 0) > 1) {
      return decision("conflict", "El N° Cliente está repetido en Coincidencias.", live)
    }
    return decision("ready", "Listo para sincronizar.", live)
  })
}

export function confirmLatamSyncLink(input: {
  iptvId: string
  crmId: string
  probeIptvId: string | null
  probeCrmId: string | null
}): boolean {
  const iptvId = abnetNumberFromExternalCode(input.iptvId)
  const crmId = abnetNumberFromExternalCode(input.crmId)
  return Boolean(
    iptvId &&
      crmId &&
      abnetNumberFromExternalCode(input.probeIptvId) === iptvId &&
      abnetNumberFromExternalCode(input.probeCrmId) === crmId
  )
}

export function summarizeLatamSyncResults(statuses: readonly string[]): Record<
  (typeof RESULT_STATUSES)[number],
  number
> & { total: number } {
  const counts = Object.fromEntries(RESULT_STATUSES.map((status) => [status, 0])) as Record<
    (typeof RESULT_STATUSES)[number],
    number
  >
  for (const status of statuses) {
    if (status in counts) counts[status as (typeof RESULT_STATUSES)[number]] += 1
  }
  return { total: statuses.length, ...counts }
}
