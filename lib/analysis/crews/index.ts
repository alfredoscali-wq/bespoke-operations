/**
 * CUADRILLAS — Sprint 25. Integrates production + timeline read models.
 */

export { buildCrewsReadModel } from "@/lib/analysis/crews/builder"
export type { BuildCrewsReadModelInput } from "@/lib/analysis/crews/builder"

export {
  prepareCrewsExport,
  type CrewsExportFormat,
  type CrewsExportRequest,
  type CrewsExportResult,
} from "@/lib/analysis/crews/export"

export {
  resolveCrewsPeriodRange,
  type CrewsPeriodPreset,
  type CrewsPeriodRange,
} from "@/lib/analysis/crews/period"

export {
  buildCrewsDayJourneys,
  formatCrewsDayHeading,
  formatCrewsPeriodLabel,
  formatCrewsWorkedDuration,
  isCrewsSingleDayPeriod,
  resolveCrewsDossierTitle,
  resolveCrewsPeriodIncidents,
  resolveCrewsSidePeriodSummary,
  type CrewsDayJourney,
  type CrewsPeriodMeta,
} from "@/lib/analysis/crews/dossier-presentation"

export {
  toProductionCrews,
  toProductionTasks,
  type CrewsSourceTask,
} from "@/lib/analysis/crews/source-mappers"

export type {
  CrewsDossier,
  CrewsGpsCoveragePlaceholder,
  CrewsProductivityKpis,
  CrewsQualityMetric,
  CrewsRankingRow,
  CrewsReadModel,
  CrewsTrendBucket,
  CrewsWorkOrderRow,
} from "@/lib/analysis/crews/types"
