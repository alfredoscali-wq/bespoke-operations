import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { buildManagedNetworkDeviceOrFilter } from "@/lib/network/devices/managed"
import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import { persistDiscoverySnapshot as persistNetworkDiscoverySnapshot } from "@/lib/network/discovery/persist-snapshot"
import {
  mapNetworkDeviceRow,
  mapNetworkInterfaceRow,
  mapNetworkLinkRow,
} from "@/lib/network/mapper"
import {
  getNetworkDeviceMonitoring,
  listNetworkDeviceOperationalStatuses,
} from "@/lib/network/monitoring/queries"
import type {
  NetworkDevice,
  NetworkDeviceDetail,
  NetworkInterface,
  NetworkLink,
} from "@/lib/network/types"

type Client = SupabaseClient<Database>

export async function listNetworkDevices(
  client: Client,
  companyId: string
): Promise<NetworkDevice[]> {
  const { data: targets, error: targetError } = await client
    .from("network_discovery_targets")
    .select("agent_id, host")
    .eq("company_id", companyId)
    .is("deleted_at", null)

  if (targetError) {
    throw new Error(targetError.message)
  }

  const managedFilter = buildManagedNetworkDeviceOrFilter(targets ?? [])
  if (!managedFilter) {
    return []
  }

  const { data, error } = await client
    .from("network_devices")
    .select("*, network_sites ( name ), network_agents ( name )")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .or(managedFilter)
    .order("last_seen_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const statuses = await listNetworkDeviceOperationalStatuses(client, companyId)

  return (data ?? []).map((row) => {
    const site = row.network_sites as { name: string } | null
    const agent = row.network_agents as { name: string } | null
    const operational = statuses.get(row.id)
    return mapNetworkDeviceRow(row, {
      siteName: site?.name ?? null,
      agentName: agent?.name ?? null,
      lastPollAt: operational?.lastPollAt ?? null,
      operationalStatus:
        operational?.status === "online" ||
        operational?.status === "offline" ||
        operational?.status === "degraded"
          ? operational.status
          : "unknown",
    })
  })
}

export async function getNetworkDeviceDetail(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkDeviceDetail | null> {
  const { data, error } = await client
    .from("network_devices")
    .select("*, network_sites ( name ), network_agents ( name )")
    .eq("company_id", companyId)
    .eq("id", deviceId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null

  const site = data.network_sites as { name: string } | null
  const agent = data.network_agents as { name: string } | null
  const device = mapNetworkDeviceRow(data, {
    siteName: site?.name ?? null,
    agentName: agent?.name ?? null,
  })

  const [interfaces, links, monitoring] = await Promise.all([
    listDeviceInterfaces(client, companyId, deviceId),
    listDeviceLinks(client, companyId, deviceId),
    getNetworkDeviceMonitoring(client, companyId, deviceId),
  ])

  return {
    ...device,
    operationalStatus: monitoring?.status ?? "unknown",
    interfaces,
    links,
    monitoring,
  }
}

async function listDeviceInterfaces(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkInterface[]> {
  const { data, error } = await client
    .from("network_interfaces")
    .select("*")
    .eq("company_id", companyId)
    .eq("device_id", deviceId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapNetworkInterfaceRow)
}

async function listDeviceLinks(
  client: Client,
  companyId: string,
  deviceId: string
): Promise<NetworkLink[]> {
  const { data, error } = await client
    .from("network_links")
    .select(
      "*, from_device:network_devices!network_links_from_device_id_fkey ( hostname ), to_device:network_devices!network_links_to_device_id_fkey ( hostname ), from_interface:network_interfaces!network_links_from_interface_id_fkey ( name ), to_interface:network_interfaces!network_links_to_interface_id_fkey ( name )"
    )
    .eq("company_id", companyId)
    .or(`from_device_id.eq.${deviceId},to_device_id.eq.${deviceId}`)
    .is("deleted_at", null)
    .order("last_seen_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const fromDevice = row.from_device as { hostname: string | null } | null
    const toDevice = row.to_device as { hostname: string | null } | null
    const fromInterface = row.from_interface as { name: string } | null
    const toInterface = row.to_interface as { name: string } | null
    return mapNetworkLinkRow(row, {
      fromHostname: fromDevice?.hostname ?? null,
      toHostname: toDevice?.hostname ?? null,
      fromInterfaceName: fromInterface?.name ?? null,
      toInterfaceName: toInterface?.name ?? null,
    })
  })
}

export async function persistDiscoverySnapshot(
  client: Client,
  input: {
    companyId: string
    agentId: string
    siteId: string | null
    snapshot: DiscoverySnapshot
  }
): Promise<{
  deviceCount: number
  interfaceCount: number
  linkCount: number
  primaryHostname: string | null
  primaryManagementIp: string | null
}> {
  return persistNetworkDiscoverySnapshot(client, input)
}
