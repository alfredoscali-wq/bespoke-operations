/**
 * Análisis React Query consolidation (Sprint 15 / Bloque D).
 */

export {
  ANALYSIS_EMPLOYEES_GC_TIME_MS,
  ANALYSIS_EMPLOYEES_STALE_TIME_MS,
  ANALYSIS_GC_TIME_MS,
  ANALYSIS_QUERY_DEFAULTS,
  ANALYSIS_REPORTES_STALE_TIME_MS,
  ANALYSIS_STALE_TIME_MS,
} from "@/lib/analysis/react-query/defaults"

export { analysisQueryKeys } from "@/lib/analysis/react-query/keys"

export { createAnalysisQueryClient } from "@/lib/analysis/react-query/query-client"

export { AnalysisQueryProvider } from "@/lib/analysis/react-query/provider"

export {
  useAnalysisEmployeesQuery,
  type AnalysisEmployeesQueryResult,
} from "@/lib/analysis/react-query/use-analysis-employees-query"

export { useSituationRoomQuery } from "@/lib/analysis/react-query/use-situation-room-query"

export { useWorkforceMonitorQuery } from "@/lib/analysis/react-query/use-workforce-monitor-query"

export { useCrewProductionQuery } from "@/lib/analysis/react-query/use-crew-production-query"

export { useExecutiveCenterQuery } from "@/lib/analysis/react-query/use-executive-center-query"

export { usePlanningTimelineQuery } from "@/lib/analysis/react-query/use-planning-timeline-query"

export { useCrewsQuery } from "@/lib/analysis/react-query/use-crews-query"

export {
  useJornadaPeriodEventsQuery,
  type JornadaPeriodEventsResult,
} from "@/lib/analysis/react-query/use-jornada-period-events-query"

export {
  useAnalysisReportesCrewsQuery,
  useAnalysisReportesProjectsQuery,
  useAnalysisReportesTasksQuery,
} from "@/lib/analysis/react-query/use-analysis-reportes-queries"
