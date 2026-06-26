import {
  normalizeDni,
  normalizeEmail,
  normalizeLocalityName,
  normalizePhone,
  repairLegacyEncoding,
  resolveCommercialTechnology,
  resolveMigrationStatus,
  resolveValidationStatusFromBucket,
  trimString,
} from "@/lib/customers/normalization"
import type { WorkOrderTechnology } from "@/lib/tasks/work-order"
import {
  hasMinimumContactData,
  isTestClientName,
} from "@/lib/customers/commercial-migration/duplicate-detection"
import type {
  LegacyClientRow,
  LegacyConnectionRow,
  PreparedCommercialCustomer,
} from "@/lib/customers/commercial-migration/types"

function pickPrimaryTechnology(
  connections: LegacyConnectionRow[]
): { mapped: WorkOrderTechnology | ""; raw: string } {
  const source = connections

  for (const conn of source) {
    const resolved = resolveCommercialTechnology(conn.tipo)
    if (resolved.ignored) continue
    if (resolved.mapped) {
      return { mapped: resolved.mapped, raw: conn.tipo }
    }
  }

  for (const conn of source) {
    const resolved = resolveCommercialTechnology(conn.tipo)
    if (!resolved.ignored && resolved.raw) {
      return { mapped: "", raw: conn.tipo }
    }
  }

  return { mapped: "", raw: "" }
}

function buildObservations(client: LegacyClientRow): string {
  const parts: string[] = []
  const observ = trimString(client.observ)
  const provincia = trimString(client.provincia)
  const lat = trimString(client.lat)
  const lng = trimString(client.lng)

  if (observ) parts.push(observ)
  if (provincia) parts.push(`Provincia: ${provincia}`)
  if (lat && lng) parts.push(`GPS legacy: ${lat}, ${lng}`)

  return parts.join(" | ")
}

function collectHumanReviewReasons(input: {
  email: ReturnType<typeof normalizeEmail>
  locality: ReturnType<typeof normalizeLocalityName>
  address: string
  technology: { mapped: WorkOrderTechnology | ""; raw: string }
  phone: ReturnType<typeof normalizePhone>
  dni: ReturnType<typeof normalizeDni>
  hasMissingMinimumData: boolean
}): string[] {
  const reasons: string[] = []

  if (input.hasMissingMinimumData) {
    reasons.push("calidad de datos insuficiente")
  }
  if (!input.email.isValid && input.email.raw) {
    reasons.push("email inválido")
  }
  if (input.technology.raw && !input.technology.mapped) {
    reasons.push(`tecnología desconocida: ${input.technology.raw}`)
  }
  if (input.locality.raw && !input.locality.wasMapped) {
    reasons.push("localidad inconsistente")
  } else if (!input.locality.normalized && input.locality.raw) {
    reasons.push("localidad inconsistente")
  }
  if (!input.address) {
    reasons.push("dirección inconsistente")
  }
  if (!input.dni.isValid && input.dni.raw) {
    reasons.push("DNI con longitud atípica")
  }
  if (!input.phone.isValid && input.phone.raw) {
    reasons.push("teléfono con formato dudoso")
  }

  return reasons
}

export function prepareLegacyCustomerRecord(input: {
  client: LegacyClientRow
  connections: LegacyConnectionRow[]
}): PreparedCommercialCustomer {
  const { client, connections } = input
  const name = repairLegacyEncoding(trimString(client.nombre))
  const address = repairLegacyEncoding(trimString(client.domicilio))
  const locality = normalizeLocalityName(client.ciudad)
  const phone = normalizePhone(client.telefono)
  const dni = normalizeDni(client.dnicuit)
  const email = normalizeEmail(client.email)
  const technology = pickPrimaryTechnology(connections)

  const activeConnections = connections.filter((c) => c.estado === "A")
  const hasMissingMinimumData = !hasMinimumContactData({
    phone: phone.national,
    email: email.normalized,
    address,
  })

  const status = resolveMigrationStatus({
    legacyClientState: client.estado,
    hasAnyConnection: connections.length > 0,
    isTestClient: isTestClientName(name),
  })

  const reviewReasons = [...status.reasons]
  let bucket = status.bucket
  let validationStatus = status.validationStatus

  if (bucket !== "descartado") {
    const humanReviewReasons = collectHumanReviewReasons({
      email,
      locality,
      address,
      technology,
      phone,
      dni,
      hasMissingMinimumData,
    })

    if (humanReviewReasons.length > 0) {
      bucket = "revisar"
      validationStatus = "review"
      reviewReasons.push(...humanReviewReasons)
    }
  }

  return {
    legacyId: client.id,
    externalCustomerCode: trimString(client.ncliente),
    name,
    dni: dni.digits,
    phone: phone.national || phone.digits,
    phoneWhatsApp: phone.whatsapp,
    email: email.normalized,
    address,
    locality: locality.normalized,
    localityRaw: locality.raw,
    technology: technology.mapped,
    technologyRaw: technology.raw,
    migrationStatus: status.migrationStatus,
    bespokeStatus: status.bespokeStatus,
    bucket,
    validationStatus:
      validationStatus ?? resolveValidationStatusFromBucket(bucket),
    reviewReasons: [...new Set(reviewReasons)],
    duplicateMatches: [],
    observations: buildObservations(client),
    legacyClientState: client.estado,
    activeConnectionCount: activeConnections.length,
    totalConnectionCount: connections.length,
    connectionIds: connections.map((c) => c.id),
  }
}
