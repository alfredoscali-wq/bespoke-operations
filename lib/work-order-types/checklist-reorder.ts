import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"

export type ChecklistSortOrderUpdate = {
  id: string
  sortOrder: number | null
}

export function buildChecklistReorderUpdates(
  items: WorkOrderTypeChecklistItem[],
  orderedIds: string[]
): ChecklistSortOrderUpdate[] {
  const idSet = new Set(items.map((item) => item.id))
  const validOrderedIds = orderedIds.filter((id) => idSet.has(id))

  if (validOrderedIds.length !== items.length) {
    return []
  }

  const updates: ChecklistSortOrderUpdate[] = []

  validOrderedIds.forEach((id, index) => {
    const nextOrder = index + 1
    const item = items.find((entry) => entry.id === id)
    if (item && item.sortOrder !== nextOrder) {
      updates.push({ id, sortOrder: nextOrder })
    }
  })

  if (updates.length === 0) {
    return []
  }

  return [
    ...updates.map((update) => ({ id: update.id, sortOrder: null })),
    ...validOrderedIds.map((id, index) => ({ id, sortOrder: index + 1 })),
  ]
}

export function reorderChecklistItemsById(
  items: WorkOrderTypeChecklistItem[],
  draggedId: string,
  targetId: string
): WorkOrderTypeChecklistItem[] {
  const sorted = [...items].sort((left, right) => left.sortOrder - right.sortOrder)
  const fromIndex = sorted.findIndex((item) => item.id === draggedId)
  const toIndex = sorted.findIndex((item) => item.id === targetId)

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return sorted
  }

  const reordered = [...sorted]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  return reordered.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }))
}
