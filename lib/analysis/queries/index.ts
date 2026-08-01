/**
 * Análisis query helpers (Sprint 16 — no SELECT *).
 */

export {
  ANALYSIS_EMPLOYEE_SELECT,
  ANALYSIS_REPORTES_CREW_SELECT,
  ANALYSIS_REPORTES_PROJECT_SELECT,
  ANALYSIS_REPORTES_TASK_SELECT,
} from "@/lib/analysis/queries/selects"

export {
  listAnalysisEmployees,
  type AnalysisEmployee,
} from "@/lib/analysis/queries/employees"

export {
  listAnalysisReportesCrews,
  listAnalysisReportesProjects,
  listAnalysisReportesTasks,
} from "@/lib/analysis/queries/reportes-operativos"

export {
  ANALYSIS_TIMELINE_DRAIN_PAGE_SIZE,
  drainAnalysisTimelineEvents,
} from "@/lib/analysis/queries/drain-timeline-events"

export {
  buildCrewLookupIndexes,
  buildIdNameMap,
  resolveCrewIdFromIndexes,
} from "@/lib/analysis/queries/lookup-indexes"

export { resolveCustomerNamesBatch } from "@/lib/analysis/queries/resolve-customer-names"

// drainAnalysisCompanyDayEvents is server-only — import from
// `@/lib/analysis/queries/drain-company-day-events` in API routes.
