import type { SystemRole } from "@/lib/types/employees"

export function canCloseWorkOrder(
  role: SystemRole | null | undefined
): boolean {
  return role === "administrador" || role === "supervisor"
}
