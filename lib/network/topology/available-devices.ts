import { timestampBelongsToDiscoveryJob } from "@/lib/network/discovery/latest-run"
import type { LatestDiscoveryJobRef } from "@/lib/network/discovery/latest-run"
import { NETWORK_DEVICE_TYPE_LABELS } from "@/lib/network/labels"
import type { NetworkDeviceType } from "@/lib/network/constants"

export type AvailableCuratedTopologyDevice = {
  id: string
  hostname: string | null
  managementIp: string | null
  deviceType: string | null
  manufacturer: string | null
  model: string | null
  typeLabel: string
  status: string | null
}

export type AvailableCuratedTopologyDeviceInput = {
  id: string
  companyId: string
  hostname: string | null
  managementIp: string | null
  deviceType?: string | null
  manufacturer?: string | null
  model?: string | null
  status?: string | null
  deletedAt?: string | null
  lastSeenAt?: string | null
}

export type AvailableCuratedTopologyPlacementInput = {
  companyId: string
  deviceId: string
  deletedAt: string | null
}

export type DiscoveryJobDeviceRef = {
  id: string
  lastSeenAt?: string | null
}

export type DiscoveryJobLinkRef = {
  fromDeviceId: string
  toDeviceId: string
  lastSeenAt?: string | null
}

const MISSING_TYPE_TOKENS = new Set(["", "unknown", "other", "otro", "desconocido"])

export function curatedTopologyDeviceLabel(device: {
  id: string
  hostname?: string | null
  managementIp?: string | null
}): string {
  return device.hostname?.trim() || device.managementIp?.trim() || device.id
}

function meaningfulDiscoveryText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ""
  if (MISSING_TYPE_TOKENS.has(text.toLowerCase())) return null
  return text
}

/**
 * Same fields the Discovery screen shows as platform and board,
 * then the catalog device type. "Desconocido" only when none of those exist.
 */
export function curatedTopologyDeviceTypeLabel(device: {
  deviceType?: string | null
  manufacturer?: string | null
  model?: string | null
}): string {
  const model = meaningfulDiscoveryText(device.model)
  if (model) return model
  const manufacturer = meaningfulDiscoveryText(device.manufacturer)
  if (manufacturer) return manufacturer
  const type = device.deviceType?.trim().toLowerCase() ?? ""
  if (type && type in NETWORK_DEVICE_TYPE_LABELS && type !== "other") {
    return NETWORK_DEVICE_TYPE_LABELS[type as NetworkDeviceType]
  }
  return "Desconocido"
}

/**
 * Devices touched by one Discovery job.
 * A link is optional evidence. A device seen in the job window counts without one.
 */
export function collectDiscoveryJobDeviceIds(input: {
  job: LatestDiscoveryJobRef
  devices: readonly DiscoveryJobDeviceRef[]
  links?: readonly DiscoveryJobLinkRef[]
}): Set<string> {
  const ids = new Set<string>()
  for (const device of input.devices) {
    if (timestampBelongsToDiscoveryJob(device.lastSeenAt, input.job)) {
      ids.add(device.id)
    }
  }
  for (const link of input.links ?? []) {
    if (!timestampBelongsToDiscoveryJob(link.lastSeenAt, input.job)) continue
    if (link.fromDeviceId) ids.add(link.fromDeviceId)
    if (link.toDeviceId) ids.add(link.toDeviceId)
  }
  return ids
}

/**
 * Available children for the selected Core's latest Discovery.
 * Devices outside that Discovery are not candidates.
 */
export function selectAvailableCuratedTopologyDevices(input: {
  companyId: string
  coreDeviceId?: string | null
  parentDeviceId?: string | null
  discoveredDeviceIds: ReadonlySet<string> | readonly string[]
  devices: readonly AvailableCuratedTopologyDeviceInput[]
  placements: readonly AvailableCuratedTopologyPlacementInput[]
}): AvailableCuratedTopologyDevice[] {
  const discovered = new Set(input.discoveredDeviceIds)
  const occupied = new Set(
    input.placements
      .filter(
        (placement) =>
          placement.companyId === input.companyId && placement.deletedAt == null
      )
      .map((placement) => placement.deviceId)
  )
  const coreDeviceId = input.coreDeviceId?.trim() || null
  const parentDeviceId = input.parentDeviceId?.trim() || null

  return input.devices
    .filter((device) => {
      if (device.companyId !== input.companyId) return false
      if (device.deletedAt) return false
      if (!discovered.has(device.id)) return false
      if (occupied.has(device.id)) return false
      if (coreDeviceId && device.id === coreDeviceId) return false
      if (parentDeviceId && device.id === parentDeviceId) return false
      return true
    })
    .map((device) => ({
      id: device.id,
      hostname: device.hostname,
      managementIp: device.managementIp,
      deviceType: device.deviceType ?? null,
      manufacturer: device.manufacturer ?? null,
      model: device.model ?? null,
      typeLabel: curatedTopologyDeviceTypeLabel(device),
      status: device.status ?? null,
    }))
    .sort((left, right) =>
      curatedTopologyDeviceLabel(left).localeCompare(
        curatedTopologyDeviceLabel(right),
        "es"
      )
    )
}
