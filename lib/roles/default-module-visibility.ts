import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"

export const SYSTEM_ROLE_CODES = [
  "administrador",
  "supervisor",
  "administrativo",
  "rrhh",
  "operario",
] as const

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number]

export const SYSTEM_ROLE_NAMES: Record<SystemRoleCode, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  administrativo: "Administrativo",
  rrhh: "RRHH",
  operario: "Operario",
}

export const DEFAULT_MODULE_VISIBILITY_BY_ROLE: Record<
  SystemRoleCode,
  ModuleVisibilityMap
> = {
  administrador: createFullModuleVisibility(),
  supervisor: {
    ...createEmptyModuleVisibility(),
    calendar: true,
    projects: true,
    work_orders: true,
    planificacion: true,
    customers: true,
    reports: true,
    settings: true,
  },
  administrativo: {
    ...createEmptyModuleVisibility(),
    calendar: true,
    projects: true,
    work_orders: true,
    customers: true,
    reports: true,
  },
  rrhh: {
    ...createEmptyModuleVisibility(),
    dashboard: true,
    employees: true,
    crews: true,
    news: true,
    users: true,
  },
  operario: createEmptyModuleVisibility(),
}

export function resolveDefaultModuleVisibilityForRoleCode(
  code: string
): ModuleVisibilityMap {
  if (code in DEFAULT_MODULE_VISIBILITY_BY_ROLE) {
    return {
      ...DEFAULT_MODULE_VISIBILITY_BY_ROLE[code as SystemRoleCode],
    }
  }

  return createEmptyModuleVisibility()
}
