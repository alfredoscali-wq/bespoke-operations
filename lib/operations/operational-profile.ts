import type { SystemRole } from "@/lib/types/employees"

/** Perfil operativo derivado del rol de sistema del usuario autenticado. */
export type OperationalProfile =
  | "administrador"
  | "supervisor"
  | "administracion_operativa"
  | "ventas"
  | "rrhh"
  | "operario"
  | "demo"

export type DashboardSectionId =
  | "executive-summary"
  | "operational-alerts"
  | "day-operations"
  | "projects-status"
  | "tasks-status"
  | "crews-status"
  | "recent-activity"
  | "rrhh-summary"

export const OPERATIONAL_PROFILE_LABELS: Record<OperationalProfile, string> = {
  administrador: "Administrador del Sistema",
  supervisor: "Supervisor de Operaciones",
  administracion_operativa: "Administración Operativa",
  ventas: "Ventas",
  rrhh: "RRHH",
  operario: "Operario de Campo",
  demo: "Demostración Comercial",
}

/** Ruta de inicio de jornada por perfil operativo. */
export const PROFILE_HOME_PATH: Record<OperationalProfile, string> = {
  administrador: "/",
  supervisor: "/operations/calendar",
  administracion_operativa: "/operations/calendar",
  ventas: "/operations/calendar",
  rrhh: "/",
  operario: "/operario",
  demo: "/",
}

export const OPERATIONAL_PROFILE_DASHBOARD_TITLE: Record<
  Exclude<OperationalProfile, "operario">,
  string
> = {
  administrador: "Dashboard Operativo",
  supervisor: "Dashboard Operativo",
  administracion_operativa: "Dashboard Operativo",
  ventas: "Dashboard Operativo",
  rrhh: "Dashboard RRHH",
  demo: "Dashboard Ejecutivo",
}

export const OPERATIONAL_PROFILE_DASHBOARD_SUBTITLE: Record<
  OperationalProfile,
  string
> = {
  administrador:
    "Resumen operativo del día para coordinación y supervisión.",
  supervisor:
    "OT en curso, pendientes críticos, solicitudes de cierre, incidencias y productividad.",
  administracion_operativa:
    "OT por programar, carga del día, clientes pendientes, cuadrillas y asignaciones.",
  ventas:
    "Calendario operativo, clientes y órdenes de trabajo de instalación.",
  rrhh:
    "Empleados activos, licencias, disponibilidad, ausencias y cuadrillas.",
  operario: "Portal de campo para órdenes de trabajo del día.",
  demo: "Recorrido comercial de Bespoke Operations en modo consulta.",
}

export const PROFILE_DASHBOARD_SECTIONS: Record<
  OperationalProfile,
  DashboardSectionId[]
> = {
  administrador: [
    "executive-summary",
    "operational-alerts",
    "day-operations",
    "projects-status",
    "tasks-status",
    "crews-status",
    "recent-activity",
  ],
  supervisor: [],
  administracion_operativa: [],
  ventas: [],
  rrhh: ["rrhh-summary"],
  operario: [],
  demo: [
    "executive-summary",
    "operational-alerts",
    "day-operations",
    "projects-status",
    "tasks-status",
    "crews-status",
    "recent-activity",
  ],
}

const BACKOFFICE_PROFILES: OperationalProfile[] = [
  "administrador",
  "supervisor",
  "administracion_operativa",
  "ventas",
  "rrhh",
  "demo",
]

export function isBackofficeOperationalProfile(
  profile: OperationalProfile
): profile is Exclude<OperationalProfile, "operario"> {
  return BACKOFFICE_PROFILES.includes(profile)
}

export function getProfileHomePath(profile: OperationalProfile): string {
  return PROFILE_HOME_PATH[profile]
}

export function profileUsesOperationalDashboard(
  profile: OperationalProfile
): boolean {
  return profile === "administrador" || profile === "demo"
}

export function profileUsesRrhhDashboard(profile: OperationalProfile): boolean {
  return profile === "rrhh"
}

export function profileShowsDashboardInSidebar(
  profile: OperationalProfile
): boolean {
  return profileUsesOperationalDashboard(profile) || profileUsesRrhhDashboard(profile)
}

/** Mapeo desde rol de sistema → perfil operativo (sidebar, dashboard y navegación). */
export function mapSystemRoleToOperationalProfile(
  systemRole: SystemRole | null | undefined
): OperationalProfile {
  switch (systemRole) {
    case "administrador":
      return "administrador"
    case "supervisor":
      return "supervisor"
    case "administrativo":
      return "administracion_operativa"
    case "operario":
      return "operario"
    case "demo":
      return "demo"
    default:
      return "administracion_operativa"
  }
}

export function profileShowsDashboardSection(
  profile: OperationalProfile,
  section: DashboardSectionId
): boolean {
  return PROFILE_DASHBOARD_SECTIONS[profile].includes(section)
}
