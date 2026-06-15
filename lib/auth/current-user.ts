export type AppUserRole =
  | "administrador"
  | "coordinador"
  | "supervisor"
  | "operario"

export type AppUser = {
  id: string
  name: string
  initials: string
  role: AppUserRole
  roleLabel: string
}

export const APP_USER_ROLE_LABELS: Record<AppUserRole, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  supervisor: "Supervisor",
  operario: "Operario",
}

/** Simulated dashboard user until Supabase auth + profiles are wired. */
export const DASHBOARD_USER: AppUser = {
  id: "user-maria-gonzalez",
  name: "María González",
  initials: "MG",
  role: "coordinador",
  roleLabel: "Coordinadora de Operaciones",
}

export function formatAppUserRole(role: AppUserRole): string {
  return APP_USER_ROLE_LABELS[role]
}
