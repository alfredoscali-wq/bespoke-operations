import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { isManagedNetworkDevice } from "@/lib/network/devices/managed"
import { NETWORK_DEVICE_TYPES, type NetworkDeviceType } from "@/lib/network/constants"
import { listNetworkDiscoveryJobs, listNetworkManagementJobs } from "@/lib/network/jobs/queries"
import { getLatestNetworkDiscoveryObservationsByHosts } from "@/lib/network/discovery/observation-queries"
import { listNetworkDeviceOperationalStatuses } from "@/lib/network/monitoring/queries"
import type { MonitoringOperationalStatus } from "@/lib/network/monitoring/contract"
import {
  buildCanonicalTopologyGraph,
  uniqueTopologyInterfaces,
  type TopologyGraphDeviceInput,
} from "@/lib/network/topology/graph"
import {
  attachNestedLocalTopology,
  buildLocalCoreTopologyView,
  collectLocalTopologyMacs,
  emptyLocalCoreTopologyView,
  normalizeLocalTopologyMac,
  resolveLocalManagedDeviceId,
  selectTopologyRootIds,
  type LocalManagedIdentityRef,
} from "@/lib/network/topology/local-view"
import { selectAvailableCuratedTopologyDevices } from "@/lib/network/topology/available-devices"
import { getCuratedTopologyForest } from "@/lib/network/topology/curated-view"
import type { TopologyManagedDirectedLink } from "@/lib/network/topology/managed-parents"
import { listNetworkDiscoveryTargets } from "@/lib/network/targets/queries"
import type {
  LocalTopologyInterfaceGroup,
  NetworkTopologyGraph,
  NetworkTopologyInterface,
  NetworkTopologyManagementJob,
  NetworkTopologyManagementTarget,
  NetworkTopologyPage,
} from "@/lib/network/topology/types"

type Client = SupabaseClient<Database>

function asDeviceType(value: string): NetworkDeviceType {
  return (NETWORK_DEVICE_TYPES as readonly string[]).includes(value)
    ? (value as NetworkDeviceType)
    : "other"
}

function asOperationalStatus(value: string | null | undefined): MonitoringOperationalStatus | null {
  if (
    value === "online" ||
    value === "offline" ||
    value === "degraded" ||
    value === "unknown"
  ) {
    return value
  }
  return null
}

async function loadNetworkTopologySource(
  client: Client,
  companyId: string
): Promise<{
  graph: NetworkTopologyGraph
  directedLinks: TopologyManagedDirectedLink[]
}> {
  const [devicesResult, targetsResult, linksResult, interfacesResult, statuses] =
    await Promise.all([
      client
        .from("network_devices")
        .select("id, company_id, agent_id, site_id, hostname, management_ip, device_type, origin")
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
    interfacesByDevice.set(row.device_id, uniqueTopologyInterfaces(list))
  }

  const devices: TopologyGraphDeviceInput[] = (devicesResult.data ?? []).map((row) => {
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
      companyId: row.company_id,
      agentId: row.agent_id,
      siteId: row.site_id,
      hostname: row.hostname,
      managementIp: row.management_ip,
      deviceType: asDeviceType(row.device_type),
      origin: row.origin,
      kind: managed ? "managed" : "neighbor",
      operationalStatus: managed
        ? displayed === "online" ||
          displayed === "offline" ||
          displayed === "degraded" ||
          displayed === "unknown"
          ? displayed
          : "unknown"
        : null,
      lastPollAt: managed ? statuses.get(row.id)?.lastPollAt ?? null : null,
      interfaces: interfacesByDevice.get(row.id) ?? [],
    }
  })

  const deviceIds = new Set(devices.map((device) => device.id))
  const rawLinks = (linksResult.data ?? []).flatMap((row) => {
    if (!deviceIds.has(row.from_device_id) || !deviceIds.has(row.to_device_id)) {
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
    graph: buildCanonicalTopologyGraph(devices, rawLinks),
    directedLinks: rawLinks.map((link) => ({
      fromDeviceId: link.fromDeviceId,
      toDeviceId: link.toDeviceId,
    })),
  }
}

const AVAILABLE_DEVICE_PAGE = 1000

async function readCompanyPages<T>(
  read: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += AVAILABLE_DEVICE_PAGE) {
    const { data, error } = await read(from, from + AVAILABLE_DEVICE_PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < AVAILABLE_DEVICE_PAGE) break
  }
  return rows
}

export async function listAvailableCuratedTopologyDevices(
  client: Client,
  companyId: string,
  parentDeviceId?: string | null
) {
  const [devices, placements] = await Promise.all([
    readCompanyPages((from, to) =>
      client
        .from("network_devices")
        .select("id, company_id, hostname, management_ip, device_type, model, status, deleted_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    readCompanyPages((from, to) =>
      client
        .from("network_topology_placements")
        .select("company_id, device_id, deleted_at")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ])

  return selectAvailableCuratedTopologyDevices({
    companyId,
    parentDeviceId,
    devices: devices.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      hostname: row.hostname,
      managementIp: row.management_ip,
      deviceType: row.device_type,
      model: row.model,
      status: row.status,
      deletedAt: row.deleted_at,
    })),
    placements: placements.map((row) => ({
      companyId: row.company_id,
      deviceId: row.device_id,
      deletedAt: row.deleted_at,
    })),
  })
}

export async function getNetworkTopologyGraph(
  client: Client,
  companyId: string
): Promise<NetworkTopologyGraph> {
  const source = await loadNetworkTopologySource(client, companyId)
  return source.graph
}

export async function getNetworkTopologyPage(
  client: Client,
  companyId: string,
  deviceId?: string | null
): Promise<NetworkTopologyPage> {
  const [{ graph, directedLinks }, curated, managementJobs, listedTargets] =
    await Promise.all([
      loadNetworkTopologySource(client, companyId),
      getCuratedTopologyForest(client, companyId),
      listNetworkManagementJobs(client, companyId),
      listNetworkDiscoveryTargets(client, companyId),
    ])
  const discoveryJobs = compactTopologyManagementJobs(managementJobs)
  const managementTargets = compactTopologyManagementTargets(listedTargets)
  const managedNodes = graph.nodes.filter((node) => node.kind === "managed")
  const managedIds = new Set(managedNodes.map((node) => node.id))
  const jobs = await listNetworkDiscoveryJobs(client, companyId)
  const managedHosts = managedNodes.map((node) => node.managementIp)
  const byHost = await getLatestNetworkDiscoveryObservationsByHosts(
    client,
    companyId,
    jobs,
    managedHosts
  )
  const managedIdList = managedNodes.map((node) => node.id)
  const rootIds = new Set(selectTopologyRootIds(managedIdList, directedLinks))
  const cores = managedNodes
    .filter((node) => rootIds.has(node.id))
    .map((node) => ({
      id: node.id,
      hostname: node.hostname,
      managementIp: node.managementIp,
      operationalStatus: node.operationalStatus,
    }))

  const selected =
    (deviceId ? cores.find((core) => core.id === deviceId) : null) ?? cores[0] ?? null
  if (!selected) {
    return { graph, cores, local: null, curated, discoveryJobs, managementTargets }
  }

  const coreNode = graph.nodes.find((node) => node.id === selected.id) ?? null
  const core = {
    id: selected.id,
    hostname: selected.hostname,
    managementIp: selected.managementIp,
    operationalStatus: coreNode?.operationalStatus ?? selected.operationalStatus,
    lastPollAt: coreNode?.lastPollAt ?? null,
  }
  const latest = selected.managementIp
    ? byHost.get(selected.managementIp)
    : undefined
  const statuses = await listNetworkDeviceOperationalStatuses(client, companyId)
  const statusByDeviceId = new Map<
    string,
    { status: MonitoringOperationalStatus | null; lastPollAt: string | null }
  >(
    [...statuses.entries()].map(([id, row]) => [
      id,
      {
        status: asOperationalStatus(row.status),
        lastPollAt: row.lastPollAt,
      },
    ])
  )

  if (!latest?.latestObservations.jobId) {
    return {
      graph,
      cores,
      local: emptyLocalCoreTopologyView(core),
      curated,
      discoveryJobs,
      managementTargets,
    }
  }

  const deviceMeta = new Map(
    latest.devices.map((device) => [
      device.id,
      {
        deviceType: device.deviceType ?? null,
        lastSeenAt: device.lastSeenAt ?? null,
        agentId: device.agentId ?? null,
      },
    ])
  )

  const managedDevices: LocalManagedIdentityRef[] = managedNodes.map((node) => ({
    id: node.id,
    managementIp: node.managementIp,
    agentId: node.agentId,
    origin: node.origin,
  }))
  const managedIdByHost = new Map<string, string>()
  for (const node of managedNodes) {
    const host = node.managementIp?.trim()
    if (!host) continue
    const existingId = managedIdByHost.get(host)
    if (!existingId) {
      managedIdByHost.set(host, node.id)
      continue
    }
    const existing = managedDevices.find((item) => item.id === existingId)
    const existingIsDiscovery =
      (existing?.origin ?? "").trim().toLowerCase() === "discovery"
    const nodeIsDiscovery = (node.origin ?? "").trim().toLowerCase() === "discovery"
    if (!existingIsDiscovery && nodeIsDiscovery) {
      managedIdByHost.set(host, node.id)
    }
  }
  const excludedFromNested = new Set<string>([selected.id, ...rootIds])
  const excludedMacs = collectLocalTopologyMacs(latest.interfaces, selected.id)
  const selectedMac = normalizeLocalTopologyMac(
    latest.devices.find((device) => device.id === selected.id)?.macAddress
  )
  if (selectedMac) excludedMacs.add(selectedMac)

  const local = buildLocalCoreTopologyView({
    core,
    jobId: latest.latestObservations.jobId,
    observations: latest.latestObservations.items,
    links: toLocalTopologyLinks(latest.links, latest.interfaces),
    coreInterfaces: latest.interfaces.filter((iface) => iface.deviceId === selected.id),
    deviceMeta,
    statusByDeviceId,
  })

  const nestedByDeviceId = new Map<string, LocalTopologyInterfaceGroup[]>()
  for (const group of local.interfaceGroups) {
    for (const device of group.devices) {
      const catalogRow = managedDevices.find((row) => row.id === device.id)
      const managedId = resolveLocalManagedDeviceId({
        deviceId: device.id,
        managementIp: device.managementIp,
        agentId: device.agentId ?? catalogRow?.agentId,
        origin: device.origin ?? catalogRow?.origin,
        managedById: managedIds,
        managedIdByHost,
        managedDevices,
      })
      if (!managedId || managedId === selected.id) continue
      const host = device.managementIp?.trim()
      if (!host) continue
      const nestedLatest = byHost.get(host)
      if (!nestedLatest?.latestObservations.jobId) continue
      const nestedMeta = new Map(
        nestedLatest.devices.map((row) => [
          row.id,
          {
            deviceType: row.deviceType ?? null,
            lastSeenAt: row.lastSeenAt ?? null,
            agentId: row.agentId ?? null,
          },
        ])
      )
      const nestedLinks = toLocalTopologyLinks(
        nestedLatest.links,
        nestedLatest.interfaces
      )
      const nestedView = buildLocalCoreTopologyView({
        core: {
          id: managedId,
          hostname: device.hostname,
          managementIp: device.managementIp,
          operationalStatus: device.operationalStatus,
          lastPollAt: device.lastPollAt,
        },
        jobId: nestedLatest.latestObservations.jobId,
        observations: nestedLatest.latestObservations.items,
        links: nestedLinks,
        coreInterfaces: nestedLatest.interfaces.filter(
          (iface) => iface.deviceId === managedId
        ),
        deviceMeta: nestedMeta,
        statusByDeviceId,
        requireOutgoingLink: true,
        excludeDeviceIds: excludedFromNested,
        excludeMacs: excludedMacs,
      })
      if (nestedView.interfaceGroups.some((item) => item.devices.length > 0)) {
        nestedByDeviceId.set(device.id, nestedView.interfaceGroups)
      }
    }
  }

  return {
    graph,
    cores,
    local: attachNestedLocalTopology(
      local,
      nestedByDeviceId,
      managedIds,
      managedIdByHost,
      managedDevices
    ),
    curated,
    discoveryJobs,
    managementTargets,
  }
}

function toLocalTopologyLinks(
  links: Array<{
    fromDeviceId: string
    toDeviceId: string
    fromInterfaceId?: string | null
    fromInterfaceName?: string | null
  }>,
  interfaces: Array<{ id: string; name: string }>
): Array<{
  fromDeviceId: string
  toDeviceId: string
  fromInterfaceName: string | null
}> {
  const nameById = new Map(interfaces.map((iface) => [iface.id, iface.name]))
  return links.map((link) => ({
    fromDeviceId: link.fromDeviceId,
    toDeviceId: link.toDeviceId,
    fromInterfaceName:
      link.fromInterfaceName?.trim() ||
      (link.fromInterfaceId ? nameById.get(link.fromInterfaceId) ?? null : null),
  }))
}

function compactTopologyManagementJobs(
  jobs: Awaited<ReturnType<typeof listNetworkManagementJobs>>
): NetworkTopologyManagementJob[] {
  return jobs.map((job) => ({
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    targetId:
      typeof job.payload.targetId === "string" ? job.payload.targetId : null,
    targetHost: job.targetHost,
    deviceId:
      typeof job.payload.deviceId === "string" ? job.payload.deviceId : null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    completedAt: job.completedAt ?? null,
  }))
}

function compactTopologyManagementTargets(
  targets: Awaited<ReturnType<typeof listNetworkDiscoveryTargets>>
): NetworkTopologyManagementTarget[] {
  return targets.map((target) => ({
    agentId: target.agentId,
    host: target.host,
    updatedAt: target.updatedAt,
    hasSecret: target.hasSecret,
  }))
}
