export type PlanningPendingClosureSheetViewPhase =
  | "LIST"
  | "LOADING"
  | "ERROR"
  | "DETAIL"

export function normalizePlanningPendingClosureSelectionId(
  taskId: string | null | undefined
): string | null {
  if (typeof taskId !== "string") {
    return null
  }

  const trimmed = taskId.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolvePlanningPendingClosureSheetViewPhase(input: {
  selectedTaskId: string | null
  detailLoading: boolean
  detailError: string | null
  hasSelectedTask: boolean
  hasSelectedDetail: boolean
}): PlanningPendingClosureSheetViewPhase {
  if (!input.selectedTaskId) {
    return "LIST"
  }

  if (input.detailLoading) {
    return "LOADING"
  }

  if (input.detailError) {
    return "ERROR"
  }

  if (input.hasSelectedTask && input.hasSelectedDetail) {
    return "DETAIL"
  }

  return "ERROR"
}

export function shouldClearPlanningPendingClosureSelectionOnSheetClose(
  open: boolean
): boolean {
  return !open
}
