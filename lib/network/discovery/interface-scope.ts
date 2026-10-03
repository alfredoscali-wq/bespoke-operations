export const NETWORK_OBSERVATION_SCOPES = [
  "wan",
  "lan",
  "vlan",
  "unknown",
] as const

export type NetworkObservationScope = (typeof NETWORK_OBSERVATION_SCOPES)[number]

const VLAN_TOKEN = /(^|[^a-z0-9])vlan(\d+)?($|[^a-z0-9])/
const WAN_TOKEN = /\b(wan|uplink|pppoe)\b/
const LAN_TOKEN = /\blan\b/
const BRIDGE_TOKEN = /\bbridge\b/

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ""
}

export function classifyNetworkInterfaceScope(input: {
  name?: string | null
  interfaceType?: string | null
  description?: string | null
}): NetworkObservationScope {
  const name = normalize(input.name)
  const interfaceType = normalize(input.interfaceType)
  const description = normalize(input.description)
  const haystack = `${name} ${interfaceType} ${description}`.trim()

  const looksVlan =
    interfaceType === "vlan" ||
    interfaceType === "vlan-bridge" ||
    VLAN_TOKEN.test(name) ||
    VLAN_TOKEN.test(description)
  if (looksVlan) return "vlan"

  const looksWan =
    WAN_TOKEN.test(haystack) ||
    interfaceType === "pppoe-out" ||
    interfaceType === "lte" ||
    interfaceType === "pptp-out" ||
    interfaceType === "l2tp-out"
  if (looksWan) return "wan"

  const looksLan =
    LAN_TOKEN.test(haystack) ||
    interfaceType === "bridge" ||
    BRIDGE_TOKEN.test(name) ||
    BRIDGE_TOKEN.test(description)
  if (looksLan) return "lan"

  return "unknown"
}

export function pickNetworkObservationScope(
  scopes: readonly NetworkObservationScope[]
): NetworkObservationScope {
  if (scopes.includes("wan")) return "wan"
  if (scopes.includes("vlan")) return "vlan"
  if (scopes.includes("lan")) return "lan"
  return "unknown"
}
