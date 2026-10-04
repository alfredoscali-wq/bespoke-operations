import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import {
  TopologyPlacementError,
  findActiveTopologyPlacementForDevice,
  listChildTopologyPlacements,
  listRootTopologyPlacements,
  loadActiveTopologyPlacements,
  type NetworkTopologyPlacement,
} from "@/lib/network/topology/placements"
import type {
  CuratedTopologyForest,
  CuratedTopologyNode,
} from "@/lib/network/topology/types"

type Client = SupabaseClient<Database>

export type CuratedTopologyDeviceRef = {
  id: string
  hostname: string | null
  managementIp: string | null
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function curatedNodeLabel(
  device: CuratedTopologyDeviceRef | undefined,
  deviceId: string
): string {
  return (
    trimmedOrNull(device?.hostname) ??
    trimmedOrNull(device?.managementIp) ??
    deviceId
  )
}

export function assertCuratedPlacementParentsExist(
  placements: readonly NetworkTopologyPlacement[]
): void {
  for (const placement of placements) {
    if (placement.parentDeviceId == null) continue
    if (
      !findActiveTopologyPlacementForDevice(placements, placement.parentDeviceId)
    ) {
      throw new TopologyPlacementError(
        "PARENT_NOT_PLACED",
        "El padre debe estar colocado en la topología."
      )
    }
  }
}

function toCuratedNode(
  placement: NetworkTopologyPlacement,
  placements: readonly NetworkTopologyPlacement[],
  devicesById: ReadonlyMap<string, CuratedTopologyDeviceRef>,
  ancestors: ReadonlySet<string>
): CuratedTopologyNode {
  if (ancestors.has(placement.deviceId)) {
    throw new TopologyPlacementError(
      "CYCLE",
      "La colocación no puede crear un ciclo en la topología."
    )
  }

  const device = devicesById.get(placement.deviceId)
  const nextAncestors = new Set(ancestors)
  nextAncestors.add(placement.deviceId)

  return {
    deviceId: placement.deviceId,
    label: curatedNodeLabel(device, placement.deviceId),
    hostname: trimmedOrNull(device?.hostname),
    ipAddress: trimmedOrNull(device?.managementIp),
    status: null,
    children: listChildTopologyPlacements(placements, placement.deviceId).map(
      (child) => toCuratedNode(child, placements, devicesById, nextAncestors)
    ),
  }
}

export function buildCuratedTopologyForest(
  placements: readonly NetworkTopologyPlacement[],
  devices: readonly CuratedTopologyDeviceRef[]
): CuratedTopologyForest {
  assertCuratedPlacementParentsExist(placements)
  const devicesById = new Map(devices.map((device) => [device.id, device]))
  return {
    roots: listRootTopologyPlacements(placements).map((placement) =>
      toCuratedNode(placement, placements, devicesById, new Set())
    ),
  }
}

async function loadCuratedTopologyDevices(
  client: Client,
  companyId: string,
  deviceIds: readonly string[]
): Promise<CuratedTopologyDeviceRef[]> {
  const unique = [...new Set(deviceIds.filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await client
    .from("network_devices")
    .select("id, hostname, management_ip")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .in("id", unique)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    hostname: row.hostname,
    managementIp: row.management_ip,
  }))
}

export async function getCuratedTopologyForest(
  client: Client,
  companyId: string
): Promise<CuratedTopologyForest> {
  const placements = await loadActiveTopologyPlacements(client, companyId)
  const devices = await loadCuratedTopologyDevices(
    client,
    companyId,
    placements.map((placement) => placement.deviceId)
  )
  return buildCuratedTopologyForest(placements, devices)
}
