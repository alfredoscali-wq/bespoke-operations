import type { CustomerRetencionSupervisionRow } from "@/lib/types/customer-retenciones"

export type AssignedRetencionFilter =
  | "todas"
  | "pendientes_administracion"
  | "pendientes_retiro"
  | "finalizadas"

export function filterAssignedRetenciones(
  rows: CustomerRetencionSupervisionRow[],
  filter: AssignedRetencionFilter
): CustomerRetencionSupervisionRow[] {
  switch (filter) {
    case "pendientes_administracion":
      return rows.filter((row) => row.status === "pendiente_administracion")
    case "pendientes_retiro":
      return rows.filter((row) => row.status === "pendiente_retiro")
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

export const ACTIVE_CUSTOMER_RETENCION_STATUSES = [
  "en_gestion",
  "pendiente_retiro",
] as const

export function isActiveCustomerRetencionStatus(
  status: CustomerRetencionSupervisionRow["status"]
): boolean {
  return ACTIVE_CUSTOMER_RETENCION_STATUSES.includes(
    status as (typeof ACTIVE_CUSTOMER_RETENCION_STATUSES)[number]
  )
}
