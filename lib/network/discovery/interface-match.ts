/**
 * Safe match of a discovery-reported interface name against known Core interfaces.
 * Exact name first, then a unique identifier token (ether1, vlan211). Ambiguous → null.
 */

const INTERFACE_IDENTITY_TOKEN = /^[a-z]+[0-9]+$/

export type NetworkInterfaceMatchRef = {
  id: string
  name: string
}

function normalizeInterfaceName(value: string): string {
  return value.trim().toLowerCase()
}

function interfaceIdentityTokens(name: string): string[] {
  return normalizeInterfaceName(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => INTERFACE_IDENTITY_TOKEN.test(token))
}

export function findMatchingNetworkInterfaceId(
  interfaces: readonly NetworkInterfaceMatchRef[],
  observedName: string | null | undefined
): string | null {
  if (!observedName?.trim()) return null
  const observed = normalizeInterfaceName(observedName)

  const exact = interfaces.filter(
    (iface) => normalizeInterfaceName(iface.name) === observed
  )
  if (exact.length === 1) return exact[0].id
  if (exact.length > 1) return null

  if (!INTERFACE_IDENTITY_TOKEN.test(observed)) return null

  const byIdentity = interfaces.filter((iface) =>
    interfaceIdentityTokens(iface.name).includes(observed)
  )
  if (byIdentity.length === 1) return byIdentity[0].id
  return null
}
