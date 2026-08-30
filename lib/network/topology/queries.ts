import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import { NETWORK_DEVICE_TYPES, type NetworkDeviceType } from "@/lib/network/constants"
import { listNetworkDeviceOperationalStatuses } from "@/lib/network/monitoring/queries"
import { mergeTopologyEdges } from "@/lib/network/topology/graph"
import type {
  NetworkTopologyGraph,
  NetworkTopologyInterface,
  NetworkTopologyNode,
} from "@/lib/network/topology/types"

type Client = SupabaseClient<Database>

function asDeviceType(value: string): NetworkDeviceType {
  return (NETWORK_DEVICE_TYPES as readonly string[]).includes(value)
    ? (value as NetworkDeviceType)
    : "other"
}

export async function getNetworkTopologyGraph(
  client: Client,
  companyId: string
): Promise<NetworkTopologyGraph> {
  const [devicesResult, targetsResult, linksResult, interfacesResult, statuses] =
    await Promise.all([
      client
        .from("network_devices")
        .select("id, company_id, agent_id, hostname, management_ip, device_type")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      client
        .from("network_discovery_targets")
        .select("company_id, agent_id, host")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      client
        .from("network_links")
        .select(
          "id, from_device_id, to_device_id, from_interface_id, to_interface_id, protocol"
        )
        .eq("company_id", companyId)
        .is("deleted_at", null),
      client
        .from("network_interfaces")
        .select("id, device_id, name, status")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      listNetworkDeviceOperationalStatuses(client, companyId),
    ])

  if (devicesResult.error) throw new Error(devicesResult.error.message)
  if (targetsResult.error) throw new Error(targetsResult.error.message)
  if (linksResult.error) throw new Error(linksResult.error.message)
  if (interfacesResult.error) throw new Error(interfacesResult.error.message)

  const targets = (targetsResult.data ?? []).map((row) => ({
    companyId: row.company_id,
    agentId: row.agent_id,
    host: row.host,
  }))

  const interfacesByDevice = new Map<string, NetworkTopologyInterface[]>()
  const interfaceNameById = new Map<string, string>()
  for (const row of interfacesResult.data ?? []) {
    interfaceNameById.set(row.id, row.name)
    const list = interfacesByDevice.get(row.device_id) ?? []
    list.push({ id: row.id, name: row.name, status: row.status })
    interfacesByDevice.set(row.device_id, list)
  }

  const nodes: NetworkTopologyNode[] = (devicesResult.data ?? []).map((row) => {
    const managed = targets.some((target) =>
      isManagedNetworkDevice(
        {
          companyId: row.company_id,
          agentId: row.agent_id,
          managementIp: row.management_ip,
        },
        target
      )
    )
    const displayed = statuses.get(row.id)?.status
    return {
      id: row.id,
      hostname: row.hostname,
      managementIp: row.management_ip,
      deviceType: asDeviceType(row.device_type),
      kind: managed ? "managed" : "neighbor",
      operationalStatus: managed
        ? displayed === "online" ||
          displayed === "offline" ||
          displayed === "degraded" ||
          displayed === "unknown"
          ? displayed
          : "unknown"
        : null,
      interfaces: interfacesByDevice.get(row.id) ?? [],
    }
  })

  const nodeIds = new Set(nodes.map((node) => node.id))
  const rawLinks = (linksResult.data ?? []).flatMap((row) => {
    if (!nodeIds.has(row.from_device_id) || !nodeIds.has(row.to_device_id)) {
      return []
    }
    return [
      {
        id: row.id,
        fromDeviceId: row.from_device_id,
        toDeviceId: row.to_device_id,
        fromInterfaceName: row.from_interface_id
          ? interfaceNameById.get(row.from_interface_id) ?? null
          : null,
        toInterfaceName: row.to_interface_id
          ? interfaceNameById.get(row.to_interface_id) ?? null
          : null,
        protocol: row.protocol,
      },
    ]
  })

  return {
    nodes,
    edges: mergeTopologyEdges(rawLinks),
  }
}
