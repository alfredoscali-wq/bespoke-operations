export type NetworkAlarmLink = {
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

function countOutgoing(deviceId: string, links: readonly NetworkAlarmLink[]): number {
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
  links: readonly NetworkAlarmLink[]
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

export function listManagedAncestorIds(
  deviceId: string,
  managedIds: ReadonlySet<string>,
  links: readonly NetworkAlarmLink[]
): string[] {
  const ancestors: string[] = []
  const visited = new Set<string>([deviceId])
  const queue = listManagedParentIds(deviceId, managedIds, links)

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)
    ancestors.push(current)
    queue.push(...listManagedParentIds(current, managedIds, links))
  }

  return ancestors
}

export function listManagedDescendantIds(
  deviceId: string,
  managedIds: ReadonlySet<string>,
  links: readonly NetworkAlarmLink[]
): string[] {
  const descendants: string[] = []
  const visited = new Set<string>([deviceId])
  const queue: string[] = []

  for (const id of managedIds) {
    if (id === deviceId) continue
    if (listManagedParentIds(id, managedIds, links).includes(deviceId)) {
      queue.push(id)
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)
    descendants.push(current)
    for (const id of managedIds) {
      if (visited.has(id)) continue
      if (listManagedParentIds(id, managedIds, links).includes(current)) {
        queue.push(id)
      }
    }
  }

  return descendants
}
