import { displayMonitoringStatus } from "@/lib/network/monitoring/status"

export function tallyManagedMonitoringSummary(input: {
  managedDeviceIds: ReadonlySet<string>
  statusRows: Array<{
    device_id: string
    status: string
    last_poll_at: string | null
  }>
  interfaceRows: Array<{
    device_id: string
    status: string | null
  }>
  now?: number | Date
}): {
  devicesOnline: number
  devicesOffline: number
  devicesUnknown: number
  interfacesUp: number
  interfacesDown: number
} {
  let devicesOnline = 0
  let devicesOffline = 0
  for (const row of input.statusRows) {
    if (!input.managedDeviceIds.has(row.device_id)) continue
    const displayed = displayMonitoringStatus(
      row.status,
      row.last_poll_at,
      input.now
    )
    if (displayed === "online") devicesOnline += 1
    if (displayed === "offline") devicesOffline += 1
  }

  let interfacesUp = 0
  let interfacesDown = 0
  for (const row of input.interfaceRows) {
    if (!input.managedDeviceIds.has(row.device_id)) continue
    const status = (row.status ?? "").toLowerCase()
    if (status === "up" || status === "running") interfacesUp += 1
    else if (status === "down") interfacesDown += 1
  }

  const known = devicesOnline + devicesOffline
  return {
    devicesOnline,
    devicesOffline,
    devicesUnknown: Math.max(0, input.managedDeviceIds.size - known),
    interfacesUp,
    interfacesDown,
  }
}
