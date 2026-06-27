import "server-only"

import { WEEKLY_REPORT_ID } from "@/lib/reports/automatic/config"
import type {
  AutomaticReportHistoryEntry,
  AutomaticReportHistoryStatus,
  WeeklyReportRunStatus,
} from "@/lib/reports/automatic/types"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"

type HistoryRow = Database["public"]["Tables"]["automatic_report_history"]["Row"]

function mapHistoryRow(row: HistoryRow): AutomaticReportHistoryEntry {
  return {
    id: row.id,
    reportType: row.report_type,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    recipient: row.recipient,
    status: row.status as AutomaticReportHistoryStatus,
    pdfStoragePath: row.pdf_storage_path,
    pdfFileName: row.pdf_file_name,
    weekNumber: row.week_number,
    errorMessage: row.error_message,
    executionTimeMs: row.execution_time_ms,
    emailSentAt: row.email_sent_at,
    createdAt: row.created_at,
  }
}

export async function createAutomaticReportHistoryEntry(input: {
  reportType?: string
  generatedBy: string
  recipient: string
  status: AutomaticReportHistoryStatus
  pdfStoragePath?: string | null
  pdfFileName?: string | null
  weekNumber?: number | null
  errorMessage?: string | null
  executionTimeMs?: number | null
  emailSentAt?: string | null
  generatedAt?: string
}): Promise<AutomaticReportHistoryEntry> {
  const client = createAdminClient()

  const { data, error } = await client
    .from("automatic_report_history")
    .insert({
      report_type: input.reportType ?? WEEKLY_REPORT_ID,
      generated_at: input.generatedAt ?? new Date().toISOString(),
      generated_by: input.generatedBy,
      recipient: input.recipient,
      status: input.status,
      pdf_storage_path: input.pdfStoragePath ?? null,
      pdf_file_name: input.pdfFileName ?? null,
      week_number: input.weekNumber ?? null,
      error_message: input.errorMessage ?? null,
      execution_time_ms: input.executionTimeMs ?? null,
      email_sent_at: input.emailSentAt ?? null,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar el historial.")
  }

  return mapHistoryRow(data)
}

export async function updateAutomaticReportHistoryEntry(
  id: string,
  input: {
    status?: AutomaticReportHistoryStatus
    errorMessage?: string | null
    emailSentAt?: string | null
    executionTimeMs?: number | null
  }
): Promise<AutomaticReportHistoryEntry> {
  const client = createAdminClient()

  const { data, error } = await client
    .from("automatic_report_history")
    .update({
      status: input.status,
      error_message: input.errorMessage,
      email_sent_at: input.emailSentAt,
      execution_time_ms: input.executionTimeMs,
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el historial.")
  }

  return mapHistoryRow(data)
}

export async function listAutomaticReportHistory(input?: {
  reportType?: string
  limit?: number
}): Promise<AutomaticReportHistoryEntry[]> {
  const client = createAdminClient()
  const limit = input?.limit ?? 50

  let query = client
    .from("automatic_report_history")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(limit)

  if (input?.reportType) {
    query = query.eq("report_type", input.reportType)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapHistoryRow)
}

export async function getAutomaticReportHistoryEntry(
  id: string
): Promise<AutomaticReportHistoryEntry | null> {
  const client = createAdminClient()

  const { data, error } = await client
    .from("automatic_report_history")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return mapHistoryRow(data)
}

export async function getLatestAutomaticReportHistory(input?: {
  reportType?: string
  requirePdf?: boolean
}): Promise<AutomaticReportHistoryEntry | null> {
  const client = createAdminClient()

  let query = client
    .from("automatic_report_history")
    .select("*")
    .order("generated_at", { ascending: false })
    .limit(1)

  if (input?.reportType) {
    query = query.eq("report_type", input.reportType)
  }

  if (input?.requirePdf) {
    query = query.not("pdf_storage_path", "is", null)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return null
  }

  return mapHistoryRow(data)
}

export async function getWeeklyReportRunStatus(): Promise<WeeklyReportRunStatus | null> {
  const latest = await getLatestAutomaticReportHistory({
    reportType: WEEKLY_REPORT_ID,
  })

  if (!latest) {
    return {
      reportId: WEEKLY_REPORT_ID,
      lastGeneratedAt: null,
      lastSentAt: null,
      status: "never_run",
      message: null,
      triggeredBy: null,
      updatedAt: null,
      latestHistoryId: null,
    }
  }

  const client = createAdminClient()

  const { data: lastSentRow } = await client
    .from("automatic_report_history")
    .select("email_sent_at")
    .eq("report_type", WEEKLY_REPORT_ID)
    .not("email_sent_at", "is", null)
    .order("email_sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastSent = lastSentRow?.email_sent_at ?? null

  return {
    reportId: WEEKLY_REPORT_ID,
    lastGeneratedAt: latest.generatedAt,
    lastSentAt: lastSent,
    status: latest.status,
    message: latest.errorMessage ?? resolveStatusMessage(latest.status),
    triggeredBy: latest.generatedBy === "cron" ? "cron" : "manual",
    updatedAt: latest.createdAt,
    latestHistoryId: latest.id,
  }
}

function resolveStatusMessage(status: AutomaticReportHistoryStatus): string | null {
  switch (status) {
    case "sent":
      return "Enviado correctamente"
    case "generated":
      return "Generado correctamente"
    case "email_failed":
      return "No fue posible enviar el correo. El PDF fue generado correctamente."
    case "error":
      return "Error en la generación"
    default:
      return null
  }
}
