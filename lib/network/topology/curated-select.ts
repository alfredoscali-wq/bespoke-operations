import type {
  CuratedTopologyForest,
  CuratedTopologyNode,
} from "@/lib/network/topology/types"

function walkNodes(
  nodes: readonly CuratedTopologyNode[],
  visit: (node: CuratedTopologyNode) => void
) {
  for (const node of nodes) {
    visit(node)
    walkNodes(node.children, visit)
  }
}

export function collectCuratedDeviceIds(
  forest: CuratedTopologyForest | null | undefined
): Set<string> {
  const ids = new Set<string>()
  walkNodes(forest?.roots ?? [], (node) => ids.add(node.deviceId))
  return ids
}

export function findCuratedNodeByDeviceId(
  forest: CuratedTopologyForest | null | undefined,
  deviceId: string
): CuratedTopologyNode | null {
  const stack = [...(forest?.roots ?? [])]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (node.deviceId === deviceId) return node
    stack.push(...node.children)
  }
  return null
}

/**
 * View of the curated forest for the Topology Core selector.
 * Does not rebuild hierarchy from Discovery.
 */
export function selectCuratedForestForCore(
  forest: CuratedTopologyForest | null | undefined,
  selectedCoreId: string | null | undefined
): CuratedTopologyForest {
  const roots = forest?.roots ?? []
  if (!selectedCoreId) {
    return { roots }
  }

  const root = roots.find((node) => node.deviceId === selectedCoreId)
  if (!root) {
    return { roots: [] }
  }

  return { roots: [root] }
}
