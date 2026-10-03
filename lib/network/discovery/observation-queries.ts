import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  buildNetworkDiscoveryObservationView,
  emptyNetworkDiscoveryObservationView,
  type NetworkDiscoveryObservationView,
} from "@/lib/network/discovery/observations"

type Client = SupabaseClient<Database>

export async function getNetworkDiscoveryObservations(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryObservationView> {
  const [devices, targets, links, interfaces] = await Promise.all([
    client
      .from("network_devices")
      .select(
        "id, company_id, agent_id, management_ip, hostname, mac_address, manufacturer, model, firmware_version, origin"
      )
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
        "from_device_id, to_device_id, from_interface_id, from_interface_name, to_interface_id, protocol"
      )
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
    return emptyNetworkDiscoveryObservationView()
  }

  return buildNetworkDiscoveryObservationView({
    devices: (devices.data ?? []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      agentId: row.agent_id,
      managementIp: row.management_ip,
      hostname: row.hostname,
      macAddress: row.mac_address,
      manufacturer: row.manufacturer,
      model: row.model,
      firmwareVersion: row.firmware_version,
      origin: row.origin,
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
      fromInterfaceName: row.from_interface_name,
      toInterfaceId: row.to_interface_id,
      protocol: row.protocol,
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
