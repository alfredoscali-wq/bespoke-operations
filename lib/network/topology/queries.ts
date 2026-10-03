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
import { pickLatestCompletedDiscoveryJobForHost } from "@/lib/network/discovery/latest-run"
import {
  attachNestedLocalTopology,
  buildLocalCoreTopologyView,
  emptyLocalCoreTopologyView,
  selectTopologyRootIds,
} from "@/lib/network/topology/local-view"
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

export async function getNetworkTopologyGraph(
  client: Client,
  companyId: string
): Promise<NetworkTopologyGraph> {
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

  return buildCanonicalTopologyGraph(devices, rawLinks)
}

export async function getNetworkTopologyPage(
  client: Client,
  companyId: string,
  deviceId?: string | null
): Promise<NetworkTopologyPage> {
  const graph = await getNetworkTopologyGraph(client, companyId)
  const [managementJobs, listedTargets] = await Promise.all([
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
  const viewpoints = managedNodes.flatMap((node) => {
    const host = node.managementIp?.trim()
    if (!host) return []
    const latestForHost = byHost.get(host)
    if (!latestForHost?.latestObservations.jobId) return []
    const job = pickLatestCompletedDiscoveryJobForHost(jobs, host)
    if (!job) return []
    return [
      {
        deviceId: node.id,
        completedAt: job.completedAt,
        lanVlanChildIds: latestForHost.latestObservations.items
          .filter((item) => item.scope === "lan" || item.scope === "vlan")
          .map((item) => item.id),
      },
    ]
  })
  const rootIds = new Set(
    selectTopologyRootIds(
      managedNodes.map((node) => node.id),
      viewpoints
    )
  )
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
    return { graph, cores, local: null, discoveryJobs, managementTargets }
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

  const local = buildLocalCoreTopologyView({
    core,
    jobId: latest.latestObservations.jobId,
    observations: latest.latestObservations.items,
    links: latest.links,
    coreInterfaces: latest.interfaces.filter((iface) => iface.deviceId === selected.id),
    deviceMeta,
    statusByDeviceId,
  })

  const nestedByDeviceId = new Map<string, LocalTopologyInterfaceGroup[]>()
  for (const group of local.interfaceGroups) {
    for (const device of group.devices) {
      if (!managedIds.has(device.id) || device.id === selected.id) continue
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
      const nestedView = buildLocalCoreTopologyView({
        core: {
          id: device.id,
          hostname: device.hostname,
          managementIp: device.managementIp,
          operationalStatus: device.operationalStatus,
          lastPollAt: device.lastPollAt,
        },
        jobId: nestedLatest.latestObservations.jobId,
        observations: nestedLatest.latestObservations.items,
        links: nestedLatest.links,
        coreInterfaces: nestedLatest.interfaces.filter(
          (iface) => iface.deviceId === device.id
        ),
        deviceMeta: nestedMeta,
        statusByDeviceId,
        requireOutgoingLink: true,
      })
      if (nestedView.interfaceGroups.some((item) => item.devices.length > 0)) {
        nestedByDeviceId.set(device.id, nestedView.interfaceGroups)
      }
    }
  }

  return {
    graph,
    cores,
    local: attachNestedLocalTopology(local, nestedByDeviceId, managedIds),
    discoveryJobs,
    managementTargets,
  }
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
