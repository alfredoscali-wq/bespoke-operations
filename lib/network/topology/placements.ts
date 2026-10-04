import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

export type TopologyPlacementErrorCode =
  | "DEVICE_NOT_FOUND"
  | "PARENT_NOT_FOUND"
  | "PARENT_NOT_PLACED"
  | "SELF_PARENT"
  | "CYCLE"
  | "DUPLICATE_ACTIVE"
  | "CROSS_COMPANY"
  | "HAS_CHILDREN"
  | "PLACEMENT_NOT_FOUND"

export class TopologyPlacementError extends Error {
  readonly code: TopologyPlacementErrorCode

  constructor(code: TopologyPlacementErrorCode, message: string) {
    super(message)
    this.name = "TopologyPlacementError"
    this.code = code
  }
}

export type NetworkTopologyPlacement = {
  id: string
  companyId: string
  deviceId: string
  parentDeviceId: string | null
  parentInterfaceId: string | null
  childInterfaceId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type TopologyPlacementDeviceRef = {
  id: string
  companyId: string
  deletedAt?: string | null
}

export type TopologyPlacementWriteInput = {
  companyId: string
  deviceId: string
  parentDeviceId?: string | null
  parentInterfaceId?: string | null
  childInterfaceId?: string | null
  sortOrder?: number
}

type PlacementContext = {
  placements: readonly NetworkTopologyPlacement[]
  devices: readonly TopologyPlacementDeviceRef[]
}

function nowIso(value?: string): string {
  return value ?? new Date().toISOString()
}

function isActivePlacement(
  placement: NetworkTopologyPlacement
): boolean {
  return placement.deletedAt == null
}

export function listActiveTopologyPlacements(
  placements: readonly NetworkTopologyPlacement[]
): NetworkTopologyPlacement[] {
  return placements
    .filter(isActivePlacement)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
}

export function listRootTopologyPlacements(
  placements: readonly NetworkTopologyPlacement[]
): NetworkTopologyPlacement[] {
  return listActiveTopologyPlacements(placements).filter(
    (placement) => placement.parentDeviceId == null
  )
}

export function listChildTopologyPlacements(
  placements: readonly NetworkTopologyPlacement[],
  parentDeviceId: string
): NetworkTopologyPlacement[] {
  return listActiveTopologyPlacements(placements).filter(
    (placement) => placement.parentDeviceId === parentDeviceId
  )
}

export function findActiveTopologyPlacementForDevice(
  placements: readonly NetworkTopologyPlacement[],
  deviceId: string
): NetworkTopologyPlacement | null {
  return (
    listActiveTopologyPlacements(placements).find(
      (placement) => placement.deviceId === deviceId
    ) ?? null
  )
}

function findDevice(
  devices: readonly TopologyPlacementDeviceRef[],
  deviceId: string
): TopologyPlacementDeviceRef | null {
  return devices.find((device) => device.id === deviceId) ?? null
}

function deviceIsPresent(
  device: TopologyPlacementDeviceRef | null
): device is TopologyPlacementDeviceRef {
  return device != null && device.deletedAt == null
}

export function topologyPlacementWouldCreateCycle(
  placements: readonly NetworkTopologyPlacement[],
  deviceId: string,
  parentDeviceId: string | null
): boolean {
  if (!parentDeviceId) return false
  const active = listActiveTopologyPlacements(placements)
  const parentByDeviceId = new Map(
    active.map((placement) => [placement.deviceId, placement.parentDeviceId] as const)
  )
  const visited = new Set<string>()
  let current: string | null = parentDeviceId
  while (current) {
    if (current === deviceId) return true
    if (visited.has(current)) return false
    visited.add(current)
    current = parentByDeviceId.get(current) ?? null
  }
  return false
}

function assertDeviceInCompany(
  device: TopologyPlacementDeviceRef,
  companyId: string
): void {
  if (device.companyId !== companyId) {
    throw new TopologyPlacementError(
      "CROSS_COMPANY",
      "La colocación no puede cruzar empresas."
    )
  }
}

export function assertTopologyPlacementParent(
  input: {
    companyId: string
    deviceId: string
    parentDeviceId: string | null
  },
  context: PlacementContext
): void {
  if (input.parentDeviceId == null) return
  if (input.parentDeviceId === input.deviceId) {
    throw new TopologyPlacementError(
      "SELF_PARENT",
      "Un dispositivo no puede ser padre de sí mismo."
    )
  }

  const parent = findDevice(context.devices, input.parentDeviceId)
  if (!deviceIsPresent(parent)) {
    throw new TopologyPlacementError(
      "PARENT_NOT_FOUND",
      "El padre de la colocación requiere un dispositivo existente."
    )
  }
  assertDeviceInCompany(parent, input.companyId)

  if (!findActiveTopologyPlacementForDevice(context.placements, input.parentDeviceId)) {
    throw new TopologyPlacementError(
      "PARENT_NOT_PLACED",
      "El padre debe estar colocado en la topología."
    )
  }
}

export function assertTopologyPlacementCreate(
  input: TopologyPlacementWriteInput,
  context: PlacementContext
): void {
  const parentDeviceId = input.parentDeviceId ?? null
  const device = findDevice(context.devices, input.deviceId)
  if (!deviceIsPresent(device)) {
    throw new TopologyPlacementError(
      "DEVICE_NOT_FOUND",
      "La colocación requiere un dispositivo existente."
    )
  }
  assertDeviceInCompany(device, input.companyId)

  if (findActiveTopologyPlacementForDevice(context.placements, input.deviceId)) {
    throw new TopologyPlacementError(
      "DUPLICATE_ACTIVE",
      "El dispositivo ya está colocado en la topología."
    )
  }

  assertTopologyPlacementParent(
    {
      companyId: input.companyId,
      deviceId: input.deviceId,
      parentDeviceId,
    },
    context
  )

  if (topologyPlacementWouldCreateCycle(context.placements, input.deviceId, parentDeviceId)) {
    throw new TopologyPlacementError(
      "CYCLE",
      "La colocación no puede crear un ciclo en la topología."
    )
  }
}

export function assertTopologyPlacementMove(
  placement: NetworkTopologyPlacement,
  parentDeviceId: string | null,
  context: PlacementContext
): void {
  if (!isActivePlacement(placement)) {
    throw new TopologyPlacementError(
      "PLACEMENT_NOT_FOUND",
      "La colocación no está activa."
    )
  }

  assertTopologyPlacementParent(
    {
      companyId: placement.companyId,
      deviceId: placement.deviceId,
      parentDeviceId,
    },
    context
  )

  if (
    topologyPlacementWouldCreateCycle(
      context.placements,
      placement.deviceId,
      parentDeviceId
    )
  ) {
    throw new TopologyPlacementError(
      "CYCLE",
      "La colocación no puede crear un ciclo en la topología."
    )
  }
}

export function assertTopologyPlacementSoftDelete(
  placement: NetworkTopologyPlacement,
  placements: readonly NetworkTopologyPlacement[]
): void {
  if (!isActivePlacement(placement)) {
    throw new TopologyPlacementError(
      "PLACEMENT_NOT_FOUND",
      "La colocación no está activa."
    )
  }
  const children = listChildTopologyPlacements(placements, placement.deviceId)
  if (children.length > 0) {
    throw new TopologyPlacementError(
      "HAS_CHILDREN",
      "No se puede quitar un dispositivo que todavía tiene hijos en la topología."
    )
  }
}

export function createTopologyPlacement(
  input: TopologyPlacementWriteInput & { now?: string; id?: string },
  context: PlacementContext
): NetworkTopologyPlacement {
  assertTopologyPlacementCreate(input, context)
  const stamp = nowIso(input.now)
  return {
    id: input.id ?? crypto.randomUUID(),
    companyId: input.companyId,
    deviceId: input.deviceId,
    parentDeviceId: input.parentDeviceId ?? null,
    parentInterfaceId: input.parentInterfaceId ?? null,
    childInterfaceId: input.childInterfaceId ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  }
}

export function updateTopologyPlacementParent(
  placement: NetworkTopologyPlacement,
  input: {
    parentDeviceId: string | null
    sortOrder?: number
    now?: string
  },
  context: PlacementContext
): NetworkTopologyPlacement {
  assertTopologyPlacementMove(placement, input.parentDeviceId, context)
  return {
    ...placement,
    parentDeviceId: input.parentDeviceId,
    sortOrder: input.sortOrder ?? placement.sortOrder,
    updatedAt: nowIso(input.now),
  }
}

export function softDeleteTopologyPlacement(
  placement: NetworkTopologyPlacement,
  placements: readonly NetworkTopologyPlacement[],
  now?: string
): NetworkTopologyPlacement {
  assertTopologyPlacementSoftDelete(placement, placements)
  const stamp = nowIso(now)
  return {
    ...placement,
    deletedAt: stamp,
    updatedAt: stamp,
  }
}

type Client = SupabaseClient<Database>
type PlacementRow = Database["public"]["Tables"]["network_topology_placements"]["Row"]

function mapPlacementRow(row: PlacementRow): NetworkTopologyPlacement {
  return {
    id: row.id,
    companyId: row.company_id,
    deviceId: row.device_id,
    parentDeviceId: row.parent_device_id,
    parentInterfaceId: row.parent_interface_id,
    childInterfaceId: row.child_interface_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export async function loadActiveTopologyPlacements(
  client: Client,
  companyId: string
): Promise<NetworkTopologyPlacement[]> {
  const { data, error } = await client
    .from("network_topology_placements")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  return listActiveTopologyPlacements((data ?? []).map(mapPlacementRow))
}

async function loadTopologyPlacementDevices(
  client: Client,
  deviceIds: readonly string[]
): Promise<TopologyPlacementDeviceRef[]> {
  const unique = [...new Set(deviceIds.filter(Boolean))]
  if (unique.length === 0) return []
  const { data, error } = await client
    .from("network_devices")
    .select("id, company_id, deleted_at")
    .in("id", unique)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    deletedAt: row.deleted_at,
  }))
}

async function persistTopologyPlacementRow(
  client: Client,
  placement: NetworkTopologyPlacement
): Promise<void> {
  const { error } = await client.from("network_topology_placements").insert({
    id: placement.id,
    company_id: placement.companyId,
    device_id: placement.deviceId,
    parent_device_id: placement.parentDeviceId,
    parent_interface_id: placement.parentInterfaceId,
    child_interface_id: placement.childInterfaceId,
    sort_order: placement.sortOrder,
    created_at: placement.createdAt,
    updated_at: placement.updatedAt,
    deleted_at: placement.deletedAt,
  })
  if (error) throw new Error(error.message)
}

export async function persistCreateTopologyPlacement(
  client: Client,
  input: TopologyPlacementWriteInput
): Promise<NetworkTopologyPlacement> {
  const placements = await loadActiveTopologyPlacements(client, input.companyId)
  const devices = await loadTopologyPlacementDevices(client, [
    input.deviceId,
    input.parentDeviceId ?? "",
  ])
  const created = createTopologyPlacement(input, { placements, devices })
  await persistTopologyPlacementRow(client, created)
  return created
}

export async function persistUpdateTopologyPlacementParent(
  client: Client,
  input: {
    companyId: string
    deviceId: string
    parentDeviceId: string | null
    sortOrder?: number
  }
): Promise<NetworkTopologyPlacement> {
  const placements = await loadActiveTopologyPlacements(client, input.companyId)
  const current = findActiveTopologyPlacementForDevice(placements, input.deviceId)
  if (!current) {
    throw new TopologyPlacementError(
      "PLACEMENT_NOT_FOUND",
      "La colocación no está activa."
    )
  }
  const devices = await loadTopologyPlacementDevices(client, [
    current.deviceId,
    input.parentDeviceId ?? "",
  ])
  const updated = updateTopologyPlacementParent(
    current,
    { parentDeviceId: input.parentDeviceId, sortOrder: input.sortOrder },
    { placements, devices }
  )
  const { error } = await client
    .from("network_topology_placements")
    .update({
      parent_device_id: updated.parentDeviceId,
      sort_order: updated.sortOrder,
      updated_at: updated.updatedAt,
    })
    .eq("id", updated.id)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return updated
}

export async function persistSoftDeleteTopologyPlacement(
  client: Client,
  input: { companyId: string; deviceId: string }
): Promise<NetworkTopologyPlacement> {
  const placements = await loadActiveTopologyPlacements(client, input.companyId)
  const current = findActiveTopologyPlacementForDevice(placements, input.deviceId)
  if (!current) {
    throw new TopologyPlacementError(
      "PLACEMENT_NOT_FOUND",
      "La colocación no está activa."
    )
  }
  const deleted = softDeleteTopologyPlacement(current, placements)
  const { error } = await client
    .from("network_topology_placements")
    .update({
      deleted_at: deleted.deletedAt,
      updated_at: deleted.updatedAt,
    })
    .eq("id", deleted.id)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
  if (error) throw new Error(error.message)
  return deleted
}
