import type { SystemRole } from "@/lib/types/employees"

export function canEditIncidentTypes(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador" || role === "supervisor"
}

export function canViewIncidentTypes(
  role: SystemRole | null | undefined
): boolean {
  return canEditIncidentTypes(role)
}
