import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import type { MonitoringSnapshot } from "@/lib/network/monitoring/contract"
import {
  isMonitoringOperationalStatus,
  nextMonitoringOperationalState,
} from "@/lib/network/monitoring/status"

type Client = SupabaseClient<Database>
type DeviceStatusRow = Database["public"]["Tables"]["network_device_status"]["Row"]

export type PersistMonitoringSnapshotInput = {
  companyId: string
  deviceId: string
  snapshot: MonitoringSnapshot | null
  success: boolean
  jobId?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "23505" || /duplicate key|unique constraint/i.test(error.message ?? "")
  )
}

async function readDeviceStatus(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<DeviceStatusRow | null> {
  const { data, error } = await client
    .from("network_device_status")
    .select("*")
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function isManagedMonitoredDevice(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<boolean> {
  const { data: device, error: deviceError } = await client
    .from("network_devices")
    .select("company_id, agent_id, management_ip")
    .eq("company_id", companyId)
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (deviceError) throw new Error(deviceError.message)
  if (!device?.agent_id || device.management_ip == null) return false

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

async function insertStatusEvent(
  client: Client,
  input: {
    companyId: string
    deviceId: string
    previousStatus: string
    newStatus: string
    changedAt: string
    jobId: string | null
    consecutiveFailures: number
    message: string | null
  }
) {
  const { error } = await client.from("network_device_status_events").insert({
    company_id: input.companyId,
    device_id: input.deviceId,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    changed_at: input.changedAt,
    job_id: input.jobId,
    consecutive_failures: input.consecutiveFailures,
    message: input.message,
  })
  if (error) throw new Error(error.message)
}

function lostWriteResult(current: DeviceStatusRow | null): {
  status: string
  consecutiveFailures: number
  previousStatus: string
} {
  const status = isMonitoringOperationalStatus(current?.status)
    ? current.status
    : "unknown"
  return {
    status,
    consecutiveFailures: current?.consecutive_failures ?? 0,
    previousStatus: status,
  }
}

export async function persistMonitoringSnapshot(
  client: Client,
  input: PersistMonitoringSnapshotInput
): Promise<{
  status: string
  consecutiveFailures: number
  previousStatus: string
}> {
  const now = new Date().toISOString()
  const existing = await readDeviceStatus(client, input.companyId, input.deviceId)
  const previousStatus = isMonitoringOperationalStatus(existing?.status)
    ? existing.status
    : "unknown"
  const next = nextMonitoringOperationalState({
    previousStatus,
    consecutiveFailures: existing?.consecutive_failures ?? 0,
    success: input.success,
  })

  const patch = {
    status: next.status,
    last_poll_at: now,
    last_success_at: input.success ? now : existing?.last_success_at ?? null,
    consecutive_failures: next.consecutiveFailures,
    uptime: input.success ? input.snapshot?.uptime ?? null : existing?.uptime ?? null,
    cpu_load: input.success ? input.snapshot?.cpuLoad ?? null : existing?.cpu_load ?? null,
    memory_total: input.success
      ? input.snapshot?.memoryTotal ?? null
      : existing?.memory_total ?? null,
    memory_available: input.success
      ? input.snapshot?.memoryAvailable ?? null
      : existing?.memory_available ?? null,
    routeros_version: input.success
      ? input.snapshot?.routerosVersion ?? null
      : existing?.routeros_version ?? null,
    temperature: input.success
      ? input.snapshot?.temperature ?? null
      : existing?.temperature ?? null,
    error_code: input.success ? null : input.errorCode ?? "POLL_FAILED",
    error_message: input.success ? null : input.errorMessage ?? "Polling falló.",
  }

  let applied = false

  if (existing) {
    const { data, error } = await client
      .from("network_device_status")
      .update(patch)
      .eq("id", existing.id)
      .eq("company_id", input.companyId)
      .eq("status", previousStatus)
      .is("deleted_at", null)
      .select("id")

    if (error) throw new Error(error.message)
    applied = (data?.length ?? 0) === 1
    if (!applied) {
      if (input.success && input.snapshot) {
        await persistInterfaceCounters(client, {
          companyId: input.companyId,
          deviceId: input.deviceId,
          snapshot: input.snapshot,
          polledAt: now,
        })
      }
      return lostWriteResult(
        await readDeviceStatus(client, input.companyId, input.deviceId)
      )
    }
  } else {
    const { error } = await client.from("network_device_status").insert({
      company_id: input.companyId,
      device_id: input.deviceId,
      ...patch,
    })
    if (isUniqueViolation(error)) {
      if (input.success && input.snapshot) {
        await persistInterfaceCounters(client, {
          companyId: input.companyId,
          deviceId: input.deviceId,
          snapshot: input.snapshot,
          polledAt: now,
        })
      }
      return lostWriteResult(
        await readDeviceStatus(client, input.companyId, input.deviceId)
      )
    }
    if (error) throw new Error(error.message)
    applied = true
  }

  if (applied && previousStatus !== next.status) {
    const managed = await isManagedMonitoredDevice(
      client,
      input.companyId,
      input.deviceId
    )
    if (managed) {
      await insertStatusEvent(client, {
        companyId: input.companyId,
        deviceId: input.deviceId,
        previousStatus,
        newStatus: next.status,
        changedAt: now,
        jobId: input.jobId ?? null,
        consecutiveFailures: next.consecutiveFailures,
        message: input.success ? null : patch.error_message,
      })
    }
  }

  if (input.success && input.snapshot) {
    await persistInterfaceCounters(client, {
      companyId: input.companyId,
      deviceId: input.deviceId,
      snapshot: input.snapshot,
      polledAt: now,
    })
  }

  return {
    status: next.status,
    consecutiveFailures: next.consecutiveFailures,
    previousStatus,
  }
}

async function persistInterfaceCounters(
  client: Client,
  input: {
    companyId: string
    deviceId: string
    snapshot: MonitoringSnapshot
    polledAt: string
  }
) {
  const { data: inventory, error: inventoryError } = await client
    .from("network_interfaces")
    .select("id, name")
    .eq("company_id", input.companyId)
    .eq("device_id", input.deviceId)
    .is("deleted_at", null)

  if (inventoryError) throw new Error(inventoryError.message)

  const byName = new Map(
    (inventory ?? []).map((item) => [item.name.trim().toLowerCase(), item])
  )

  for (const iface of input.snapshot.interfaces) {
    const match = byName.get(iface.name.trim().toLowerCase())
    if (!match) continue

    const { data: existing, error: findError } = await client
      .from("network_interface_status")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("interface_id", match.id)
      .is("deleted_at", null)
      .maybeSingle()

    if (findError) throw new Error(findError.message)

    const patch = {
      interface_name: iface.name,
      status: iface.status,
      speed_mbps: iface.speedMbps,
      rx_bytes: iface.rxBytes,
      tx_bytes: iface.txBytes,
      rx_packets: iface.rxPackets,
      tx_packets: iface.txPackets,
      rx_errors: iface.rxErrors,
      tx_errors: iface.txErrors,
      rx_drops: iface.rxDrops,
      tx_drops: iface.txDrops,
      last_poll_at: input.polledAt,
    }

    if (existing) {
      const { error } = await client
        .from("network_interface_status")
        .update(patch)
        .eq("id", existing.id)
        .eq("company_id", input.companyId)
      if (error) throw new Error(error.message)
      continue
    }

    const { error } = await client.from("network_interface_status").insert({
      company_id: input.companyId,
      device_id: input.deviceId,
      interface_id: match.id,
      ...patch,
    })
    if (error) throw new Error(error.message)
  }
}
