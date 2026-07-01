import type { SystemRole } from "@/lib/types/employees"

export function canEditWorkOrderTypeChecklist(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador" || role === "supervisor"
}

export function canViewWorkOrderTypeChecklist(
  role: SystemRole | null | undefined
): boolean {
  return canEditWorkOrderTypeChecklist(role)
}
