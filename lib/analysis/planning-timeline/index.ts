/**
 * Timeline Operativo — Sprint 24 / Bloque J.
 * Server-safe builder barrel (no React, no Supabase loaders).
 */

export { buildPlanningTimelineReadModel } from "@/lib/analysis/planning-timeline/builder"
export type { BuildPlanningTimelineReadModelInput } from "@/lib/analysis/planning-timeline/builder"

export {
  businessIncidentTitle,
  isBusinessIncidentReason,
} from "@/lib/analysis/planning-timeline/business-incidents"

export {
  preparePlanningTimelineExport,
  type PlanningTimelineExportFormat,
  type PlanningTimelineExportRequest,
  type PlanningTimelineExportResult,
} from "@/lib/analysis/planning-timeline/export"

export type {
  PlanningTimelineCard,
  PlanningTimelineDayEndCard,
  PlanningTimelineDayStartCard,
  PlanningTimelineIncidentCard,
  PlanningTimelineReadModel,
  PlanningTimelineSourceCrew,
  PlanningTimelineSourceTask,
  PlanningTimelineSummary,
  PlanningTimelineTravelCard,
  PlanningTimelineWorkOrderCard,
  PlanningTimelineWorkOrderOutcome,
} from "@/lib/analysis/planning-timeline/types"
