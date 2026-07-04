import type { SystemRole } from "@/lib/types/employees"

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  administrativo: "Administrativo",
  operario: "Operario",
  demo: "Demo",
}

export function formatSystemRole(role: SystemRole): string {
  return SYSTEM_ROLE_LABELS[role]
}

const LEGACY_COORDINADOR_LABEL = "Coordinador"

export function formatAppUserRole(role: SystemRole | "coordinador"): string {
  if (role === "coordinador") {
    return LEGACY_COORDINADOR_LABEL
  }

  return formatSystemRole(role)
}
