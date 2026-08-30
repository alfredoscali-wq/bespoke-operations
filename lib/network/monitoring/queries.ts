import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { MONITORING_POLL_INTERVAL_MS } from "@/lib/network/monitoring/contract"
import { displayMonitoringStatus } from "@/lib/network/monitoring/status"
import { persistMonitoringSnapshot } from "@/lib/network/monitoring/persist-snapshot"
import { tallyManagedMonitoringSummary } from "@/lib/network/monitoring/summary-tally"
import type {
  NetworkDeviceMonitoring,
  NetworkInterfaceMonitoring,
} from "@/lib/network/types"

export { persistMonitoringSnapshot }

type Client = SupabaseClient<Database>
type DeviceStatusRow = Database["public"]["Tables"]["network_device_status"]["Row"]
type InterfaceStatusRow = Database["public"]["Tables"]["network_interface_status"]["Row"]
type TargetRow = Database["public"]["Tables"]["network_discovery_targets"]["Row"]
type InflightJobRow = Pick<
  Database["public"]["Tables"]["network_agent_jobs"]["Row"],
  "id" | "payload" | "status" | "job_type"
>

export function mapDeviceStatusRow(row: DeviceStatusRow): Omit<
  NetworkDeviceMonitoring,
  "interfaces"
> {
  return {
    status: displayMonitoringStatus(row.status, row.last_poll_at),
    lastPollAt: row.last_poll_at,
    lastSuccessAt: row.last_success_at,
    consecutiveFailures: row.consecutive_failures,
    uptime: row.uptime,
    cpuLoad: row.cpu_load,
    memoryTotal: row.memory_total,
    memoryAvailable: row.memory_available,
    routerosVersion: row.routeros_version,
    temperature: row.temperature,
    errorCode: row.error_code,
    errorMessage: row.error_message,
  }
}

export function mapInterfaceStatusRow(row: InterfaceStatusRow): NetworkInterfaceMonitoring {
  return {
    interfaceId: row.interface_id,
    interfaceName: row.interface_name,
    status: row.status,
    speedMbps: row.speed_mbps,
    rxBytes: row.rx_bytes,
    txBytes: row.tx_bytes,
    rxPackets: row.rx_packets,
    txPackets: row.tx_packets,
    rxErrors: row.rx_errors,
    txErrors: row.tx_errors,
    rxDrops: row.rx_drops,
    txDrops: row.tx_drops,
    lastPollAt: row.last_poll_at,
  }
}

export async function getNetworkDeviceMonitoring(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkDeviceMonitoring | null> {
  const [{ data: deviceRow, error: deviceError }, { data: ifaceRows, error: ifaceError }] =
    await Promise.all([
      client
        .from("network_device_status")
        .select("*")
        .eq("company_id", companyId)
        .eq("device_id", deviceId)
        .is("deleted_at", null)
        .maybeSingle(),
      client
        .from("network_interface_status")
        .select("*")
        .eq("company_id", companyId)
        .eq("device_id", deviceId)
        .is("deleted_at", null),
    ])

  if (deviceError) throw new Error(deviceError.message)
  if (ifaceError) throw new Error(ifaceError.message)
  if (!deviceRow) return null

  return {
    ...mapDeviceStatusRow(deviceRow),
    interfaces: (ifaceRows ?? []).map(mapInterfaceStatusRow),
  }
}

export async function listNetworkDeviceOperationalStatuses(
  client: Client,
  companyId: string
): Promise<
  Map<
    string,
    {
      status: DeviceStatusRow["status"]
      lastPollAt: string | null
    }
  >
> {
  const { data, error } = await client
    .from("network_device_status")
    .select("device_id, status, last_poll_at")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (error) throw new Error(error.message)
  const map = new Map<
    string,
    { status: DeviceStatusRow["status"]; lastPollAt: string | null }
  >()
  for (const row of data ?? []) {
    map.set(row.device_id, {
      status: displayMonitoringStatus(row.status, row.last_poll_at),
      lastPollAt: row.last_poll_at,
    })
  }
  return map
}

export async function countNetworkMonitoringSummary(
  client: Client,
  companyId: string,
  managedDeviceIds: ReadonlySet<string>
): Promise<{
  devicesOnline: number
  devicesOffline: number
  devicesUnknown: number
  interfacesUp: number
  interfacesDown: number
}> {
  if (managedDeviceIds.size === 0) {
    return {
      devicesOnline: 0,
      devicesOffline: 0,
      devicesUnknown: 0,
      interfacesUp: 0,
      interfacesDown: 0,
    }
  }

  const [devices, interfaces] = await Promise.all([
    client
      .from("network_device_status")
      .select("device_id, status, last_poll_at")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_interface_status")
      .select("device_id, status")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ])

  if (devices.error) throw new Error(devices.error.message)
  if (interfaces.error) throw new Error(interfaces.error.message)

  return tallyManagedMonitoringSummary({
    managedDeviceIds,
    statusRows: devices.data ?? [],
    interfaceRows: interfaces.data ?? [],
  })
}

export async function resolveMonitoringTargetForDevice(
  client: Client,
  input: { companyId: string; agentId: string; deviceId: string }
): Promise<{ device: Database["public"]["Tables"]["network_devices"]["Row"]; target: TargetRow } | null> {
  const { data: device, error: deviceError } = await client
    .from("network_devices")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("id", input.deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (deviceError) throw new Error(deviceError.message)
  if (!device?.management_ip) return null

  const { data: targets, error: targetError } = await client
    .from("network_discovery_targets")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .is("deleted_at", null)

  if (targetError) throw new Error(targetError.message)
  if (!targets || targets.length === 0) return null

  const exact = targets.find(
    (item) => item.host.trim() === device.management_ip?.trim()
  )
  const target = exact ?? targets[0]
  if (!target) return null
  return { device, target }
}

export async function findDueMonitoringDevice(
  client: Client,
  input: { companyId: string; agentId: string }
): Promise<{ deviceId: string; targetId: string; host: string; siteId: string | null } | null> {
  const { data: targets, error: targetError } = await client
    .from("network_discovery_targets")
    .select("*")
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .is("deleted_at", null)

  if (targetError) throw new Error(targetError.message)
  if (!targets || targets.length === 0) return null

  const { data: devices, error: deviceError } = await client
    .from("network_devices")
    .select("id, management_ip, site_id, agent_id")
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .is("deleted_at", null)

  if (deviceError) throw new Error(deviceError.message)

  const { data: statuses, error: statusError } = await client
    .from("network_device_status")
    .select("device_id, last_poll_at")
    .eq("company_id", input.companyId)
    .is("deleted_at", null)

  if (statusError) throw new Error(statusError.message)

  const { data: inflight, error: inflightError } = await client
    .from("network_agent_jobs")
    .select("id, payload")
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .eq("job_type", "monitoring")
    .in("status", ["pending", "dispatched", "running"])
    .is("deleted_at", null)

  if (inflightError) throw new Error(inflightError.message)

  const inflightDeviceIds = new Set<string>()
  for (const job of inflight ?? []) {
    const payload = job.payload as Record<string, unknown> | null
    if (payload && typeof payload.deviceId === "string") {
      inflightDeviceIds.add(payload.deviceId)
    }
  }

  const lastPoll = new Map<string, string | null>()
  for (const row of statuses ?? []) {
    lastPoll.set(row.device_id, row.last_poll_at)
  }

  const dueBefore = Date.now() - MONITORING_POLL_INTERVAL_MS
  const candidates: Array<{
    deviceId: string
    targetId: string
    host: string
    siteId: string | null
    lastPollAt: number
  }> = []

  for (const device of devices ?? []) {
    if (!device.management_ip || inflightDeviceIds.has(device.id)) continue
    const target = targets.find(
      (item) => item.host.trim() === device.management_ip?.trim()
    )
    if (!target) continue
    const pollAt = lastPoll.get(device.id)
    const lastPollMs = pollAt ? new Date(pollAt).getTime() : 0
    if (pollAt && lastPollMs > dueBefore) continue
    candidates.push({
      deviceId: device.id,
      targetId: target.id,
      host: device.management_ip,
      siteId: device.site_id,
      lastPollAt: lastPollMs,
    })
  }

  candidates.sort((left, right) => left.lastPollAt - right.lastPollAt)
  const next = candidates[0]
  if (!next) return null
  return {
    deviceId: next.deviceId,
    targetId: next.targetId,
    host: next.host,
    siteId: next.siteId,
  }
}

export async function findInflightMonitoringJobForDevice(
  client: Client,
  input: { companyId: string; agentId: string; deviceId: string }
): Promise<InflightJobRow | null> {
  const { data, error } = await client
    .from("network_agent_jobs")
    .select("id, payload, status, job_type")
    .eq("company_id", input.companyId)
    .eq("agent_id", input.agentId)
    .eq("job_type", "monitoring")
    .in("status", ["pending", "dispatched", "running"])
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(20)

  if (error) throw new Error(error.message)
  const match = (data ?? []).find((job) => {
    const payload = job.payload as Record<string, unknown> | null
    return payload && payload.deviceId === input.deviceId
  })
  return match ?? null
}
