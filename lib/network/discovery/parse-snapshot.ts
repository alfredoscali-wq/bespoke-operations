import type { DiscoverySnapshot } from "@/lib/network/discovery/contract"
import {
  NETWORK_DEVICE_STATUSES,
  NETWORK_DEVICE_TYPES,
  NETWORK_VENDORS,
  type NetworkDeviceStatus,
  type NetworkDeviceType,
  type NetworkVendor,
} from "@/lib/network/constants"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isDeviceType(value: unknown): value is NetworkDeviceType {
  return typeof value === "string" && (NETWORK_DEVICE_TYPES as readonly string[]).includes(value)
}

function isDeviceStatus(value: unknown): value is NetworkDeviceStatus {
  return (
    typeof value === "string" &&
    (NETWORK_DEVICE_STATUSES as readonly string[]).includes(value)
  )
}

function isVendor(value: unknown): value is NetworkVendor {
  return typeof value === "string" && (NETWORK_VENDORS as readonly string[]).includes(value)
}

function parseAddresses(value: unknown) {
  if (!Array.isArray(value)) return []
  const addresses: { address: string; prefixLength: number | null }[] = []
  for (const item of value) {
    const record = asRecord(item)
    const address = trimToNull(record?.address)
    if (!address) continue
    const prefix =
      typeof record?.prefixLength === "number" && Number.isFinite(record.prefixLength)
        ? record.prefixLength
        : null
    addresses.push({ address, prefixLength: prefix })
  }
  return addresses
}

function parseInterfaces(value: unknown) {
  if (!Array.isArray(value)) return []
  const interfaces: DiscoverySnapshot["devices"][number]["interfaces"] = []
  for (const item of value) {
    const record = asRecord(item)
    const name = trimToNull(record?.name)
    if (!name) continue
    interfaces.push({
      name,
      description: trimToNull(record?.description),
      macAddress: trimToNull(record?.macAddress),
      status: trimToNull(record?.status),
      speedMbps:
        typeof record?.speedMbps === "number" && Number.isFinite(record.speedMbps)
          ? record.speedMbps
          : null,
      interfaceType: trimToNull(record?.interfaceType),
      addresses: parseAddresses(record?.addresses),
    })
  }
  return interfaces
}

export function parseDiscoverySnapshot(
  body: unknown
): { ok: true; snapshot: DiscoverySnapshot } | { ok: false; message: string } {
  const record = asRecord(body)
  if (!record) {
    return { ok: false, message: "Resultado de discovery inválido." }
  }

  if (!isVendor(record.vendor)) {
    return { ok: false, message: "El vendor de discovery no es válido." }
  }

  const targetId = trimToNull(record.targetId)
  if (!targetId) {
    return { ok: false, message: "El resultado debe incluir targetId." }
  }

  if (!Array.isArray(record.devices) || record.devices.length === 0) {
    return { ok: false, message: "El discovery no incluyó dispositivos." }
  }

  const devices: DiscoverySnapshot["devices"] = []
  const seenKeys = new Set<string>()

  for (const item of record.devices) {
    const device = asRecord(item)
    const localKey = trimToNull(device?.localKey)
    if (!device || !localKey) {
      return { ok: false, message: "Cada dispositivo necesita localKey." }
    }
    if (seenKeys.has(localKey)) {
      return { ok: false, message: "Hay dispositivos duplicados en el resultado." }
    }
    seenKeys.add(localKey)
    if (!isDeviceType(device.deviceType)) {
      return { ok: false, message: `Tipo de dispositivo inválido (${localKey}).` }
    }
    devices.push({
      localKey,
      hostname: trimToNull(device.hostname),
      manufacturer: trimToNull(device.manufacturer),
      model: trimToNull(device.model),
      serialNumber: trimToNull(device.serialNumber),
      deviceType: device.deviceType,
      managementIp: trimToNull(device.managementIp),
      macAddress: trimToNull(device.macAddress),
      firmwareVersion: trimToNull(device.firmwareVersion),
      status: isDeviceStatus(device.status) ? device.status : "unknown",
      origin: device.origin === "neighbor" ? "neighbor" : "discovery",
      interfaces: parseInterfaces(device.interfaces),
    })
  }

  const links: DiscoverySnapshot["links"] = []
  if (Array.isArray(record.links)) {
    for (const item of record.links) {
      const link = asRecord(item)
      const fromLocalKey = trimToNull(link?.fromLocalKey)
      const toLocalKey = trimToNull(link?.toLocalKey)
      if (!fromLocalKey || !toLocalKey || fromLocalKey === toLocalKey) continue
      if (!seenKeys.has(fromLocalKey) || !seenKeys.has(toLocalKey)) continue
      links.push({
        fromLocalKey,
        fromInterfaceName: trimToNull(link?.fromInterfaceName),
        toLocalKey,
        toInterfaceName: trimToNull(link?.toInterfaceName),
        protocol: trimToNull(link?.protocol),
      })
    }
  }

  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((item): item is string => typeof item === "string")
    : []

  return {
    ok: true,
    snapshot: {
      vendor: record.vendor,
      targetId,
      siteId: trimToNull(record.siteId),
      devices,
      links,
      warnings,
    },
  }
}
