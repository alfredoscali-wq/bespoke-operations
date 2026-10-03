export const NETWORK_OBSERVATION_SCOPES = [
  "wan",
  "lan",
  "vlan",
  "unknown",
] as const

export type NetworkObservationScope = (typeof NETWORK_OBSERVATION_SCOPES)[number]

export type NetworkInterfaceScopeHint = {
  name?: string | null
  interfaceType?: string | null
  description?: string | null
}

const VLAN_TOKEN = /(^|[^a-z0-9])vlan(\d+)?($|[^a-z0-9])/
const WAN_TOKEN = /\b(wan|uplink|pppoe)\b/
const LAN_TOKEN = /\blan\b/
const BRIDGE_LAN_TOKEN = /\bbridge\d*\b/

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ""
}

export function splitObservedInterfaceTokens(
  name: string | null | undefined
): string[] {
  return normalize(name)
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function looksVlan(name: string, interfaceType: string, description: string): boolean {
  return (
    interfaceType === "vlan" ||
    interfaceType === "vlan-bridge" ||
    VLAN_TOKEN.test(name) ||
    VLAN_TOKEN.test(description)
  )
}

function looksWan(haystack: string, interfaceType: string): boolean {
  return (
    WAN_TOKEN.test(haystack) ||
    interfaceType === "pppoe-out" ||
    interfaceType === "lte" ||
    interfaceType === "pptp-out" ||
    interfaceType === "l2tp-out"
  )
}

function looksLan(name: string, interfaceType: string, description: string): boolean {
  const haystack = `${name} ${interfaceType} ${description}`.trim()
  return (
    LAN_TOKEN.test(haystack) ||
    interfaceType === "bridge" ||
    BRIDGE_LAN_TOKEN.test(name) ||
    BRIDGE_LAN_TOKEN.test(description) ||
    splitObservedInterfaceTokens(name).some((token) => BRIDGE_LAN_TOKEN.test(token))
  )
}

function classifyOwnInterfaceScope(input: NetworkInterfaceScopeHint): NetworkObservationScope {
  const name = normalize(input.name)
  const interfaceType = normalize(input.interfaceType)
  const description = normalize(input.description)
  const haystack = `${name} ${interfaceType} ${description}`.trim()
  const tokens = splitObservedInterfaceTokens(name)

  if (looksWan(haystack, interfaceType) || tokens.some((token) => looksWan(token, ""))) {
    return "wan"
  }
  if (looksVlan(name, interfaceType, description)) return "vlan"
  if (looksLan(name, interfaceType, description)) return "lan"
  return "unknown"
}

/**
 * WAN/uplink always wins. A RouterOS neighbor port like `ether2,bridge1`
 * is LAN because of the numbered bridge member, not because `ether2` is LAN.
 * A physical port that itself is WAN (comment/type) keeps WAN even if it
 * also sits on a bridge.
 */
export function classifyNetworkInterfaceScope(input: NetworkInterfaceScopeHint & {
  relatedInterfaces?: readonly NetworkInterfaceScopeHint[]
}): NetworkObservationScope {
  const own = classifyOwnInterfaceScope(input)
  const related = (input.relatedInterfaces ?? []).map((item) =>
    classifyOwnInterfaceScope(item)
  )
  return pickNetworkObservationScope([own, ...related])
}

export function pickNetworkObservationScope(
  scopes: readonly NetworkObservationScope[]
): NetworkObservationScope {
  if (scopes.includes("wan")) return "wan"
  if (scopes.includes("vlan")) return "vlan"
  if (scopes.includes("lan")) return "lan"
  return "unknown"
}
