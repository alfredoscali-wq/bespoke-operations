import { normalizeMacAddress } from "@/lib/network/discovery/fingerprint"

export type CanonicalDeviceRecord = {
  id: string
  fingerprint: string
  origin: string
  agentId: string | null
  managementIp: string | null
  macAddress: string | null
}

export type CanonicalInterfaceRecord = {
  deviceId: string
  macAddress: string | null
}

export type CanonicalizationCatalog = {
  devices: CanonicalDeviceRecord[]
  interfaces: CanonicalInterfaceRecord[]
}

export type CanonicalDeviceResolution =
  | {
      action: "reuse"
      deviceId: string
      reason: "fingerprint" | "device_mac" | "interface_mac" | "management_ip"
    }
  | {
      action: "insert"
      reason:
        | "no_match"
        | "ambiguous_device_mac"
        | "ambiguous_interface_mac"
        | "ambiguous_management_ip"
        | "conflict"
    }

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}

function normalizeIp(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed ? trimmed : null
}

function matchDeviceMacIds(
  catalog: CanonicalizationCatalog,
  mac: string
): string[] {
  return uniqueIds(
    catalog.devices
      .filter((device) => normalizeMacAddress(device.macAddress) === mac)
      .map((device) => device.id)
  )
}

function matchInterfaceMacIds(
  catalog: CanonicalizationCatalog,
  mac: string
): string[] {
  return uniqueIds(
    catalog.interfaces
      .filter((iface) => normalizeMacAddress(iface.macAddress) === mac)
      .map((iface) => iface.deviceId)
  )
}

function matchManagementIpIds(
  catalog: CanonicalizationCatalog,
  agentId: string,
  managementIp: string
): string[] {
  return uniqueIds(
    catalog.devices
      .filter(
        (device) =>
          (device.agentId ?? "").trim() === agentId.trim() &&
          normalizeIp(device.managementIp) === managementIp
      )
      .map((device) => device.id)
  )
}

/**
 * Inventory canonicalization. Does not mark devices managed.
 * Never uses hostname. Neighbor snapshots never match by IP alone.
 */
export function resolveCanonicalNetworkDevice(input: {
  fingerprint: string
  snapshotOrigin: "discovery" | "neighbor"
  agentId: string
  macAddress?: string | null
  managementIp?: string | null
  catalog: CanonicalizationCatalog
}): CanonicalDeviceResolution {
  const fingerprint = input.fingerprint.trim()
  const fingerprintMatches = uniqueIds(
    input.catalog.devices
      .filter((device) => device.fingerprint === fingerprint)
      .map((device) => device.id)
  )
  if (fingerprintMatches.length === 1 && fingerprintMatches[0]) {
    return {
      action: "reuse",
      deviceId: fingerprintMatches[0],
      reason: "fingerprint",
    }
  }

  const mac = normalizeMacAddress(input.macAddress)
  let macDeviceId: string | null = null
  let macReason: "device_mac" | "interface_mac" | null = null
  let ambiguousMac = false

  if (mac) {
    const deviceMacIds = matchDeviceMacIds(input.catalog, mac)
    if (deviceMacIds.length > 1) {
      ambiguousMac = true
    } else if (deviceMacIds.length === 1) {
      macDeviceId = deviceMacIds[0] ?? null
      macReason = "device_mac"
    } else {
      const interfaceMacIds = matchInterfaceMacIds(input.catalog, mac)
      if (interfaceMacIds.length > 1) {
        ambiguousMac = true
      } else if (interfaceMacIds.length === 1) {
        macDeviceId = interfaceMacIds[0] ?? null
        macReason = "interface_mac"
      }
    }
  }

  let ipDeviceId: string | null = null
  let ambiguousIp = false
  const ip = normalizeIp(input.managementIp)
  if (input.snapshotOrigin === "discovery" && ip && input.agentId.trim()) {
    const ipIds = matchManagementIpIds(input.catalog, input.agentId, ip)
    if (ipIds.length > 1) {
      ambiguousIp = true
    } else if (ipIds.length === 1) {
      ipDeviceId = ipIds[0] ?? null
    }
  }

  if (macDeviceId && ipDeviceId && macDeviceId !== ipDeviceId) {
    return { action: "insert", reason: "conflict" }
  }

  if (macDeviceId && macReason) {
    return { action: "reuse", deviceId: macDeviceId, reason: macReason }
  }

  if (ipDeviceId) {
    return { action: "reuse", deviceId: ipDeviceId, reason: "management_ip" }
  }

  if (ambiguousMac && mac && matchDeviceMacIds(input.catalog, mac).length > 1) {
    return { action: "insert", reason: "ambiguous_device_mac" }
  }
  if (ambiguousMac) {
    return { action: "insert", reason: "ambiguous_interface_mac" }
  }
  if (ambiguousIp) {
    return { action: "insert", reason: "ambiguous_management_ip" }
  }

  return { action: "insert", reason: "no_match" }
}

export function nextCanonicalFingerprint(input: {
  existingFingerprint: string
  snapshotFingerprint: string
  catalog: CanonicalizationCatalog
  deviceId: string
}): string {
  if (!input.snapshotFingerprint.startsWith("serial:")) {
    return input.existingFingerprint
  }
  if (input.existingFingerprint === input.snapshotFingerprint) {
    return input.existingFingerprint
  }
  const taken = input.catalog.devices.some(
    (device) =>
      device.id !== input.deviceId &&
      device.fingerprint === input.snapshotFingerprint
  )
  if (taken) return input.existingFingerprint
  return input.snapshotFingerprint
}

export function nextCanonicalOrigin(
  existingOrigin: string,
  snapshotOrigin: "discovery" | "neighbor"
): "discovery" | "neighbor" {
  if (existingOrigin === "discovery" || snapshotOrigin === "discovery") {
    return "discovery"
  }
  return "neighbor"
}
