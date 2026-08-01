/**
 * Análisis Smart Navigation — Sprint 23 / Bloque I.
 * Client-only context: origin, destination, filters. No API/query changes.
 */

export type AnalysisNavStepId =
  | "executive-center"
  | "situation-room"
  | "jornada"
  | "cuadrillas"
  | "reportes"
  | "planning"
  | "workforce"
  | "daily-brief"

export type AnalysisNavContext = {
  date?: string
  dateFrom?: string
  dateTo?: string
  employeeId?: string
  employeeName?: string
  crewId?: string
  crewName?: string
  projectId?: string
  projectName?: string
  customerId?: string
  customerName?: string
  period?: string
  startDate?: string
  endDate?: string
  opsArea?: string
  /** Specific OT / planning task when drilling into a work order. */
  taskId?: string
  /** Ordered trail of step ids for breadcrumb (origin → … → current). */
  trail?: AnalysisNavStepId[]
}

export type AnalysisBreadcrumbCrumb = {
  id: string
  label: string
  href: string | null
}
