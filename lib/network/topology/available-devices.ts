export type AvailableCuratedTopologyDevice = {
  id: string
  hostname: string | null
  managementIp: string | null
  deviceType: string | null
  model: string | null
  status: string | null
}

export type AvailableCuratedTopologyDeviceInput = {
  id: string
  companyId: string
  hostname: string | null
  managementIp: string | null
  deviceType?: string | null
  model?: string | null
  status?: string | null
  deletedAt?: string | null
}

export type AvailableCuratedTopologyPlacementInput = {
  companyId: string
  deviceId: string
  deletedAt: string | null
}

export function curatedTopologyDeviceLabel(device: {
  id: string
  hostname?: string | null
  managementIp?: string | null
}): string {
  return device.hostname?.trim() || device.managementIp?.trim() || device.id
}

/**
 * Devices that can be placed in the curated topology.
 * Active placements occupy a device. Links, discovery jobs and last_seen_at do not.
 */
export function selectAvailableCuratedTopologyDevices(input: {
  companyId: string
  parentDeviceId?: string | null
  devices: readonly AvailableCuratedTopologyDeviceInput[]
  placements: readonly AvailableCuratedTopologyPlacementInput[]
}): AvailableCuratedTopologyDevice[] {
  const occupied = new Set(
    input.placements
      .filter(
        (placement) =>
          placement.companyId === input.companyId && placement.deletedAt == null
      )
      .map((placement) => placement.deviceId)
  )
  const parentDeviceId = input.parentDeviceId?.trim() || null

  return input.devices
    .filter((device) => {
      if (device.companyId !== input.companyId) return false
      if (device.deletedAt) return false
      if (occupied.has(device.id)) return false
      if (parentDeviceId && device.id === parentDeviceId) return false
      return true
    })
    .map((device) => ({
      id: device.id,
      hostname: device.hostname,
      managementIp: device.managementIp,
      deviceType: device.deviceType ?? null,
      model: device.model ?? null,
      status: device.status ?? null,
    }))
    .sort((left, right) =>
      curatedTopologyDeviceLabel(left).localeCompare(
        curatedTopologyDeviceLabel(right),
        "es"
      )
    )
}
