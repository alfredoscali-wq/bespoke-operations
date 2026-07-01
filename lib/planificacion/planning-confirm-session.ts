export type PlanningConfirmSnapshot = {
  date: string
  confirmedAt: string
  confirmedBy: string
}

const PLANNING_CONFIRM_SESSION_KEY = "bespoke.planning.confirmations"

function isValidDateInput(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function readAllConfirmSnapshots(): Record<string, PlanningConfirmSnapshot> {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = window.sessionStorage.getItem(PLANNING_CONFIRM_SESSION_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, PlanningConfirmSnapshot> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (!isValidDateInput(key) || typeof value !== "object" || value == null) {
        continue
      }

      const snapshot = value as Partial<PlanningConfirmSnapshot>
      if (
        !isValidDateInput(snapshot.date) ||
        typeof snapshot.confirmedAt !== "string" ||
        typeof snapshot.confirmedBy !== "string"
      ) {
        continue
      }

      result[key] = {
        date: snapshot.date,
        confirmedAt: snapshot.confirmedAt,
        confirmedBy: snapshot.confirmedBy,
      }
    }

    return result
  } catch {
    return {}
  }
}

function writeAllConfirmSnapshots(
  snapshots: Record<string, PlanningConfirmSnapshot>
): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(
      PLANNING_CONFIRM_SESSION_KEY,
      JSON.stringify(snapshots)
    )
  } catch {
    // Ignore quota or privacy mode errors.
  }
}

export function readPlanningConfirmSnapshot(
  date: string
): PlanningConfirmSnapshot | null {
  if (!isValidDateInput(date)) {
    return null
  }

  return readAllConfirmSnapshots()[date] ?? null
}

export function writePlanningConfirmSnapshot(
  snapshot: PlanningConfirmSnapshot
): void {
  if (!isValidDateInput(snapshot.date)) {
    return
  }

  const all = readAllConfirmSnapshots()
  all[snapshot.date] = snapshot
  writeAllConfirmSnapshots(all)
}

export function clearPlanningConfirmSnapshot(date: string): void {
  if (!isValidDateInput(date)) {
    return
  }

  const all = readAllConfirmSnapshots()
  delete all[date]
  writeAllConfirmSnapshots(all)
}

export function formatPlanningConfirmDateTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) {
    return "—"
  }

  return parsed.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
