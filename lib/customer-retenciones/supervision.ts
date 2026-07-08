import type { CustomerRetencionSupervisionRow } from "@/lib/types/customer-retenciones"

export type AssignedRetencionFilter = "todas" | "pendientes" | "finalizadas"

export function filterAssignedRetenciones(
  rows: CustomerRetencionSupervisionRow[],
  filter: AssignedRetencionFilter
): CustomerRetencionSupervisionRow[] {
  switch (filter) {
    case "pendientes":
      return rows.filter((row) => row.status === "pendiente")
    case "finalizadas":
      return rows.filter((row) => row.status === "finalizada")
    default:
      return rows
  }
}

export function sortAssignedRetencionesByCreatedAtDesc(
  rows: CustomerRetencionSupervisionRow[]
): CustomerRetencionSupervisionRow[] {
  return [...rows].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

export function applyAssignedRetencionSupervisionView(
  rows: CustomerRetencionSupervisionRow[],
  filter: AssignedRetencionFilter
): CustomerRetencionSupervisionRow[] {
  return sortAssignedRetencionesByCreatedAtDesc(
    filterAssignedRetenciones(rows, filter)
  )
}
