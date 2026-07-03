const PLANNING_FILTERS_SESSION_KEY = "bespoke.planning.filters"

type PlanningFiltersSession = {
  date: string
  crewFilterId?: string | null
}

function isValidDateInput(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function resolveLocalTodayDateInputValue(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function readPlanningFiltersFromSession(): PlanningFiltersSession | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(PLANNING_FILTERS_SESSION_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<{
      date: unknown
      crewFilterId: unknown
    }>
    if (!isValidDateInput(parsed.date)) {
      return null
    }

    const crewFilterId =
      typeof parsed.crewFilterId === "string" && parsed.crewFilterId.trim()
        ? parsed.crewFilterId.trim()
        : null

    return {
      date: parsed.date,
      crewFilterId,
    }
  } catch {
    return null
  }
}

export function writePlanningFiltersToSession(
  filters: PlanningFiltersSession
): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(
      PLANNING_FILTERS_SESSION_KEY,
      JSON.stringify(filters)
    )
  } catch {
    // Ignore quota or privacy mode errors.
  }
}

export function resolveInitialPlanningFilters(): PlanningFiltersSession {
  const stored = readPlanningFiltersFromSession()
  if (stored) {
    return stored
  }

  return {
    date: resolveLocalTodayDateInputValue(),
    crewFilterId: null,
  }
}
