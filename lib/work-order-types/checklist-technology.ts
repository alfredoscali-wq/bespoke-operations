import type { WorkOrderTechnology } from "@/lib/tasks/work-order"

/** Scope used when configuring/resolving operational checklists. */
export type ChecklistTechnologyScope = WorkOrderTechnology | "todas"

export const CHECKLIST_TECHNOLOGY_SCOPE_OPTIONS: {
  value: ChecklistTechnologyScope
  label: string
}[] = [
  { value: "todas", label: "Todas (fallback)" },
  { value: "fiber", label: "Fibra Óptica" },
  { value: "wireless", label: "Wireless" },
]

export const DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE: ChecklistTechnologyScope =
  "todas"

export function isChecklistTechnologyScope(
  value: unknown
): value is ChecklistTechnologyScope {
  return value === "fiber" || value === "wireless" || value === "todas"
}

export function normalizeChecklistTechnologyScope(
  value: unknown
): ChecklistTechnologyScope {
  return isChecklistTechnologyScope(value)
    ? value
    : DEFAULT_CHECKLIST_TECHNOLOGY_SCOPE
}

/**
 * Preferred tech for checklist lookup on a task.
 * Empty/unknown → null (use "todas" fallback only).
 */
export function resolvePreferredChecklistTechnology(
  technology: WorkOrderTechnology | "" | null | undefined
): WorkOrderTechnology | null {
  if (technology === "fiber" || technology === "wireless") {
    return technology
  }
  return null
}

/**
 * Cascade: exact technology items → "todas" items → empty.
 */
export function selectChecklistItemsForTechnologyCascade<
  T extends { technology?: ChecklistTechnologyScope | string },
>(
  items: T[],
  technology: WorkOrderTechnology | "" | null | undefined
): T[] {
  const preferred = resolvePreferredChecklistTechnology(technology)

  if (preferred) {
    const specific = items.filter((item) => item.technology === preferred)
    if (specific.length > 0) {
      return specific
    }
  }

  return items.filter(
    (item) =>
      item.technology === "todas" ||
      item.technology == null ||
      item.technology === ""
  )
}
