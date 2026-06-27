import "server-only"

import { sendWeeklyReportEmail } from "@/lib/reports/automatic/mail/send-weekly-report-email"
import { buildWeeklyReportDownloadFileName } from "@/lib/reports/automatic/storage/automatic-report-storage"
import {
  createAutomaticReportHistoryEntry,
  getAutomaticReportHistoryEntry,
  getLatestAutomaticReportHistory,
  updateAutomaticReportHistoryEntry,
} from "@/lib/reports/automatic/services/report-history"
import {
  getWeeklyReportSettings,
  resolveWeeklyReportRecipients,
} from "@/lib/reports/automatic/services/report-settings"
import { downloadWeeklyReportPdf } from "@/lib/reports/automatic/services/report-storage"
import { WEEKLY_REPORT_ID } from "@/lib/reports/automatic/config"
import type { WeeklyReportJobResult } from "@/lib/reports/automatic/types"

const EMAIL_FAILURE_MESSAGE =
  "No fue posible enviar el correo. El PDF fue generado correctamente."

export async function resendStoredWeeklyReport(input: {
  historyId?: string
  generatedBy: string
}): Promise<WeeklyReportJobResult> {
  const startedAt = Date.now()
  const settings = await getWeeklyReportSettings()
  const recipients = resolveWeeklyReportRecipients(settings)

  const sourceEntry = input.historyId
    ? await getAutomaticReportHistoryEntry(input.historyId)
    : await getLatestAutomaticReportHistory({
        reportType: WEEKLY_REPORT_ID,
        requirePdf: true,
      })

  if (!sourceEntry?.pdfStoragePath) {
    return {
      success: false,
      pdfGenerated: false,
      reportId: WEEKLY_REPORT_ID,
      generatedAt: new Date().toISOString(),
      informedWeek: { startDate: "", endDate: "" },
      recipients,
      emailSent: false,
      pdfBytes: 0,
      message: "No hay un PDF almacenado para reenviar.",
    }
  }

  const recipient = recipients[0] ?? sourceEntry.recipient
  const weekNumber = sourceEntry.weekNumber ?? 0
  const pdfFileName =
    sourceEntry.pdfFileName ??
    (weekNumber > 0
      ? buildWeeklyReportDownloadFileName(weekNumber)
      : "Bespoke-Weekly-Report.pdf")

  const historyEntry = await createAutomaticReportHistoryEntry({
    generatedBy: input.generatedBy,
    recipient,
    status: "generated",
    pdfStoragePath: sourceEntry.pdfStoragePath,
    pdfFileName,
    weekNumber: sourceEntry.weekNumber,
  })

  try {
    const pdfBytes = await downloadWeeklyReportPdf(sourceEntry.pdfStoragePath)

    if (recipients.length === 0) {
      const message = "No hay destinatario configurado."
      await updateAutomaticReportHistoryEntry(historyEntry.id, {
        status: "email_failed",
        errorMessage: message,
        executionTimeMs: Date.now() - startedAt,
      })

      return {
        success: true,
        pdfGenerated: true,
        reportId: WEEKLY_REPORT_ID,
        generatedAt: historyEntry.generatedAt,
        informedWeek: { startDate: "", endDate: "" },
        recipients,
        emailSent: false,
        pdfBytes: pdfBytes.byteLength,
        pdfFileName,
        historyId: historyEntry.id,
        pdfStoragePath: sourceEntry.pdfStoragePath,
        message,
        emailError: message,
      }
    }

    const emailResult = await sendWeeklyReportEmail({
      recipients,
      weekNumber: weekNumber || 1,
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

      return {
        success: true,
        pdfGenerated: true,
        reportId: WEEKLY_REPORT_ID,
        generatedAt: historyEntry.generatedAt,
        informedWeek: { startDate: "", endDate: "" },
        recipients,
        emailSent: false,
        pdfBytes: pdfBytes.byteLength,
        pdfFileName,
        historyId: historyEntry.id,
        pdfStoragePath: sourceEntry.pdfStoragePath,
        message: EMAIL_FAILURE_MESSAGE,
        emailError: emailResult.message,
      }
    }

    const sentAt = new Date().toISOString()

    await updateAutomaticReportHistoryEntry(historyEntry.id, {
      status: "sent",
      emailSentAt: sentAt,
      executionTimeMs,
      errorMessage: null,
    })

    return {
      success: true,
      pdfGenerated: true,
      reportId: WEEKLY_REPORT_ID,
      generatedAt: historyEntry.generatedAt,
      informedWeek: { startDate: "", endDate: "" },
      recipients,
      emailSent: true,
      pdfBytes: pdfBytes.byteLength,
      pdfFileName,
      historyId: historyEntry.id,
      pdfStoragePath: sourceEntry.pdfStoragePath,
      message: "Enviado correctamente.",
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo reenviar el reporte."

    await updateAutomaticReportHistoryEntry(historyEntry.id, {
      status: "error",
      errorMessage: message,
      executionTimeMs: Date.now() - startedAt,
    })

    return {
      success: false,
      pdfGenerated: false,
      reportId: WEEKLY_REPORT_ID,
      generatedAt: historyEntry.generatedAt,
      informedWeek: { startDate: "", endDate: "" },
      recipients,
      emailSent: false,
      pdfBytes: 0,
      historyId: historyEntry.id,
      message,
    }
  }
}

export async function sendLatestStoredWeeklyReport(input: {
  generatedBy: string
}): Promise<WeeklyReportJobResult> {
  return resendStoredWeeklyReport({
    generatedBy: input.generatedBy,
  })
}
