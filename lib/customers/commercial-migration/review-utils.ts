import { normalizeComparisonKey } from "@/lib/customers/normalization/text"
import type { CommercialMigrationBucket } from "@/lib/customers/normalization/status"
import type { CustomerValidationStatus } from "@/lib/customers/normalization/status"
import type {
  EnrichedMigrationCustomer,
  MigrationReviewDecision,
  MigrationReviewFilters,
  MigrationReviewKpiFilter,
  MigrationReviewQuickFilter,
  MigrationReviewAction,
} from "@/lib/customers/commercial-migration/review-types"
import type { PreparedCommercialCustomer } from "@/lib/customers/commercial-migration/types"

export function resolveEffectiveBucket(input: {
  bucket: CommercialMigrationBucket
  reviewAction?: MigrationReviewAction
}): CommercialMigrationBucket {
  switch (input.reviewAction) {
    case "aprobado":
      return "listo"
    case "excluido":
      return "descartado"
    case "revisar_posterior":
      return "revisar"
    default:
      return input.bucket
  }
}

export function resolveEffectiveValidationStatus(input: {
  validationStatus: CustomerValidationStatus | null
  effectiveBucket: CommercialMigrationBucket
  reviewAction?: MigrationReviewAction
}): CustomerValidationStatus | null {
  if (input.effectiveBucket === "descartado") {
    return null
  }

  if (input.reviewAction === "aprobado") {
    return "active"
  }

  if (input.reviewAction === "revisar_posterior") {
    return "review"
  }

  if (input.effectiveBucket === "listo") {
    return "active"
  }

  if (input.effectiveBucket === "revisar") {
    return "review"
  }

  return input.validationStatus
}

export function isOperationalMigrationCustomer(
  record: Pick<EnrichedMigrationCustomer, "effectiveBucket">
): boolean {
  return record.effectiveBucket !== "descartado"
}

export function enrichMigrationCustomer(
  record: PreparedCommercialCustomer,
  decision?: MigrationReviewDecision
): EnrichedMigrationCustomer {
  const reviewAction = decision?.action
  const effectiveBucket = resolveEffectiveBucket({
    bucket: record.bucket,
    reviewAction,
  })

  return {
    ...record,
    reviewAction,
    reviewedAt: decision?.reviewedAt,
    effectiveBucket,
    effectiveValidationStatus: resolveEffectiveValidationStatus({
      validationStatus: record.validationStatus,
      effectiveBucket,
      reviewAction,
    }),
  }
}

export function enrichMigrationCustomers(
  records: PreparedCommercialCustomer[],
  decisions: Record<string, MigrationReviewDecision>
): EnrichedMigrationCustomer[] {
  return records.map((record) =>
    enrichMigrationCustomer(record, decisions[String(record.legacyId)])
  )
}

export function countMigrationReviewKpis(records: EnrichedMigrationCustomer[]) {
  const operational = records.filter(isOperationalMigrationCustomer)

  return {
    operativos: operational.length,
    activos: operational.filter((r) => r.effectiveValidationStatus === "active")
      .length,
    revisar: operational.filter((r) => r.effectiveValidationStatus === "review")
      .length,
    descartados: records.filter((r) => r.effectiveBucket === "descartado")
      .length,
  }
}

function matchesQuickFilter(
  record: EnrichedMigrationCustomer,
  quickFilter: MigrationReviewQuickFilter
): boolean {
  switch (quickFilter) {
    case "todos":
      return true
    case "operativos":
      return isOperationalMigrationCustomer(record)
    case "activos":
      return record.effectiveValidationStatus === "active"
    case "revisar":
      return record.effectiveValidationStatus === "review"
    case "descartados":
      return record.effectiveBucket === "descartado"
    case "duplicados":
      return record.duplicateMatches.length > 0
    case "sin-dni":
      return !record.dni.trim()
    case "sin-direccion":
      return !record.address.trim()
    case "sin-localidad":
      return !record.locality.trim()
    case "sin-telefono":
      return !record.phone.trim()
    case "sin-email":
      return !record.email.trim()
    case "fibra":
      return record.technology === "fiber"
    case "wireless":
      return record.technology === "wireless"
    default:
      return true
  }
}

function matchesKpiFilter(
  record: EnrichedMigrationCustomer,
  kpiFilter: MigrationReviewKpiFilter
): boolean {
  switch (kpiFilter) {
    case "operativos":
      return isOperationalMigrationCustomer(record)
    case "activos":
      return record.effectiveValidationStatus === "active"
    case "revisar":
      return record.effectiveValidationStatus === "review"
    default:
      return true
  }
}

function matchesSearch(record: EnrichedMigrationCustomer, search: string): boolean {
  const query = normalizeComparisonKey(search)
  if (!query) return true

  const digits = query.replace(/\D/g, "")

  return (
    normalizeComparisonKey(record.name).includes(query) ||
    normalizeComparisonKey(record.externalCustomerCode).includes(query) ||
    record.dni.includes(digits) ||
    normalizeComparisonKey(record.phone).includes(query) ||
    normalizeComparisonKey(record.address).includes(query) ||
    normalizeComparisonKey(record.locality).includes(query) ||
    record.connectionIds.some((id) => String(id).includes(digits))
  )
}

export function filterMigrationReviewRecords(
  records: EnrichedMigrationCustomer[],
  filters: MigrationReviewFilters
): EnrichedMigrationCustomer[] {
  return records.filter(
    (record) =>
      matchesKpiFilter(record, filters.kpiFilter) &&
      matchesQuickFilter(record, filters.quickFilter) &&
      matchesSearch(record, filters.search)
  )
}

export function getMigrationReviewPrimaryReason(
  record: EnrichedMigrationCustomer
): string {
  if (record.reviewAction === "aprobado") {
    return "Marcado como activo manualmente"
  }
  if (record.reviewAction === "excluido") {
    return "Excluido manualmente de la migración"
  }
  if (record.reviewAction === "revisar_posterior") {
    return "Marcado para revisión posterior"
  }

  if (record.reviewReasons.length === 0) {
    return "—"
  }

  return record.reviewReasons[0]
}

export const VALIDATION_STATUS_LABELS: Record<CustomerValidationStatus, string> =
  {
    active: "Activo",
    review: "Revisar",
  }

export const MIGRATION_BUCKET_LABELS: Record<CommercialMigrationBucket, string> =
  {
    listo: "Importable",
    revisar: "Importable",
    descartado: "Descartado",
  }

export const MIGRATION_STATUS_LABELS: Record<
  EnrichedMigrationCustomer["migrationStatus"],
  string
> = {
  activo: "Activo",
  pendiente_activacion: "Pendiente de activación",
  inactivo: "Inactivo",
  revisar: "Revisar",
}

export const DUPLICATE_KIND_LABELS: Record<
  EnrichedMigrationCustomer["duplicateMatches"][number],
  string
> = {
  external_code: "N° Cliente",
  dni: "DNI",
  name: "Nombre",
  address: "Dirección",
}

export const MIGRATION_REVIEW_KPI_LABELS: Record<
  MigrationReviewKpiFilter,
  string
> = {
  operativos: "Clientes operativos",
  activos: "Activos",
  revisar: "Revisar",
}

export const MIGRATION_REVIEW_QUICK_FILTER_LABELS: Record<
  MigrationReviewQuickFilter,
  string
> = {
  todos: "Todos",
  operativos: "Operativos",
  activos: "Activos",
  revisar: "Revisar",
  descartados: "Descartados",
  duplicados: "Duplicados",
  "sin-dni": "Sin DNI",
  "sin-direccion": "Sin Dirección",
  "sin-localidad": "Sin Localidad",
  "sin-telefono": "Sin Teléfono",
  "sin-email": "Sin Email",
  fibra: "Fibra",
  wireless: "Wireless",
}

export type MigrationDataQualityField = {
  key: string
  label: string
  ok: boolean
}

export function buildMigrationDataQuality(
  record: EnrichedMigrationCustomer
): { score: number; fields: MigrationDataQualityField[] } {
  const fields: MigrationDataQualityField[] = [
    { key: "name", label: "Nombre", ok: Boolean(record.name.trim()) },
    {
      key: "externalCustomerCode",
      label: "Número Cliente",
      ok: Boolean(record.externalCustomerCode.trim()),
    },
    { key: "dni", label: "DNI", ok: Boolean(record.dni.trim()) },
    {
      key: "address",
      label: "Dirección",
      ok: Boolean(record.address.trim()),
    },
    {
      key: "email",
      label: "Email",
      ok: Boolean(record.email.trim()),
    },
    {
      key: "locality",
      label: "Localidad",
      ok: Boolean(record.locality.trim()),
    },
    {
      key: "technology",
      label: "Tecnología",
      ok: Boolean(record.technology),
    },
  ]

  const okCount = fields.filter((field) => field.ok).length
  const score = Math.round((okCount / fields.length) * 100)

  return { score, fields }
}
