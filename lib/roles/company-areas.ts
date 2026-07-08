import type { SystemRole } from "@/lib/types/employees"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"

export const FIXED_COMPANY_AREA_CODES = [
  "administrador",
  "administracion",
  "atencion_cliente",
  "ventas",
  "rrhh",
  "tecnica",
  "operario",
] as const

export type FixedCompanyAreaCode = (typeof FIXED_COMPANY_AREA_CODES)[number]

export const LEGACY_COMPANY_ROLE_CODES = ["supervisor", "administrativo"] as const

export type LegacyCompanyRoleCode = (typeof LEGACY_COMPANY_ROLE_CODES)[number]

export const ALLOWS_CUSTOM_COMPANY_ROLE_CREATION = false

export const COMPANY_AREA_LABELS: Record<FixedCompanyAreaCode, string> = {
  administrador: "Administrador",
  administracion: "Administración",
  atencion_cliente: "Atención al Cliente",
  ventas: "Ventas",
  rrhh: "RRHH",
  tecnica: "Técnica",
  operario: "Operario",
}

export const COMPANY_AREA_SORT_ORDER: Record<FixedCompanyAreaCode, number> = {
  administrador: 1,
  administracion: 2,
  atencion_cliente: 3,
  ventas: 4,
  rrhh: 5,
  tecnica: 6,
  operario: 7,
}

export const LEGACY_ROLE_CODE_TO_AREA_CODE: Record<
  LegacyCompanyRoleCode | FixedCompanyAreaCode,
  FixedCompanyAreaCode
> = {
  administrador: "administrador",
  administracion: "administracion",
  atencion_cliente: "atencion_cliente",
  ventas: "ventas",
  rrhh: "rrhh",
  tecnica: "tecnica",
  operario: "operario",
  supervisor: "tecnica",
  administrativo: "administracion",
}

const ADMINISTRACION_DEFAULT_VISIBILITY: ModuleVisibilityMap = {
  dashboard: false,
  calendar: true,
  projects: true,
  work_orders: true,
  planificacion: false,
  customers: true,
  crews: false,
  materials: false,
  evidence: false,
  reports: true,
  employees: false,
  news: false,
  settings: false,
  history: false,
  users: false,
  dispositivos: false,
  maintenance: false,
}

const ATENCION_CLIENTE_DEFAULT_VISIBILITY: ModuleVisibilityMap = {
  dashboard: false,
  calendar: true,
  projects: false,
  work_orders: true,
  planificacion: false,
  customers: true,
  crews: false,
  materials: false,
  evidence: false,
  reports: false,
  employees: false,
  news: false,
  settings: false,
  history: false,
  users: false,
  dispositivos: false,
  maintenance: false,
}

const VENTAS_DEFAULT_VISIBILITY: ModuleVisibilityMap = {
  dashboard: false,
  calendar: true,
  projects: false,
  work_orders: true,
  planificacion: false,
  customers: true,
  crews: false,
  materials: false,
  evidence: false,
  reports: true,
  employees: false,
  news: false,
  settings: false,
  history: false,
  users: false,
  dispositivos: false,
  maintenance: false,
}

const RRHH_DEFAULT_VISIBILITY: ModuleVisibilityMap = {
  dashboard: true,
  calendar: false,
  projects: false,
  work_orders: false,
  planificacion: false,
  customers: false,
  crews: true,
  materials: false,
  evidence: false,
  reports: false,
  employees: true,
  news: true,
  settings: false,
  history: false,
  users: true,
  dispositivos: false,
  maintenance: false,
}

const TECNICA_DEFAULT_VISIBILITY: ModuleVisibilityMap = {
  dashboard: false,
  calendar: true,
  projects: true,
  work_orders: true,
  planificacion: true,
  customers: true,
  crews: false,
  materials: false,
  evidence: false,
  reports: true,
  employees: false,
  news: false,
  settings: true,
  history: false,
  users: false,
  dispositivos: false,
  maintenance: false,
}

export const DEFAULT_COMPANY_AREA_MODULE_VISIBILITY: Record<
  FixedCompanyAreaCode,
  ModuleVisibilityMap
> = {
  administrador: createFullModuleVisibility(),
  administracion: ADMINISTRACION_DEFAULT_VISIBILITY,
  atencion_cliente: ATENCION_CLIENTE_DEFAULT_VISIBILITY,
  ventas: VENTAS_DEFAULT_VISIBILITY,
  rrhh: RRHH_DEFAULT_VISIBILITY,
  tecnica: TECNICA_DEFAULT_VISIBILITY,
  operario: createEmptyModuleVisibility(),
}

export function isFixedCompanyAreaCode(
  code: string
): code is FixedCompanyAreaCode {
  return FIXED_COMPANY_AREA_CODES.includes(code as FixedCompanyAreaCode)
}

export function resolveFixedAreaCode(code: string): FixedCompanyAreaCode | null {
  if (isFixedCompanyAreaCode(code)) {
    return code
  }

  if (code in LEGACY_ROLE_CODE_TO_AREA_CODE) {
    return LEGACY_ROLE_CODE_TO_AREA_CODE[
      code as LegacyCompanyRoleCode | FixedCompanyAreaCode
    ]
  }

  return null
}

export function mapAreaCodeToSystemRole(code: string): SystemRole {
  switch (code) {
    case "administrador":
    case "demo":
      return "administrador"
    case "tecnica":
    case "supervisor":
      return "supervisor"
    case "operario":
      return "operario"
    case "administracion":
    case "atencion_cliente":
    case "ventas":
    case "rrhh":
    case "administrativo":
      return "administrativo"
    default:
      return "administrativo"
  }
}

export function resolveDefaultAreaCodeForSystemRole(
  systemRole: SystemRole
): FixedCompanyAreaCode {
  switch (systemRole) {
    case "administrador":
    case "demo":
      return "administrador"
    case "supervisor":
      return "tecnica"
    case "operario":
      return "operario"
    case "administrativo":
    default:
      return "administracion"
  }
}

export function listFixedCompanyAreas<
  TRole extends { code: string; sortOrder?: number },
>(roles: TRole[]): TRole[] {
  return roles
    .filter((role) => isFixedCompanyAreaCode(role.code))
    .sort(
      (left, right) =>
        COMPANY_AREA_SORT_ORDER[left.code as FixedCompanyAreaCode] -
        COMPANY_AREA_SORT_ORDER[right.code as FixedCompanyAreaCode]
    )
}

export function isCustomCompanyRole(role: {
  code: string
  isSystem?: boolean
}): boolean {
  return !isFixedCompanyAreaCode(role.code)
}
