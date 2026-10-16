import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isNetworkAlarmEventType,
  type NetworkAlarmEventRecord,
  type NetworkAlarmEventType,
} from "@/lib/network/alarms/contract"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>
type EventRow = Database["public"]["Tables"]["network_alarm_events"]["Row"]

export function mapNetworkAlarmEventRow(row: EventRow): NetworkAlarmEventRecord {
  const eventType = isNetworkAlarmEventType(row.event_type)
    ? row.event_type
    : "created"
  return {
    id: row.id,
    companyId: row.company_id,
    alarmId: row.alarm_id,
    eventType,
    userId: row.user_id,
    createdAt: row.created_at,
    note: row.note,
  }
}

export async function writeNetworkAlarmEvent(
  client: Client,
  input: {
    companyId: string
    alarmId: string
    eventType: NetworkAlarmEventType
    userId?: string | null
    note?: string | null
    createdAt?: string
  }
): Promise<NetworkAlarmEventRecord | null> {
  const { data: alarm, error: alarmError } = await client
    .from("network_alarms")
    .select("id, company_id")
    .eq("id", input.alarmId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .maybeSingle()
  if (alarmError) throw new Error(alarmError.message)
  if (!alarm) return null

  const note = input.note?.trim() || null
  const row: Database["public"]["Tables"]["network_alarm_events"]["Insert"] = {
    company_id: alarm.company_id,
    alarm_id: alarm.id,
    event_type: input.eventType,
    user_id: input.userId ?? null,
    note,
    created_at: input.createdAt ?? new Date().toISOString(),
  }
  const { data, error } = await client
    .from("network_alarm_events")
    .insert(row)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapNetworkAlarmEventRow(data)
}

export async function listNetworkAlarmEvents(
  client: Client,
  companyId: string,
  alarmId: string
): Promise<NetworkAlarmEventRecord[] | null> {
  const { data: alarm, error: alarmError } = await client
    .from("network_alarms")
    .select("id")
    .eq("id", alarmId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()
  if (alarmError) throw new Error(alarmError.message)
  if (!alarm) return null

  const { data, error } = await client
    .from("network_alarm_events")
    .select("*")
    .eq("company_id", companyId)
    .eq("alarm_id", alarmId)
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapNetworkAlarmEventRow)
}
