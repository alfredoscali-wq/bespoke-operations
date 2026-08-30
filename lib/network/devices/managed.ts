export type ManagedNetworkDeviceRef = {
  companyId: string
  agentId: string | null
  managementIp: string | null
  origin?: string | null
}

export type ManagedNetworkTargetRef = {
  companyId: string
  agentId: string
  host: string
}

export function isManagedNetworkDevice(
  device: ManagedNetworkDeviceRef,
  target: ManagedNetworkTargetRef
): boolean {
  if (!device.agentId || device.managementIp == null) return false
  return (
    device.companyId === target.companyId &&
    device.agentId === target.agentId &&
    device.managementIp.trim() === target.host.trim()
  )
}

export function selectManagedNetworkDevices<T extends ManagedNetworkDeviceRef>(
  devices: T[],
  targets: ManagedNetworkTargetRef[]
): T[] {
  const selected: T[] = []
  const seen = new Set<T>()
  for (const device of devices) {
    const managed = targets.some((target) => isManagedNetworkDevice(device, target))
    if (!managed || seen.has(device)) continue
    seen.add(device)
    selected.push(device)
  }
  return selected
}

export function buildManagedNetworkDeviceOrFilter(
  targets: Array<{ agent_id: string; host: string }>
): string | null {
  const seen = new Set<string>()
  const clauses: string[] = []
  for (const target of targets) {
    const host = target.host.trim()
    if (!target.agent_id || !host) continue
    const key = `${target.agent_id}\0${host}`
    if (seen.has(key)) continue
    seen.add(key)
    clauses.push(`and(agent_id.eq.${target.agent_id},management_ip.eq.${host})`)
  }
  return clauses.length > 0 ? clauses.join(",") : null
}
