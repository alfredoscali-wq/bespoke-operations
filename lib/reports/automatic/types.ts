import type { ReportPeriodRange } from "@/lib/reports/report-utils"

export type WeeklyExecutiveSummary = {
  activeCustomers: number
  inactiveCustomers: number
  activeProjects: number
  tasksCreated: number
  tasksCompleted: number
  tasksDueInWeek: number
  tasksPending: number
  tasksOverdue: number
  weeklyCompliancePercent: number
  averageResolutionHours: number | null
}

export type WeeklyCrewPerformanceRow = {
  crewId: string
  crewName: string
  supervisor: string
  assigned: number
  completed: number
  pending: number
  overdue: number
  compliancePercent: number
  averageResolutionHours: number | null
}

export type WeeklyProductionCounts = {
  instalacionNueva: number
  cambioDomicilio: number
  cambioTecnologia: number
  serviceTecnico: number
  reconexion: number
  baja: number
}

export type WeeklyReportAlerts = {
  overdueTasks: number
  pendingApprovalTasks: number
  openIncidents: number
  absentOperarios: number
  stoppedProjects: number
}

export type WeeklyAutomaticReport = {
  reportId: "bespoke-weekly-executive"
  title: string
  subtitle: string
  companyName: string
  informedWeek: ReportPeriodRange
  informedWeekLabel: string
  weekNumber: number
  generatedAt: string
  summary: WeeklyExecutiveSummary
  crewPerformance: WeeklyCrewPerformanceRow[]
  production: WeeklyProductionCounts
  alerts: WeeklyReportAlerts
  narrativeSummary: string
}

export type WeeklyReportRunTrigger = "cron" | "manual"

export type AutomaticReportHistoryStatus =
  | "generated"
  | "sent"
  | "email_failed"
  | "error"

export type WeeklyReportRunStatusValue =
  | "never_run"
  | AutomaticReportHistoryStatus

export type AutomaticReportHistoryEntry = {
  id: string
  reportType: string
  generatedAt: string
  generatedBy: string
  recipient: string
  status: AutomaticReportHistoryStatus
  pdfStoragePath: string | null
  pdfFileName: string | null
  weekNumber: number | null
  errorMessage: string | null
  executionTimeMs: number | null
  emailSentAt: string | null
  createdAt: string
}

export type WeeklyReportRunStatus = {
  reportId: string
  lastGeneratedAt: string | null
  lastSentAt: string | null
  status: WeeklyReportRunStatusValue
  message: string | null
  triggeredBy: WeeklyReportRunTrigger | null
  updatedAt: string | null
  latestHistoryId: string | null
}

export type WeeklyReportJobResult = {
  success: boolean
  pdfGenerated: boolean
  reportId: string
  generatedAt: string
  informedWeek: ReportPeriodRange
  recipients: string[]
  emailSent: boolean
  pdfBytes: number
  pdfFileName?: string
  pdfBase64?: string
  pdfStoragePath?: string
  pdfSignedUrl?: string
  historyId?: string
  message: string
  emailError?: string
}
