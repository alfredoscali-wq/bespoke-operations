import type { SystemRole } from "@/lib/types/employees"

export function canCloseWorkOrder(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador" || role === "supervisor"
}

export function canAssignWorkOrderCrew(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador" || role === "supervisor"
}
