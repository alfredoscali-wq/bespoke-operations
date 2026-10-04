import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  emptyNetworkDiscoveryLatestObservationView,
  filterDevicesSeenInDiscoveryJob,
  pickLatestCompletedDiscoveryJob,
  pickLatestCompletedDiscoveryJobForHost,
  pickLatestCompletedDiscoveryJobForTarget,
  withLatestDiscoveryJobMeta,
  type NetworkDiscoveryLatestObservationView,
} from "@/lib/network/discovery/latest-run"
import {
  buildNetworkDiscoveryObservationView,
  emptyNetworkDiscoveryObservationView,
  type NetworkDiscoveryObservationView,
  type NetworkObservationDeviceRow,
  type NetworkObservationInterfaceRow,
  type NetworkObservationLinkRow,
  type NetworkObservationTargetRow,
} from "@/lib/network/discovery/observations"
import type { NetworkDiscoveryJobView } from "@/lib/network/types"

type Client = SupabaseClient<Database>

const DEVICE_COLUMNS =
  "id, company_id, agent_id, management_ip, hostname, mac_address, manufacturer, model, firmware_version, origin, last_seen_at, device_type"

type ObservationSource = {
  devices: NetworkObservationDeviceRow[]
  targets: NetworkObservationTargetRow[]
  links: NetworkObservationLinkRow[]
  interfaces: NetworkObservationInterfaceRow[]
}

export type NetworkDiscoveryObservationSets = {
  historicalObservations: NetworkDiscoveryObservationView
  latestObservations: NetworkDiscoveryLatestObservationView
}

function mapDeviceRows(
  rows: {
    id: string
    company_id: string
    agent_id: string | null
    management_ip: string | null
    hostname: string | null
    mac_address: string | null
    manufacturer: string | null
    model: string | null
    firmware_version: string | null
    origin: string
    last_seen_at: string
    device_type?: string | null
  }[]
): NetworkObservationDeviceRow[] {
  return rows.map((row) => ({
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
    lastSeenAt: row.last_seen_at,
    deviceType: row.device_type ?? null,
  }))
}

async function loadObservationSource(
  client: Client,
  companyId: string
): Promise<ObservationSource> {
  const [devices, targets, links, interfaces] = await Promise.all([
    client
      .from("network_devices")
      .select(DEVICE_COLUMNS)
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
      .select("id, device_id, name, description, interface_type, mac_address")
      .eq("company_id", companyId)
      .is("deleted_at", null),
  ])

  if (devices.error) throw new Error(devices.error.message)
  if (targets.error) throw new Error(targets.error.message)
  if (links.error) throw new Error(links.error.message)
  if (interfaces.error) throw new Error(interfaces.error.message)

  return {
    devices: mapDeviceRows(devices.data ?? []),
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
      macAddress: row.mac_address,
    })),
  }
}

function buildView(
  source: ObservationSource,
  devices: NetworkObservationDeviceRow[]
) {
  if (devices.length === 0) {
    return emptyNetworkDiscoveryObservationView()
  }
  return buildNetworkDiscoveryObservationView({
    devices,
    targets: source.targets,
    links: source.links,
    interfaces: source.interfaces,
  })
}

export async function getNetworkDiscoveryObservations(
  client: Client,
  companyId: string
): Promise<NetworkDiscoveryObservationView> {
  const source = await loadObservationSource(client, companyId)
  return buildView(source, source.devices)
}

export async function getNetworkDiscoveryObservationSets(
  client: Client,
  companyId: string,
  jobs: readonly NetworkDiscoveryJobView[],
  targetId?: string | null
): Promise<NetworkDiscoveryObservationSets> {
  const source = await loadObservationSource(client, companyId)
  const historicalObservations = buildView(source, source.devices)
  const latestJob = targetId
    ? pickLatestCompletedDiscoveryJobForTarget(jobs, targetId)
    : pickLatestCompletedDiscoveryJob(jobs)
  if (!latestJob) {
    return {
      historicalObservations,
      latestObservations: emptyNetworkDiscoveryLatestObservationView(),
    }
  }

  const latestRows = await client
    .from("network_devices")
    .select(DEVICE_COLUMNS)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("agent_id", latestJob.agentId)
    .gte("last_seen_at", latestJob.startedAt)
    .lte("last_seen_at", latestJob.completedAt)

  if (latestRows.error) throw new Error(latestRows.error.message)

  return {
    historicalObservations,
    latestObservations: withLatestDiscoveryJobMeta(
      buildView(source, mapDeviceRows(latestRows.data ?? [])),
      latestJob
    ),
  }
}

export type LatestHostDiscoveryObservations = {
  latestObservations: NetworkDiscoveryLatestObservationView
  devices: NetworkObservationDeviceRow[]
  links: NetworkObservationLinkRow[]
  interfaces: NetworkObservationInterfaceRow[]
}

export async function getLatestNetworkDiscoveryObservationsForHost(
  client: Client,
  companyId: string,
  jobs: readonly NetworkDiscoveryJobView[],
  host: string | null | undefined
): Promise<LatestHostDiscoveryObservations> {
  const source = await loadObservationSource(client, companyId)
  const latestJob = pickLatestCompletedDiscoveryJobForHost(jobs, host)
  if (!latestJob) {
    return {
      latestObservations: emptyNetworkDiscoveryLatestObservationView(),
      devices: [],
      links: source.links,
      interfaces: source.interfaces,
    }
  }

  const latestRows = await client
    .from("network_devices")
    .select(DEVICE_COLUMNS)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .eq("agent_id", latestJob.agentId)
    .gte("last_seen_at", latestJob.startedAt)
    .lte("last_seen_at", latestJob.completedAt)

  if (latestRows.error) throw new Error(latestRows.error.message)

  const devices = mapDeviceRows(latestRows.data ?? [])
  return {
    latestObservations: withLatestDiscoveryJobMeta(
      buildView(source, devices),
      latestJob
    ),
    devices,
    links: source.links,
    interfaces: source.interfaces,
  }
}

export async function getLatestNetworkDiscoveryObservationsByHosts(
  client: Client,
  companyId: string,
  jobs: readonly NetworkDiscoveryJobView[],
  hosts: readonly (string | null | undefined)[]
): Promise<Map<string, LatestHostDiscoveryObservations>> {
  const source = await loadObservationSource(client, companyId)
  const result = new Map<string, LatestHostDiscoveryObservations>()
  const uniqueHosts = [
    ...new Set(
      hosts
        .map((host) => host?.trim() ?? "")
        .filter((host) => host.length > 0)
    ),
  ]

  for (const host of uniqueHosts) {
    const latestJob = pickLatestCompletedDiscoveryJobForHost(jobs, host)
    if (!latestJob) {
      result.set(host, {
        latestObservations: emptyNetworkDiscoveryLatestObservationView(),
        devices: [],
        links: source.links,
        interfaces: source.interfaces,
      })
      continue
    }
    const devices = filterDevicesSeenInDiscoveryJob(source.devices, latestJob)
    result.set(host, {
      latestObservations: withLatestDiscoveryJobMeta(
        buildView(source, devices),
        latestJob
      ),
      devices,
      links: source.links,
      interfaces: source.interfaces,
    })
  }

  return result
}
