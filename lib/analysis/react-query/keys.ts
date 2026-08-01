/**
 * Centralized React Query keys for Análisis (Sprint 15).
 * One key → one network/Supabase download for all consumers.
 */

export const analysisQueryKeys = {
  root: ["analysis"] as const,

  employees: (companyId: string) =>
    ["analysis", "employees", companyId] as const,

  situationRoom: (date: string) =>
    ["analysis", "situation-room", date] as const,

  workforceMonitor: (date: string) =>
    ["analysis", "workforce-monitor", date] as const,

  crewProduction: (date: string) =>
    ["analysis", "crew-production", date] as const,

  executiveCenter: (date: string) =>
    ["analysis", "executive-center", date] as const,

  planningTimeline: (date: string, crewId: string) =>
    ["analysis", "planning-timeline", date, crewId] as const,

  cuadrillas: (preset: string, dateFrom: string, dateTo: string) =>
    ["analysis", "cuadrillas", preset, dateFrom, dateTo] as const,

  /** Explicit period slice — never share cache across ranges. */
  dateRange: (scope: string, preset: string, dateFrom: string, dateTo: string) =>
    ["analysis", "date-range", scope, preset, dateFrom, dateTo] as const,

  jornada: (input: {
    employeeId: string
    dateFrom: string
    dateTo: string
  }) =>
    [
      "analysis",
      "jornada",
      input.employeeId,
      input.dateFrom,
      input.dateTo,
    ] as const,

  reportesOperativos: (companyId: string, dateFrom = "", dateTo = "") =>
    ["analysis", "reportes-operativos", companyId, dateFrom, dateTo] as const,

  reportesTasks: (companyId: string) =>
    ["analysis", "reportes-operativos", companyId, "tasks"] as const,

  reportesCrews: (companyId: string) =>
    ["analysis", "reportes-operativos", companyId, "crews"] as const,

  reportesProjects: (companyId: string) =>
    ["analysis", "reportes-operativos", companyId, "projects"] as const,
} as const
