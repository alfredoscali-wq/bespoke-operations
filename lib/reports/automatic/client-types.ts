export type WeeklyReportRunTrigger = "cron" | "manual"

export type AutomaticReportHistoryStatusDto =
  | "generated"
  | "sent"
  | "email_failed"
  | "error"

export type WeeklyReportRunStatusValue =
  | "never_run"
  | AutomaticReportHistoryStatusDto

export type AutomaticReportHistoryEntryDto = {
  id: string
  reportType: string
  generatedAt: string
  generatedBy: string
  recipient: string
  status: AutomaticReportHistoryStatusDto
  pdfStoragePath: string | null
  pdfFileName: string | null
  weekNumber: number | null
  errorMessage: string | null
  executionTimeMs: number | null
  emailSentAt: string | null
  createdAt: string
}

export type WeeklyReportRunStatusDto = {
  reportId: string
  lastGeneratedAt: string | null
  lastSentAt: string | null
  status: WeeklyReportRunStatusValue
  message: string | null
  triggeredBy: WeeklyReportRunTrigger | null
  updatedAt: string | null
  latestHistoryId?: string | null
}

export type WeeklyReportJobResultDto = {
  success: boolean
  pdfGenerated: boolean
  reportId: string
  generatedAt: string
  informedWeek: {
    startDate: string
    endDate: string
  }
  recipients: string[]
  emailSent: boolean
  pdfBytes: number
  pdfFileName?: string
  pdfBase64?: string
  pdfSignedUrl?: string
  pdfStoragePath?: string
  historyId?: string
  message: string
  emailError?: string
}

export const WEEKLY_REPORT_STATUS_LABELS: Record<WeeklyReportRunStatusValue, string> =
  {
    never_run: "Sin ejecuciones",
    sent: "Enviado correctamente",
    generated: "Generado correctamente",
    email_failed: "PDF generado — correo no enviado",
    error: "Error en la generación",
  }

export const AUTOMATIC_REPORT_HISTORY_STATUS_LABELS: Record<
  AutomaticReportHistoryStatusDto,
  string
> = {
  sent: "Enviado correctamente",
  generated: "Generado correctamente",
  email_failed: "PDF generado — correo no enviado",
  error: "Error en la generación",
}
