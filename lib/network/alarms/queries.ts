import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isActiveNetworkAlarmStatus,
  isNetworkAlarmSeverity,
  isNetworkAlarmStatus,
  type NetworkAlarmDto,
  type NetworkAlarmRecord,
  type NetworkAlarmSeverity,
  type NetworkAlarmStatus,
} from "@/lib/network/alarms/contract"
import type { NetworkAlarmAction } from "@/lib/network/alarms/evaluate"
import { networkAlarmMttaMs, networkAlarmMttrMs } from "@/lib/network/alarms/metrics"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>
type AlarmRow = Database["public"]["Tables"]["network_alarms"]["Row"]

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "")
  )
}

export function mapNetworkAlarmRow(row: AlarmRow): NetworkAlarmRecord {
  const severity = isNetworkAlarmSeverity(row.severity) ? row.severity : "warning"
  const status = isNetworkAlarmStatus(row.status) ? row.status : "open"
  return {
    id: row.id,
    companyId: row.company_id,
    deviceId: row.device_id,
    severity,
    status,
    title: row.title,
    message: row.message,
    rootAlarmId: row.root_alarm_id,
    isRoot: row.is_root,
    createdAt: row.created_at,
    seenAt: row.seen_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
  }
}

export function toNetworkAlarmDto(alarm: NetworkAlarmRecord): NetworkAlarmDto {
  return {
    ...alarm,
    mttaMs: networkAlarmMttaMs(alarm),
    mttrMs: networkAlarmMttrMs(alarm),
  }
}

function actorIdForSession(input: {
  employeeId: string | null
  authUserId: string
}): string {
  return input.employeeId?.trim() || input.authUserId
}

export async function listNetworkAlarms(
  client: Client,
  companyId: string,
  filters?: {
    status?: NetworkAlarmStatus
    severity?: NetworkAlarmSeverity
    deviceId?: string
  }
): Promise<NetworkAlarmDto[]> {
  let query = client
    .from("network_alarms")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.severity) query = query.eq("severity", filters.severity)
  if (filters?.deviceId) query = query.eq("device_id", filters.deviceId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => toNetworkAlarmDto(mapNetworkAlarmRow(row)))
}

export async function getNetworkAlarm(
  client: Client,
  companyId: string,
  alarmId: string
): Promise<NetworkAlarmDto | null> {
  const { data, error } = await client
    .from("network_alarms")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", alarmId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return toNetworkAlarmDto(mapNetworkAlarmRow(data))
}

export async function listActiveNetworkAlarms(
  client: Client,
  companyId: string
): Promise<NetworkAlarmRecord[]> {
  const { data, error } = await client
    .from("network_alarms")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map(mapNetworkAlarmRow)
    .filter((alarm) => isActiveNetworkAlarmStatus(alarm.status))
}

export async function applyNetworkAlarmActions(
  client: Client,
  actions: readonly NetworkAlarmAction[]
): Promise<void> {
  for (const action of actions) {
    if (action.type === "open") {
      const { error } = await client.from("network_alarms").insert({
        id: action.alarm.id,
        company_id: action.alarm.companyId,
        device_id: action.alarm.deviceId,
        severity: action.alarm.severity,
        status: action.alarm.status,
        title: action.alarm.title,
        message: action.alarm.message,
        root_alarm_id: action.alarm.rootAlarmId,
        is_root: action.alarm.isRoot,
        created_at: action.alarm.createdAt,
        seen_at: action.alarm.seenAt,
        acknowledged_at: action.alarm.acknowledgedAt,
        acknowledged_by: action.alarm.acknowledgedBy,
        resolved_at: action.alarm.resolvedAt,
        resolved_by: action.alarm.resolvedBy,
        resolution_note: action.alarm.resolutionNote,
      })
      if (isUniqueViolation(error)) continue
      if (error) throw new Error(error.message)
      continue
    }

    if (action.type === "resolve") {
      const { error } = await client
        .from("network_alarms")
        .update({
          status: "resolved",
          resolved_at: action.resolvedAt,
          resolved_by: action.resolvedBy,
          resolution_note: action.resolutionNote,
        })
        .eq("id", action.alarmId)
        .is("deleted_at", null)
      if (error) throw new Error(error.message)
      continue
    }

    if (action.type === "promote") {
      const { error } = await client
        .from("network_alarms")
        .update({
          is_root: true,
          root_alarm_id: null,
        })
        .eq("id", action.alarmId)
        .is("deleted_at", null)
      if (error) throw new Error(error.message)
      continue
    }

    const { error } = await client
      .from("network_alarms")
      .update({
        is_root: false,
        root_alarm_id: action.rootAlarmId,
      })
      .eq("id", action.alarmId)
      .is("deleted_at", null)
    if (error) throw new Error(error.message)
  }
}

export async function markNetworkAlarmSeen(
  client: Client,
  input: { companyId: string; alarmId: string; seenAt?: string }
): Promise<NetworkAlarmDto | null> {
  const existing = await getNetworkAlarm(client, input.companyId, input.alarmId)
  if (!existing) return null
  if (existing.seenAt) return existing

  const seenAt = input.seenAt ?? new Date().toISOString()
  const { data, error } = await client
    .from("network_alarms")
    .update({ seen_at: seenAt })
    .eq("id", input.alarmId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .is("seen_at", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    return getNetworkAlarm(client, input.companyId, input.alarmId)
  }
  return toNetworkAlarmDto(mapNetworkAlarmRow(data))
}

export async function acknowledgeNetworkAlarm(
  client: Client,
  input: {
    companyId: string
    alarmId: string
    actor: { employeeId: string | null; authUserId: string }
    acknowledgedAt?: string
  }
): Promise<
  | { ok: true; alarm: NetworkAlarmDto }
  | { ok: false; reason: "not_found" | "resolved" }
> {
  const existing = await getNetworkAlarm(client, input.companyId, input.alarmId)
  if (!existing) return { ok: false, reason: "not_found" }
  if (existing.status === "resolved") return { ok: false, reason: "resolved" }
  if (existing.status === "acknowledged") return { ok: true, alarm: existing }

  const acknowledgedAt = input.acknowledgedAt ?? new Date().toISOString()
  const acknowledgedBy = actorIdForSession(input.actor)
  const { data, error } = await client
    .from("network_alarms")
    .update({
      status: "acknowledged",
      acknowledged_at: acknowledgedAt,
      acknowledged_by: acknowledgedBy,
    })
    .eq("id", input.alarmId)
    .eq("company_id", input.companyId)
    .eq("status", "open")
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    const latest = await getNetworkAlarm(client, input.companyId, input.alarmId)
    if (!latest) return { ok: false, reason: "not_found" }
    if (latest.status === "resolved") return { ok: false, reason: "resolved" }
    return { ok: true, alarm: latest }
  }
  return { ok: true, alarm: toNetworkAlarmDto(mapNetworkAlarmRow(data)) }
}

export async function resolveNetworkAlarm(
  client: Client,
  input: {
    companyId: string
    alarmId: string
    actor: { employeeId: string | null; authUserId: string }
    resolutionNote?: string | null
    resolvedAt?: string
  }
): Promise<
  | { ok: true; alarm: NetworkAlarmDto }
  | { ok: false; reason: "not_found" | "already_resolved" }
> {
  const existing = await getNetworkAlarm(client, input.companyId, input.alarmId)
  if (!existing) return { ok: false, reason: "not_found" }
  if (existing.status === "resolved") return { ok: false, reason: "already_resolved" }

  const resolvedAt = input.resolvedAt ?? new Date().toISOString()
  const resolvedBy = actorIdForSession(input.actor)
  const resolutionNote = input.resolutionNote?.trim() || null
  const { data, error } = await client
    .from("network_alarms")
    .update({
      status: "resolved",
      resolved_at: resolvedAt,
      resolved_by: resolvedBy,
      resolution_note: resolutionNote,
    })
    .eq("id", input.alarmId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .neq("status", "resolved")
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    const latest = await getNetworkAlarm(client, input.companyId, input.alarmId)
    if (!latest) return { ok: false, reason: "not_found" }
    if (latest.status === "resolved") return { ok: false, reason: "already_resolved" }
    return { ok: true, alarm: latest }
  }
  return { ok: true, alarm: toNetworkAlarmDto(mapNetworkAlarmRow(data)) }
}
