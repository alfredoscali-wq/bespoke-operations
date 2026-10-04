export type TopologyManagedDirectedLink = {
  fromDeviceId: string
  toDeviceId: string
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

function countOutgoing(
  deviceId: string,
  links: readonly TopologyManagedDirectedLink[]
): number {
  let count = 0
  for (const link of links) {
    if (link.fromDeviceId === deviceId && link.toDeviceId !== deviceId) count += 1
  }
  return count
}

/**
 * Directed parent → child among managed devices.
 * `from_device_id` is the observer/upstream. Reverse pairs keep the
 * endpoint that scans more neighbors so MNDP back-edges do not flip Core.
 */
export function listManagedParentIds(
  deviceId: string,
  managedIds: ReadonlySet<string>,
  links: readonly TopologyManagedDirectedLink[]
): string[] {
  if (!managedIds.has(deviceId)) return []

  const parents: string[] = []
  for (const link of links) {
    if (link.toDeviceId !== deviceId) continue
    if (link.fromDeviceId === deviceId) continue
    if (!managedIds.has(link.fromDeviceId)) continue

    const reverse = links.some(
      (candidate) =>
        candidate.fromDeviceId === deviceId &&
        candidate.toDeviceId === link.fromDeviceId
    )
    if (reverse) {
      const parentOut = countOutgoing(link.fromDeviceId, links)
      const childOut = countOutgoing(deviceId, links)
      if (parentOut < childOut) continue
      if (parentOut === childOut && link.fromDeviceId > deviceId) continue
    }

    parents.push(link.fromDeviceId)
  }

  return uniqueIds(parents)
}
