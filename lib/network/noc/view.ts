import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { listActiveNetworkAlarms } from "@/lib/network/alarms/queries"
import { listNetworkDeviceOperationalStatuses } from "@/lib/network/monitoring/queries"
import { nocHealthFromMonitoring } from "@/lib/network/noc/types"
import type {
  NocAlarmView,
  NocMonitorPage,
  NocMonitorSummary,
  NocTopologyForest,
  NocTopologyNode,
} from "@/lib/network/noc/types"
import { getCuratedTopologyForest } from "@/lib/network/topology/curated-view"
import type { CuratedTopologyNode } from "@/lib/network/topology/types"
import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>

type StatusRow = {
  status: string
  lastPollAt: string | null
}

function walkNocNodes(
  nodes: readonly NocTopologyNode[],
  visit: (node: NocTopologyNode) => void
) {
  for (const node of nodes) {
    visit(node)
    walkNocNodes(node.children, visit)
  }
}

function toNocNode(
  node: CuratedTopologyNode,
  statuses: ReadonlyMap<string, StatusRow>
): NocTopologyNode {
  const row = statuses.get(node.deviceId)
  return {
    deviceId: node.deviceId,
    label: node.label,
    ipAddress: node.ipAddress,
    health: nocHealthFromMonitoring(
      row?.status === "online" ||
        row?.status === "offline" ||
        row?.status === "degraded" ||
        row?.status === "unknown"
        ? row.status
        : null
    ),
    children: node.children.map((child) => toNocNode(child, statuses)),
  }
}

function buildSummary(
  forest: NocTopologyForest,
  activeAlarmCount: number
): NocMonitorSummary {
  let deviceCount = 0
  let onlineCount = 0
  let attentionCount = 0
  let offlineCount = 0
  walkNocNodes(forest.roots, (node) => {
    deviceCount += 1
    if (node.health === "online") onlineCount += 1
    if (node.health === "attention") attentionCount += 1
    if (node.health === "offline") offlineCount += 1
  })
  return {
    deviceCount,
    onlineCount,
    attentionCount,
    offlineCount,
    activeAlarmCount,
  }
}

function pickLastUpdatedAt(
  statuses: ReadonlyMap<string, StatusRow>,
  deviceIds: readonly string[]
): string {
  let latestMs = 0
  for (const deviceId of deviceIds) {
    const pollAt = statuses.get(deviceId)?.lastPollAt
    if (!pollAt) continue
    const ms = Date.parse(pollAt)
    if (Number.isFinite(ms) && ms > latestMs) latestMs = ms
  }
  return new Date(latestMs > 0 ? latestMs : Date.now()).toISOString()
}

function collectDeviceIds(nodes: readonly NocTopologyNode[]): string[] {
  const ids: string[] = []
  walkNocNodes(nodes, (node) => ids.push(node.deviceId))
  return ids
}

async function loadCompanyName(
  client: Client,
  companyId: string
): Promise<string> {
  const { data, error } = await client
    .from("companies")
    .select("display_name, name")
    .eq("id", companyId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.display_name?.trim() || data?.name?.trim() || "Empresa"
}

async function loadNocAlarms(
  client: Client,
  companyId: string
): Promise<NocAlarmView[]> {
  try {
    const alarms = await listActiveNetworkAlarms(client, companyId)
    return alarms.map((alarm) => ({
      id: alarm.id,
      deviceId: alarm.deviceId,
      severity: alarm.severity,
      status: alarm.status,
      title: alarm.title,
      message: alarm.message,
      createdAt: alarm.createdAt,
    }))
  } catch {
    return []
  }
}

export function overlayNocHealth(
  forest: { roots: CuratedTopologyNode[] },
  statuses: ReadonlyMap<string, StatusRow>
): NocTopologyForest {
  return {
    roots: forest.roots.map((root) => toNocNode(root, statuses)),
  }
}

export async function getNocMonitorPage(
  client: Client,
  companyId: string
): Promise<NocMonitorPage> {
  const [curated, statuses, companyName, alarms] = await Promise.all([
    getCuratedTopologyForest(client, companyId),
    listNetworkDeviceOperationalStatuses(client, companyId),
    loadCompanyName(client, companyId),
    loadNocAlarms(client, companyId),
  ])
  const topology = overlayNocHealth(curated, statuses)
  return {
    companyName,
    summary: buildSummary(topology, alarms.length),
    topology,
    alarms,
    lastUpdatedAt: pickLastUpdatedAt(statuses, collectDeviceIds(topology.roots)),
  }
}
