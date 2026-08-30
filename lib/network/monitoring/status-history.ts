import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import { isMonitoringOperationalStatus } from "@/lib/network/monitoring/status"
import type {
  NetworkDeviceStatusHistory,
  NetworkDeviceStatusHistoryEvent,
} from "@/lib/network/types"

type Client = SupabaseClient<Database>
type EventRow = Pick<
  Database["public"]["Tables"]["network_device_status_events"]["Row"],
  | "id"
  | "previous_status"
  | "new_status"
  | "changed_at"
  | "job_id"
  | "consecutive_failures"
  | "message"
>

export type StatusHistoryEventRecord = Omit<
  NetworkDeviceStatusHistoryEvent,
  "durationSeconds"
>

function parseChangedAtMs(changedAt: string): number | null {
  const parsed = Date.parse(changedAt)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Duration is read-time only: next chronological changed_at minus this event.
 * The newest event has no successor, so durationSeconds is null.
 * Does not use display freshness (TTL).
 */
export function durationSecondsUntilNextEvent(
  currentChangedAt: string,
  nextChronologicalChangedAt: string | null
): number | null {
  if (nextChronologicalChangedAt == null) return null
  const currentMs = parseChangedAtMs(currentChangedAt)
  const nextMs = parseChangedAtMs(nextChronologicalChangedAt)
  if (currentMs == null || nextMs == null) return null
  return Math.max(0, Math.floor((nextMs - currentMs) / 1000))
}

export function attachHistoryEventDurations(
  eventsNewestFirst: readonly StatusHistoryEventRecord[]
): NetworkDeviceStatusHistoryEvent[] {
  return eventsNewestFirst.map((event, index) => {
    const nextChronological = index === 0 ? null : eventsNewestFirst[index - 1]
    return {
      ...event,
      durationSeconds: durationSecondsUntilNextEvent(
        event.changedAt,
        nextChronological?.changedAt ?? null
      ),
    }
  })
}

function mapEventRow(row: EventRow): StatusHistoryEventRecord {
  return {
    id: row.id,
    previousStatus: isMonitoringOperationalStatus(row.previous_status)
      ? row.previous_status
      : "unknown",
    newStatus: isMonitoringOperationalStatus(row.new_status)
      ? row.new_status
      : "unknown",
    changedAt: row.changed_at,
    jobId: row.job_id,
    consecutiveFailures: row.consecutive_failures,
    message: row.message,
  }
}

async function isManagedHistoryDevice(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<boolean | null> {
  const { data: device, error: deviceError } = await client
    .from("network_devices")
    .select("company_id, agent_id, management_ip")
    .eq("company_id", companyId)
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (deviceError) throw new Error(deviceError.message)
  if (!device) return null
  if (!device.agent_id || device.management_ip == null) return false

  const { data: targets, error: targetError } = await client
    .from("network_discovery_targets")
    .select("company_id, agent_id, host")
    .eq("company_id", companyId)
    .eq("agent_id", device.agent_id)
    .is("deleted_at", null)

  if (targetError) throw new Error(targetError.message)

  return (targets ?? []).some((target) =>
    isManagedNetworkDevice(
      {
        companyId: device.company_id,
        agentId: device.agent_id,
        managementIp: device.management_ip,
      },
      {
        companyId: target.company_id,
        agentId: target.agent_id,
        host: target.host,
      }
    )
  )
}

export async function listNetworkDeviceStatusHistory(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkDeviceStatusHistory | null> {
  const managed = await isManagedHistoryDevice(client, companyId, deviceId)
  if (managed == null) return null
  if (!managed) return { events: [] }

  const { data, error } = await client
    .from("network_device_status_events")
    .select(
      "id, previous_status, new_status, changed_at, job_id, consecutive_failures, message"
    )
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .is("deleted_at", null)
    .order("changed_at", { ascending: false })

  if (error) throw new Error(error.message)

  const mapped = (data ?? []).map(mapEventRow)
  mapped.sort((left, right) => {
    const leftMs = parseChangedAtMs(left.changedAt) ?? 0
    const rightMs = parseChangedAtMs(right.changedAt) ?? 0
    return rightMs - leftMs
  })

  return { events: attachHistoryEventDurations(mapped) }
}
