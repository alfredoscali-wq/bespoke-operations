import { normalizeComparisonKey } from "@/lib/customers/normalization/text"
import type { CustomerImportStatus } from "@/lib/customers/customer-import/types"

/** Estado comercial derivado del dump (solo informativo / histórico). */
export type CommercialMigrationStatus =
  | "activo"
  | "pendiente_activacion"
  | "inactivo"
  | "revisar"

/** Bucket del dataset preparado (pre-import). */
export type CommercialMigrationBucket = "listo" | "revisar" | "descartado"

/** Estado de validación informativo en Bespoke (RC1.1). */
export type CustomerValidationStatus = "active" | "review"

export type LegacyClientState = "A" | "B" | "P" | string

export type LegacyConnectionState = "A" | "B" | "M" | "C" | "I" | "P" | string

export type MigrationStatusResolution = {
  migrationStatus: CommercialMigrationStatus
  bespokeStatus: CustomerImportStatus
  bucket: CommercialMigrationBucket
  validationStatus: CustomerValidationStatus | null
  reasons: string[]
}

const IMPORT_STATUS_LOOKUP = new Map<string, CustomerImportStatus>([
  ["activo", "activo"],
  ["active", "activo"],
  ["inactivo", "inactivo"],
  ["inactive", "inactivo"],
])

export function resolveImportStatus(value: unknown): CustomerImportStatus {
  const raw = String(value ?? "").trim()
  if (!raw) return ""

  return IMPORT_STATUS_LOOKUP.get(normalizeComparisonKey(raw)) ?? ""
}

function resolveLegacyCommercialStatus(
  legacyClientState: LegacyClientState
): CommercialMigrationStatus {
  const state = String(legacyClientState ?? "").trim().toUpperCase()

  if (state === "P") return "pendiente_activacion"
  if (state === "B") return "inactivo"
  if (state === "A") return "activo"

  return "revisar"
}

export function resolveValidationStatusFromBucket(
  bucket: CommercialMigrationBucket
): CustomerValidationStatus | null {
  if (bucket === "listo") return "active"
  if (bucket === "revisar") return "review"
  return null
}

/**
 * RC1.1 — Clientes operativos.
 *
 * Importable: al menos una conexión asociada (cualquier estado A/B/C/M/I/P).
 * Descartado: sin conexiones o cliente de prueba.
 * El estado de las conexiones NO determina importabilidad.
 */
export function resolveMigrationStatus(input: {
  legacyClientState: LegacyClientState
  hasAnyConnection: boolean
  isTestClient: boolean
}): MigrationStatusResolution {
  const reasons: string[] = []
  const migrationStatus = resolveLegacyCommercialStatus(input.legacyClientState)

  if (input.isTestClient) {
    reasons.push("cliente de prueba")
    return {
      migrationStatus: "inactivo",
      bespokeStatus: "",
      bucket: "descartado",
      validationStatus: null,
      reasons,
    }
  }

  if (!input.hasAnyConnection) {
    reasons.push("Sin conexiones asociadas")
    return {
      migrationStatus: "inactivo",
      bespokeStatus: "",
      bucket: "descartado",
      validationStatus: null,
      reasons,
    }
  }

  return {
    migrationStatus,
    bespokeStatus: "activo",
    bucket: "listo",
    validationStatus: "active",
    reasons,
  }
}
