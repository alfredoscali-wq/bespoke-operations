import type { SystemRole } from "@/lib/types/employees"

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  administrativo: "Administrativo",
  operario: "Operario",
}

export function formatSystemRole(role: SystemRole): string {
  return SYSTEM_ROLE_LABELS[role]
}
