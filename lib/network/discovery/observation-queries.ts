import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  emptyNetworkDiscoveryObservationSummary,
  summarizeNetworkDiscoveryObservations,
  type NetworkDiscoveryObservationSummary,
} from "@/lib/network/discovery/observations"

type Client = SupabaseClient<Database>

export async function getNetworkDiscoveryObservationSummary(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryObservationSummary> {
  const [devices, targets, links, interfaces] = await Promise.all([
    client
      .from("network_devices")
      .select("id, company_id, agent_id, management_ip")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_discovery_targets")
      .select("company_id, agent_id, host")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_links")
      .select("from_device_id, to_device_id, from_interface_id, to_interface_id")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("network_interfaces")
      .select("id, device_id, name, description, interface_type")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ])

  if (devices.error) throw new Error(devices.error.message)
  if (targets.error) throw new Error(targets.error.message)
  if (links.error) throw new Error(links.error.message)
  if (interfaces.error) throw new Error(interfaces.error.message)

  if ((devices.data ?? []).length === 0) {
    return emptyNetworkDiscoveryObservationSummary()
  }

  return summarizeNetworkDiscoveryObservations({
    devices: (devices.data ?? []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      agentId: row.agent_id,
      managementIp: row.management_ip,
    })),
    targets: (targets.data ?? []).map((row) => ({
      companyId: row.company_id,
      agentId: row.agent_id,
      host: row.host,
    })),
    links: (links.data ?? []).map((row) => ({
      fromDeviceId: row.from_device_id,
      toDeviceId: row.to_device_id,
      fromInterfaceId: row.from_interface_id,
      toInterfaceId: row.to_interface_id,
    })),
    interfaces: (interfaces.data ?? []).map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      name: row.name,
      description: row.description,
      interfaceType: row.interface_type,
    })),
  })
}
