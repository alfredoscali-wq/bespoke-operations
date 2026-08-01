/**
 * Producción de Cuadrillas — Sprint 21 / Bloque H.
 * Server-safe builder barrel (no React, no Supabase loaders).
 */

export { buildCrewProductionReadModel } from "@/lib/analysis/crew-production/builder"
export type { BuildCrewProductionReadModelInput } from "@/lib/analysis/crew-production/builder"

export {
  prepareCrewProductionExport,
  type CrewProductionExportFormat,
  type CrewProductionExportRequest,
  type CrewProductionExportResult,
} from "@/lib/analysis/crew-production/export"

export {
  buildCrewProductionNarrative,
  crewProductionStatusLabel,
  rankByProductivity,
} from "@/lib/analysis/crew-production/narrative"

export type {
  CrewProductionDetail,
  CrewProductionIndicator,
  CrewProductionIntervention,
  CrewProductionKpiId,
  CrewProductionKpis,
  CrewProductionRankingRow,
  CrewProductionReadModel,
  CrewProductionSourceCrew,
  CrewProductionSourceTask,
  CrewProductionStatus,
} from "@/lib/analysis/crew-production/types"
