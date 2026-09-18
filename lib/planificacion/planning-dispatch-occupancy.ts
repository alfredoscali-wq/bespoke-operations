export type PlanningConfirmDispatchOccupancyScope = {
  dueDate: string
  crewId: string
}

export type PlanningConfirmDispatchOccupancyRow = {
  id?: string
  companyId?: string | null
  dueDate: string
  crewId?: string | null
  dispatchOrder?: number | null
  deletedAt?: string | null
  status?: string
}

export function planningConfirmDispatchOccupancyKey(
  dueDate: string,
  crewId: string
): string {
  return `${dueDate}::${crewId}`
}

/**
 * Occupancy predicate aligned with tasks_dispatch_order_crew_date_unique
 * plus tenant filter used by the confirm query.
 * Status is intentionally ignored.
 */
export function matchesPlanningConfirmDispatchOccupancyQuery(
  row: PlanningConfirmDispatchOccupancyRow,
  companyId: string,
  dueDate: string,
  crewId: string
): boolean {
  if (row.deletedAt) {
    return false
  }

  if (row.dispatchOrder == null || row.dispatchOrder <= 0) {
    return false
  }

  if (!row.crewId?.trim()) {
    return false
  }

  if (row.dueDate !== dueDate || row.crewId !== crewId) {
    return false
  }

  if (companyId && row.companyId && row.companyId !== companyId) {
    return false
  }

  return true
}

export function collectPlanningConfirmOccupiedDispatchOrders(
  rows: PlanningConfirmDispatchOccupancyRow[],
  companyId: string,
  dueDate: string,
  crewId: string
): Set<number> {
  const occupied = new Set<number>()

  for (const row of rows) {
    if (
      !matchesPlanningConfirmDispatchOccupancyQuery(
        row,
        companyId,
        dueDate,
        crewId
      )
    ) {
      continue
    }

    occupied.add(Math.floor(row.dispatchOrder as number))
  }

  return occupied
}

export function mergeOccupiedDispatchOrders(
  occupied: Set<number>,
  extra: Iterable<number> | undefined
): Set<number> {
  if (!extra) {
    return occupied
  }

  for (const order of extra) {
    if (order != null && order > 0) {
      occupied.add(Math.floor(order))
    }
  }

  return occupied
}

export function occupiedDispatchOrdersForScope(
  occupancyByScope:
    | Record<string, readonly number[]>
    | undefined,
  dueDate: string,
  crewId: string
): number[] {
  if (!occupancyByScope) {
    return []
  }

  return [
    ...(occupancyByScope[planningConfirmDispatchOccupancyKey(dueDate, crewId)] ??
      []),
  ]
}
