import "server-only"

import { WEEKLY_REPORT_ID } from "@/lib/reports/automatic/config"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/database.types"

export type AutomaticReportSettings = {
  id: string
  reportType: string
  enabled: boolean
  companyName: string
  recipientEmail: string
  sendDay: number
  sendTime: string
  createdAt: string
  updatedAt: string
}

type SettingsRow =
  Database["public"]["Tables"]["automatic_report_settings"]["Row"]

function mapSettingsRow(row: SettingsRow): AutomaticReportSettings {
  return {
    id: row.id,
    reportType: row.report_type,
    enabled: row.enabled,
    companyName: row.company_name,
    recipientEmail: row.recipient_email,
    sendDay: row.send_day,
    sendTime: row.send_time.slice(0, 5),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getWeeklyReportSettings(): Promise<AutomaticReportSettings> {
  const client = createAdminClient()

  const { data, error } = await client
    .from("automatic_report_settings")
    .select("*")
    .eq("report_type", WEEKLY_REPORT_ID)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("No se encontró la configuración del reporte semanal.")
  }

  return mapSettingsRow(data)
}

function normalizeSendTime(value: string): string {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }
  return trimmed
}

export async function updateWeeklyReportSettings(input: {
  enabled: boolean
  companyName: string
  recipientEmail: string
  sendDay: number
  sendTime: string
}): Promise<AutomaticReportSettings> {
  const client = createAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from("automatic_report_settings")
    .update({
      enabled: input.enabled,
      company_name: input.companyName.trim(),
      recipient_email: input.recipientEmail.trim(),
      send_day: input.sendDay,
      send_time: normalizeSendTime(input.sendTime),
      updated_at: now,
    })
    .eq("report_type", WEEKLY_REPORT_ID)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar la configuración.")
  }

  return mapSettingsRow(data)
}

export function resolveWeeklyReportRecipients(
  settings: Pick<AutomaticReportSettings, "recipientEmail">
): string[] {
  const email = settings.recipientEmail.trim()
  return email ? [email] : []
}

export function isWeeklyReportEnabled(
  settings: Pick<AutomaticReportSettings, "enabled">
): boolean {
  return settings.enabled
}
