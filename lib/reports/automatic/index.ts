import "server-only"

import { WEEKLY_REPORT_ID } from "@/lib/reports/automatic/config"
import { sendWeeklyReportEmail } from "@/lib/reports/automatic/mail/send-weekly-report-email"
import {
  buildWeeklyReportPdf,
  buildWeeklyReportPdfFileName,
} from "@/lib/reports/automatic/pdf/weekly-report-pdf"
import {
  createAutomaticReportHistoryEntry,
  updateAutomaticReportHistoryEntry,
} from "@/lib/reports/automatic/services/report-history"
import {
  getWeeklyReportSettings,
  isWeeklyReportEnabled,
  resolveWeeklyReportRecipients,
} from "@/lib/reports/automatic/services/report-settings"
import {
  createWeeklyReportSignedUrl,
  uploadWeeklyReportPdf,
} from "@/lib/reports/automatic/services/report-storage"
import { loadWeeklyAutomaticReport } from "@/lib/reports/automatic/services/build-weekly-report"
import {
  resendStoredWeeklyReport,
  sendLatestStoredWeeklyReport,
} from "@/lib/reports/automatic/services/resend-stored-report"
import { getLatestAutomaticReportHistory } from "@/lib/reports/automatic/services/report-history"
import type {
  WeeklyReportJobResult,
  WeeklyReportRunTrigger,
} from "@/lib/reports/automatic/types"

const EMAIL_FAILURE_MESSAGE =
  "No fue posible enviar el correo. El PDF fue generado correctamente."

export type RunWeeklyAutomaticReportOptions = {
  referenceDate?: Date
  sendEmail?: boolean
  includePdfBase64?: boolean
  includeSignedUrl?: boolean
  triggeredBy?: WeeklyReportRunTrigger
  generatedBy?: string
  skipEnabledCheck?: boolean
}

function resolveGeneratedBy(
  triggeredBy: WeeklyReportRunTrigger,
  generatedBy?: string
): string {
  if (generatedBy?.trim()) {
    return generatedBy.trim()
  }

  return triggeredBy === "cron" ? "cron" : "manual"
}

function buildJobResult(input: {
  report: Awaited<ReturnType<typeof loadWeeklyAutomaticReport>>
  pdfBytes: Uint8Array
  pdfFileName: string
  recipients: string[]
  sendEmail: boolean
  includePdfBase64: boolean
  includeSignedUrl: boolean
  emailSent: boolean
  message: string
  emailError?: string
  historyId?: string
  pdfStoragePath?: string
  pdfSignedUrl?: string
}): WeeklyReportJobResult {
  return {
    success: true,
    pdfGenerated: true,
    reportId: WEEKLY_REPORT_ID,
    generatedAt: input.report.generatedAt,
    informedWeek: input.report.informedWeek,
    recipients: input.recipients,
    emailSent: input.emailSent,
    pdfBytes: input.pdfBytes.byteLength,
    pdfFileName: input.pdfFileName,
    pdfBase64: input.includePdfBase64
      ? Buffer.from(input.pdfBytes).toString("base64")
      : undefined,
    pdfStoragePath: input.pdfStoragePath,
    pdfSignedUrl: input.pdfSignedUrl,
    historyId: input.historyId,
    message: input.message,
    emailError: input.emailError,
  }
}

export async function runWeeklyAutomaticReport(
  options: RunWeeklyAutomaticReportOptions = {}
): Promise<WeeklyReportJobResult> {
  const startedAt = Date.now()
  const referenceDate = options.referenceDate ?? new Date()
  const sendEmail = options.sendEmail ?? true
  const includePdfBase64 = options.includePdfBase64 ?? false
  const includeSignedUrl = options.includeSignedUrl ?? false
  const triggeredBy = options.triggeredBy ?? "cron"
  const generatedBy = resolveGeneratedBy(triggeredBy, options.generatedBy)

  let recipients: string[] = []
  let recipientLabel = ""

  try {
    const settings = await getWeeklyReportSettings()
    recipients = resolveWeeklyReportRecipients(settings)
    recipientLabel = recipients[0] ?? ""

    if (
      triggeredBy === "cron" &&
      !options.skipEnabledCheck &&
      !isWeeklyReportEnabled(settings)
    ) {
      return {
        success: false,
        pdfGenerated: false,
        reportId: WEEKLY_REPORT_ID,
        generatedAt: referenceDate.toISOString(),
        informedWeek: { startDate: "", endDate: "" },
        recipients,
        emailSent: false,
        pdfBytes: 0,
        message: "El reporte semanal automático está desactivado.",
      }
    }

    const report = await loadWeeklyAutomaticReport(
      referenceDate,
      settings.companyName
    )
    const pdfBytes = buildWeeklyReportPdf(report)
    const pdfFileName = buildWeeklyReportPdfFileName(report)

    const { storagePath } = await uploadWeeklyReportPdf({
      pdfBytes,
      generatedAt: report.generatedAt,
      weekNumber: report.weekNumber,
    })

    const historyEntry = await createAutomaticReportHistoryEntry({
      generatedBy,
      recipient: recipientLabel,
      status: "generated",
      pdfStoragePath: storagePath,
      pdfFileName,
      weekNumber: report.weekNumber,
      generatedAt: report.generatedAt,
    })

    let pdfSignedUrl: string | undefined
    if (includeSignedUrl) {
      pdfSignedUrl = await createWeeklyReportSignedUrl(storagePath)
    }

    if (!sendEmail) {
      const executionTimeMs = Date.now() - startedAt

      await updateAutomaticReportHistoryEntry(historyEntry.id, {
        executionTimeMs,
      })

      return buildJobResult({
        report,
        pdfBytes,
        pdfFileName,
        recipients,
        sendEmail: false,
        includePdfBase64,
        includeSignedUrl,
        emailSent: false,
        message: "Reporte generado correctamente.",
        historyId: historyEntry.id,
        pdfStoragePath: storagePath,
        pdfSignedUrl,
      })
    }

    if (recipients.length === 0) {
      const message = "No hay destinatario configurado."
      const executionTimeMs = Date.now() - startedAt

      await updateAutomaticReportHistoryEntry(historyEntry.id, {
        status: "email_failed",
        errorMessage: message,
        executionTimeMs,
      })

      return buildJobResult({
        report,
        pdfBytes,
        pdfFileName,
        recipients,
        sendEmail: true,
        includePdfBase64,
        includeSignedUrl,
        emailSent: false,
        message,
        emailError: message,
        historyId: historyEntry.id,
        pdfStoragePath: storagePath,
        pdfSignedUrl,
      })
    }

    const emailResult = await sendWeeklyReportEmail({
      recipients,
      weekNumber: report.weekNumber,
      pdfBytes,
      pdfFileName,
    })

    const executionTimeMs = Date.now() - startedAt

    if (!emailResult.success) {
      await updateAutomaticReportHistoryEntry(historyEntry.id, {
        status: "email_failed",
        errorMessage: EMAIL_FAILURE_MESSAGE,
        executionTimeMs,
      })

      return buildJobResult({
        report,
        pdfBytes,
        pdfFileName,
        recipients,
        sendEmail: true,
        includePdfBase64,
        includeSignedUrl,
        emailSent: false,
        message: EMAIL_FAILURE_MESSAGE,
        emailError: emailResult.message,
        historyId: historyEntry.id,
        pdfStoragePath: storagePath,
        pdfSignedUrl,
      })
    }

    const sentAt = new Date().toISOString()

    await updateAutomaticReportHistoryEntry(historyEntry.id, {
      status: "sent",
      emailSentAt: sentAt,
      executionTimeMs,
      errorMessage: null,
    })

    return buildJobResult({
      report,
      pdfBytes,
      pdfFileName,
      recipients,
      sendEmail: true,
      includePdfBase64,
      includeSignedUrl,
      emailSent: true,
      message: "Enviado correctamente.",
      historyId: historyEntry.id,
      pdfStoragePath: storagePath,
      pdfSignedUrl,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo generar el reporte semanal."

    await createAutomaticReportHistoryEntry({
      generatedBy,
      recipient: recipientLabel,
      status: "error",
      errorMessage: message,
      executionTimeMs: Date.now() - startedAt,
    })

    return {
      success: false,
      pdfGenerated: false,
      reportId: WEEKLY_REPORT_ID,
      generatedAt: referenceDate.toISOString(),
      informedWeek: { startDate: "", endDate: "" },
      recipients,
      emailSent: false,
      pdfBytes: 0,
      message,
    }
  }
}

export async function testWeeklyReportDelivery(input: {
  generatedBy: string
}): Promise<WeeklyReportJobResult> {
  const latest = await getLatestAutomaticReportHistory({
    reportType: WEEKLY_REPORT_ID,
    requirePdf: true,
  })

  if (latest) {
    return resendStoredWeeklyReport({
      generatedBy: input.generatedBy,
      historyId: latest.id,
    })
  }

  return runWeeklyAutomaticReport({
    sendEmail: true,
    triggeredBy: "manual",
    generatedBy: input.generatedBy,
    skipEnabledCheck: true,
  })
}

export {
  getWeeklyReportRunStatus,
  listAutomaticReportHistory,
  getAutomaticReportHistoryEntry,
} from "@/lib/reports/automatic/services/report-history"
export {
  getWeeklyReportSettings,
  updateWeeklyReportSettings,
} from "@/lib/reports/automatic/services/report-settings"
export {
  resendStoredWeeklyReport,
  sendLatestStoredWeeklyReport,
} from "@/lib/reports/automatic/services/resend-stored-report"
export { createWeeklyReportSignedUrl } from "@/lib/reports/automatic/services/report-storage"
export { loadWeeklyAutomaticReport } from "@/lib/reports/automatic/services/build-weekly-report"
export type {
  AutomaticReportHistoryEntry,
  WeeklyAutomaticReport,
  WeeklyReportJobResult,
  WeeklyReportRunStatus,
} from "@/lib/reports/automatic/types"
export type { AutomaticReportSettings } from "@/lib/reports/automatic/services/report-settings"
