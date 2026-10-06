import type { SupabaseClient } from "@supabase/supabase-js"

type Client = SupabaseClient

export const NETWORK_ALARM_NOTIFICATION_OUTCOMES = [
  "sent",
  "failed",
  "not_attempted",
] as const

export type NetworkAlarmNotificationOutcome =
  (typeof NETWORK_ALARM_NOTIFICATION_OUTCOMES)[number]

export type DeviceNotificationSendResult = {
  employeeId: string
  success: boolean
  errorCode: string | null
}

export type EmployeeNotificationSummary = {
  employeeId: string
  sendOutcome: NetworkAlarmNotificationOutcome
  errorCode: string | null
  attemptedAt: string | null
  sentAt: string | null
}

type NotificationRow = {
  id: string
  company_id: string
  alarm_id: string
  employee_id: string
  device_id: string | null
  send_outcome: string
  error_code: string | null
  attempted_at: string | null
  sent_at: string | null
  opened_at: string | null
}

export type NetworkAlarmNotificationRecord = {
  id: string
  companyId: string
  alarmId: string
  employeeId: string
  deviceId: string | null
  sendOutcome: NetworkAlarmNotificationOutcome
  errorCode: string | null
  attemptedAt: string | null
  sentAt: string | null
  openedAt: string | null
}

function isOutcome(
  value: string | null | undefined
): value is NetworkAlarmNotificationOutcome {
  return (
    value === "sent" || value === "failed" || value === "not_attempted"
  )
}

export function sanitizeNotificationErrorCode(
  errorCode: string | null | undefined
): string | null {
  if (typeof errorCode !== "string") return null
  const trimmed = errorCode.trim()
  if (!trimmed) return null
  if (trimmed.length > 180) return "send_failed"
  if (/token|bearer |begin private/i.test(trimmed)) return "send_failed"
  return trimmed
}

export function summarizeEmployeeNotificationOutcomes(
  results: readonly DeviceNotificationSendResult[],
  input: {
    mode: "dispatched" | "not_attempted"
    now: string
  }
): EmployeeNotificationSummary[] {
  if (results.length === 0) return []

  if (input.mode === "not_attempted") {
    const seen = new Set<string>()
    const summaries: EmployeeNotificationSummary[] = []
    for (const result of results) {
      const employeeId = result.employeeId.trim()
      if (!employeeId || seen.has(employeeId)) continue
      seen.add(employeeId)
      summaries.push({
        employeeId,
        sendOutcome: "not_attempted",
        errorCode: null,
        attemptedAt: null,
        sentAt: null,
      })
    }
    return summaries
  }

  const grouped = new Map<string, DeviceNotificationSendResult[]>()
  for (const result of results) {
    const employeeId = result.employeeId.trim()
    if (!employeeId) continue
    const list = grouped.get(employeeId) ?? []
    list.push(result)
    grouped.set(employeeId, list)
  }

  const summaries: EmployeeNotificationSummary[] = []
  for (const [employeeId, attempts] of grouped) {
    const anySuccess = attempts.some((attempt) => attempt.success)
    if (anySuccess) {
      summaries.push({
        employeeId,
        sendOutcome: "sent",
        errorCode: null,
        attemptedAt: input.now,
        sentAt: input.now,
      })
      continue
    }
    const errorCode =
      attempts
        .map((attempt) => sanitizeNotificationErrorCode(attempt.errorCode))
        .find((code) => code != null) ?? "send_failed"
    summaries.push({
      employeeId,
      sendOutcome: "failed",
      errorCode,
      attemptedAt: input.now,
      sentAt: null,
    })
  }
  return summaries
}

function mapRow(row: NotificationRow): NetworkAlarmNotificationRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    alarmId: row.alarm_id,
    employeeId: row.employee_id,
    deviceId: row.device_id,
    sendOutcome: isOutcome(row.send_outcome) ? row.send_outcome : "failed",
    errorCode: row.error_code,
    attemptedAt: row.attempted_at,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
  }
}

function nextSendState(
  existing: NotificationRow | undefined,
  summary: EmployeeNotificationSummary
): Pick<
  NotificationRow,
  "send_outcome" | "error_code" | "attempted_at" | "sent_at"
> {
  if (existing?.send_outcome === "sent") {
    return {
      send_outcome: "sent",
      error_code: null,
      attempted_at: existing.attempted_at,
      sent_at: existing.sent_at,
    }
  }
  return {
    send_outcome: summary.sendOutcome,
    error_code: summary.errorCode,
    attempted_at: summary.attemptedAt,
    sent_at: summary.sentAt,
  }
}

export async function persistNetworkAlarmNotificationSends(
  client: Client,
  input: {
    companyId: string
    alarmId: string
    results: readonly DeviceNotificationSendResult[]
    mode: "dispatched" | "not_attempted"
    now?: string
  }
): Promise<void> {
  const now = input.now ?? new Date().toISOString()
  const summaries = summarizeEmployeeNotificationOutcomes(input.results, {
    mode: input.mode,
    now,
  })
  if (summaries.length === 0) return

  const employeeIds = summaries.map((summary) => summary.employeeId)
  const { data: existingRows, error: existingError } = await client
    .from("network_alarm_notifications")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("alarm_id", input.alarmId)
    .in("employee_id", employeeIds)
  if (existingError) throw new Error(existingError.message)

  const existingByEmployee = new Map<string, NotificationRow>(
    (existingRows ?? []).map((row) => [row.employee_id, row as NotificationRow])
  )

  for (const summary of summaries) {
    const existing = existingByEmployee.get(summary.employeeId)
    const sendState = nextSendState(existing, summary)
    if (!existing) {
      const row = {
        company_id: input.companyId,
        alarm_id: input.alarmId,
        employee_id: summary.employeeId,
        device_id: null,
        send_outcome: sendState.send_outcome,
        error_code: sendState.error_code,
        attempted_at: sendState.attempted_at,
        sent_at: sendState.sent_at,
        opened_at: null,
      }
      const { error } = await client.from("network_alarm_notifications").insert(row)
      if (error) throw new Error(error.message)
      continue
    }

    const { error } = await client
      .from("network_alarm_notifications")
      .update({
        send_outcome: sendState.send_outcome,
        error_code: sendState.error_code,
        attempted_at: sendState.attempted_at,
        sent_at: sendState.sent_at,
      })
      .eq("id", existing.id)
      .eq("company_id", input.companyId)
    if (error) throw new Error(error.message)
  }
}

export async function markNetworkAlarmNotificationOpened(
  client: Client,
  input: {
    companyId: string
    employeeId: string
    alarmId: string
    now?: string
  }
): Promise<NetworkAlarmNotificationRecord | null> {
  const { data: existing, error: existingError } = await client
    .from("network_alarm_notifications")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("alarm_id", input.alarmId)
    .eq("employee_id", input.employeeId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (!existing) return null
  const current = existing as NotificationRow
  if (current.opened_at) return mapRow(current)

  const openedAt = input.now ?? new Date().toISOString()
  const { data, error } = await client
    .from("network_alarm_notifications")
    .update({ opened_at: openedAt })
    .eq("id", current.id)
    .eq("company_id", input.companyId)
    .eq("employee_id", input.employeeId)
    .is("opened_at", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    const { data: latest, error: latestError } = await client
      .from("network_alarm_notifications")
      .select("*")
      .eq("id", current.id)
      .maybeSingle()
    if (latestError) throw new Error(latestError.message)
    return latest ? mapRow(latest as NotificationRow) : mapRow(current)
  }
  return mapRow(data as NotificationRow)
}
