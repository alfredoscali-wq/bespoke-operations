import type {
  DiscoveryAddress,
  DiscoveryDevice,
  DiscoveryInterface,
  DiscoveryLink,
  DiscoverySnapshot,
} from "@/lib/network/discovery/contract"
import { buildDeviceFingerprint } from "@/lib/network/discovery/fingerprint"
import type { NetworkDeviceType } from "@/lib/network/constants"

export type RouterOsFacts = {
  host: string
  targetId: string
  siteId: string | null
  identity: Record<string, string>
  resource: Record<string, string>
  routerboard: Record<string, string>
  interfaces: Record<string, string>[]
  addresses: Record<string, string>[]
  neighbors: Record<string, string>[]
}

function pick(record: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]?.trim()
    if (value) return value
  }
  return null
}

function parseSpeedMbps(value: string | null): number | null {
  if (!value) return null
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(gbps|mbps|kbps|g|m|k)?/)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2] ?? "mbps"
  if (unit.startsWith("g")) return Math.round(amount * 1000)
  if (unit.startsWith("k")) return Math.round(amount / 1000)
  return Math.round(amount)
}

function parseAddress(raw: string | null): DiscoveryAddress | null {
  if (!raw) return null
  const [address, prefix] = raw.split("/")
  if (!address?.trim()) return null
  const prefixLength = prefix ? Number(prefix) : null
  return {
    address: address.trim(),
    prefixLength: Number.isFinite(prefixLength) ? prefixLength : null,
  }
}

function inferDeviceType(board: string | null, platform: string | null): NetworkDeviceType {
  const text = `${board ?? ""} ${platform ?? ""}`.toLowerCase()
  if (/\b(crs|css|switch)\b/.test(text)) return "switch"
  if (/\b(cap|wap|cape)\b/.test(text)) return "ap"
  if (/\b(sxt|lhg|nray|wireless|radio|lte)\b/.test(text)) return "radio"
  if (/\b(ccr|hex|rb|chr|router)\b/.test(text)) return "router"
  return "router"
}

function interfaceStatus(row: Record<string, string>): string {
  if (row.disabled === "true") return "down"
  if (row.running === "false") return "down"
  if (row.running === "true") return "up"
  return pick(row, "status") ?? "unknown"
}

function mapInterfaces(
  interfaces: Record<string, string>[],
  addresses: Record<string, string>[]
): DiscoveryInterface[] {
  const addressesByIface = new Map<string, DiscoveryAddress[]>()
  for (const row of addresses) {
    if (row.disabled === "true") continue
    const ifaceName = pick(row, "interface")
    const parsed = parseAddress(pick(row, "address"))
    if (!ifaceName || !parsed) continue
    const list = addressesByIface.get(ifaceName) ?? []
    list.push(parsed)
    addressesByIface.set(ifaceName, list)
  }

  return interfaces.map((row) => {
    const name = pick(row, "name") ?? "unknown"
    return {
      name,
      description: pick(row, "comment"),
      macAddress: pick(row, "mac-address", "mac_address"),
      status: interfaceStatus(row),
      speedMbps: parseSpeedMbps(pick(row, "speed")),
      interfaceType: pick(row, "type"),
      addresses: addressesByIface.get(name) ?? [],
    }
  })
}

function chooseDeviceMac(
  interfaces: DiscoveryInterface[],
  managementIp: string
): string | null {
  const holder = interfaces.find((iface) =>
    iface.addresses.some((item) => item.address === managementIp)
  )
  if (holder?.macAddress) return holder.macAddress
  const ethernet = interfaces.find(
    (iface) =>
      iface.macAddress &&
      (iface.interfaceType === "ether" || iface.name.toLowerCase().startsWith("ether"))
  )
  return ethernet?.macAddress ?? interfaces.find((iface) => iface.macAddress)?.macAddress ?? null
}

export function mapMikrotikFactsToSnapshot(facts: RouterOsFacts): DiscoverySnapshot {
  const warnings: string[] = []
  const hostname = pick(facts.identity, "name") ?? facts.host
  const version = pick(facts.resource, "version")
  const board = pick(facts.routerboard, "model", "board-name") ?? pick(facts.resource, "board-name")
  const serial = pick(facts.routerboard, "serial-number", "serial")
  const firmware =
    pick(facts.routerboard, "current-firmware") ?? version
  const interfaces = mapInterfaces(facts.interfaces, facts.addresses)
  const macAddress = chooseDeviceMac(interfaces, facts.host)

  const target: DiscoveryDevice = {
    localKey: "target",
    hostname,
    manufacturer: "MikroTik",
    model: board,
    serialNumber: serial,
    deviceType: inferDeviceType(board, pick(facts.resource, "platform")),
    managementIp: facts.host,
    macAddress,
    firmwareVersion: firmware,
    status: "online",
    origin: "discovery",
    interfaces,
  }

  try {
    buildDeviceFingerprint({
      serialNumber: target.serialNumber,
      macAddress: target.macAddress,
      managementIp: target.managementIp,
      manufacturer: target.manufacturer,
      neighborIdentity: target.hostname,
    })
  } catch {
    warnings.push("El MikroTik no expuso serial ni MAC; se usó el IP de gestión.")
  }

  const devices: DiscoveryDevice[] = [target]
  const links: DiscoveryLink[] = []
  const seenNeighbors = new Set<string>()

  for (const neighbor of facts.neighbors) {
    const identity = pick(neighbor, "identity")
    const address = pick(neighbor, "address")
    const mac = pick(neighbor, "mac-address", "mac_address")
    const localInterface = pick(neighbor, "interface")
    if (!identity && !address && !mac) continue

    const localKey = `neighbor:${(mac || identity || address || "unknown").toLowerCase()}`
    if (seenNeighbors.has(localKey)) continue
    seenNeighbors.add(localKey)

    const platform = pick(neighbor, "platform", "board")
    const manufacturer = platform?.toLowerCase().includes("mikro")
      ? "MikroTik"
      : platform
    const remoteType = inferDeviceType(pick(neighbor, "board"), platform)

    devices.push({
      localKey,
      hostname: identity,
      manufacturer,
      model: pick(neighbor, "board"),
      serialNumber: null,
      deviceType: remoteType === "router" && !platform?.toLowerCase().includes("mikro")
        ? "other"
        : remoteType,
      managementIp: address,
      macAddress: mac,
      firmwareVersion: pick(neighbor, "version"),
      status: "unknown",
      origin: "neighbor",
      interfaces: [],
    })

    links.push({
      fromLocalKey: "target",
      fromInterfaceName: localInterface,
      toLocalKey: localKey,
      toInterfaceName: null,
      protocol: pick(neighbor, "discovered-by") ?? "mndp",
    })
  }

  if (facts.neighbors.length === 0) {
    warnings.push("El MikroTik no devolvió vecinos (IP neighbor / MNDP).")
  }

  return {
    vendor: "mikrotik",
    targetId: facts.targetId,
    siteId: facts.siteId,
    devices,
    links,
    warnings,
  }
}
