import type { CommercialMigrationBucket } from "@/lib/customers/normalization/status"
import type { CustomerValidationStatus } from "@/lib/customers/normalization/status"
import type { PreparedCommercialCustomer } from "@/lib/customers/commercial-migration/types"

/** Decisión manual del centro de migración (RC1.1C). */
export type MigrationReviewAction =
  | "aprobado"
  | "revisar_posterior"
  | "excluido"

export type MigrationReviewDecision = {
  legacyId: number
  action: MigrationReviewAction
  reviewedAt: string
}

export type MigrationReviewState = {
  updatedAt: string
  decisions: Record<string, MigrationReviewDecision>
}

export type EnrichedMigrationCustomer = PreparedCommercialCustomer & {
  reviewAction?: MigrationReviewAction
  reviewedAt?: string
  effectiveBucket: CommercialMigrationBucket
  effectiveValidationStatus: CustomerValidationStatus | null
}

export type MigrationReviewKpiFilter = "operativos" | "activos" | "revisar"

export type MigrationReviewQuickFilter =
  | "todos"
  | "operativos"
  | "activos"
  | "revisar"
  | "descartados"
  | "duplicados"
  | "sin-dni"
  | "sin-direccion"
  | "sin-localidad"
  | "sin-telefono"
  | "sin-email"
  | "fibra"
  | "wireless"

export type MigrationReviewFilters = {
  kpiFilter: MigrationReviewKpiFilter
  quickFilter: MigrationReviewQuickFilter
  search: string
}

export const defaultMigrationReviewFilters: MigrationReviewFilters = {
  kpiFilter: "operativos",
  quickFilter: "todos",
  search: "",
}
