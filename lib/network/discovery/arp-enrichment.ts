import { normalizeMacAddress } from "@/lib/network/discovery/fingerprint"

export type DiscoveryManagementIpSource = "neighbor" | "arp"

export type ArpRecordInput = {
  macAddress?: string | null
  address?: string | null
  complete?: string | null
  disabled?: string | null
}

const CANONICAL_MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/

export function canonicalMacAddress(
  value: string | null | undefined
): string | null {
  const normalized = normalizeMacAddress(value)
  if (!normalized || !CANONICAL_MAC.test(normalized)) return null
  return normalized
}

function isUsableArpRecord(entry: ArpRecordInput): boolean {
  if (entry.disabled === "true") return false
  if (entry.complete === "false") return false
  return true
}

function isUsableIp(value: string | null | undefined): string | null {
  const ip = value?.trim() || null
  return ip
}

/**
 * Unique MAC → IP. Same MAC with different IPs is omitted (no arbitrary pick).
 */
export function buildArpIpByMac(
  entries: readonly ArpRecordInput[]
): Map<string, string> {
  const collected = new Map<string, string | "ambiguous">()

  for (const entry of entries) {
    if (!isUsableArpRecord(entry)) continue
    const mac = canonicalMacAddress(entry.macAddress)
    const ip = isUsableIp(entry.address)
    if (!mac || !ip) continue

    const existing = collected.get(mac)
    if (!existing) {
      collected.set(mac, ip)
      continue
    }
    if (existing !== "ambiguous" && existing !== ip) {
      collected.set(mac, "ambiguous")
    }
  }

  const unique = new Map<string, string>()
  for (const [mac, ip] of collected) {
    if (ip !== "ambiguous") unique.set(mac, ip)
  }
  return unique
}

export function resolveObservedManagementIp(input: {
  neighborIp: string | null | undefined
  neighborMac: string | null | undefined
  arpIpByMac: Map<string, string>
}): {
  managementIp: string | null
  source: DiscoveryManagementIpSource | null
} {
  const neighborIp = isUsableIp(input.neighborIp)
  if (neighborIp) {
    return { managementIp: neighborIp, source: "neighbor" }
  }

  const mac = canonicalMacAddress(input.neighborMac)
  if (!mac) {
    return { managementIp: null, source: null }
  }

  const arpIp = input.arpIpByMac.get(mac) ?? null
  if (arpIp) {
    return { managementIp: arpIp, source: "arp" }
  }

  return { managementIp: null, source: null }
}
