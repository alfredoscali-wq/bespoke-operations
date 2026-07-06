export type PlanningIncidentSheetViewPhase =
  | "LIST"
  | "LOADING"
  | "ERROR"
  | "DETAIL"

export function normalizePlanningIncidentSelectionId(
  incidentId: string | null | undefined
): string | null {
  if (typeof incidentId !== "string") {
    return null
  }

  const trimmed = incidentId.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolvePlanningIncidentSheetViewPhase(input: {
  selectedIncidentId: string | null
  detailLoading: boolean
  detailError: string | null
  hasSelectedIncident: boolean
}): PlanningIncidentSheetViewPhase {
  if (!input.selectedIncidentId) {
    return "LIST"
  }

  if (input.detailLoading) {
    return "LOADING"
  }

  if (input.detailError) {
    return "ERROR"
  }

  if (input.hasSelectedIncident) {
    return "DETAIL"
  }

  return "ERROR"
}

export function shouldClearPlanningIncidentSelectionOnSheetClose(
  open: boolean
): boolean {
  return !open
}
