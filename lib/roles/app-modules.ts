import {
  calendarNavItem,
  crewsNavItem,
  customersNavItem,
  dashboardNavItem,
  dispositivosNavItem,
  employeesNavItem,
  evidenceNavItem,
  historyNavItem,
  maintenanceNavItem,
  materialsNavItem,
  newsNavItem,
  planificacionNavItem,
  projectsNavItem,
  reportsNavItem,
  settingsNavItem,
  usersNavItem,
  workOrdersNavItem,
} from "@/lib/navigation/nav-items"
import type { NavItem } from "@/lib/navigation/nav-types"

export const APP_MODULE_KEYS = [
  "dashboard",
  "calendar",
  "projects",
  "work_orders",
  "planificacion",
  "customers",
  "crews",
  "materials",
  "evidence",
  "reports",
  "employees",
  "news",
  "settings",
  "history",
  "users",
  "dispositivos",
  "maintenance",
] as const

export type AppModuleKey = (typeof APP_MODULE_KEYS)[number]

export type ModuleVisibilityMap = Record<AppModuleKey, boolean>

export type AppModuleDefinition = {
  key: AppModuleKey
  label: string
  navItem: NavItem
  groupId: "operations" | "analysis" | "rrhh" | "system" | "administration"
  groupLabel?: string
  pathPrefixes: string[]
}

export const APP_MODULE_DEFINITIONS: AppModuleDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    navItem: dashboardNavItem,
    groupId: "operations",
    pathPrefixes: ["/"],
  },
  {
    key: "calendar",
    label: "Calendario Operativo",
    navItem: calendarNavItem,
    groupId: "operations",
    pathPrefixes: ["/operations/calendar"],
  },
  {
    key: "projects",
    label: "Obras",
    navItem: projectsNavItem,
    groupId: "operations",
    pathPrefixes: ["/obras"],
  },
  {
    key: "work_orders",
    label: "Órdenes de Trabajo",
    navItem: workOrdersNavItem,
    groupId: "operations",
    pathPrefixes: ["/tareas", "/operations/archivo-ot"],
  },
  {
    key: "planificacion",
    label: "Planificación Operativa",
    navItem: planificacionNavItem,
    groupId: "operations",
    pathPrefixes: ["/operations/planificacion"],
  },
  {
    key: "customers",
    label: "Clientes",
    navItem: customersNavItem,
    groupId: "operations",
    pathPrefixes: ["/clientes"],
  },
  {
    key: "crews",
    label: "Cuadrillas",
    navItem: crewsNavItem,
    groupId: "operations",
    pathPrefixes: ["/cuadrillas"],
  },
  {
    key: "materials",
    label: "Materiales",
    navItem: materialsNavItem,
    groupId: "operations",
    pathPrefixes: ["/materiales"],
  },
  {
    key: "evidence",
    label: "Evidencias",
    navItem: evidenceNavItem,
    groupId: "operations",
    pathPrefixes: ["/evidencias"],
  },
  {
    key: "reports",
    label: "Reportes",
    navItem: reportsNavItem,
    groupId: "analysis",
    groupLabel: "Análisis",
    pathPrefixes: ["/reportes"],
  },
  {
    key: "employees",
    label: "Empleados",
    navItem: employeesNavItem,
    groupId: "rrhh",
    groupLabel: "RRHH",
    pathPrefixes: ["/rrhh"],
  },
  {
    key: "news",
    label: "Novedades",
    navItem: newsNavItem,
    groupId: "rrhh",
    groupLabel: "RRHH",
    pathPrefixes: ["/novedades"],
  },
  {
    key: "settings",
    label: "Configuración",
    navItem: settingsNavItem,
    groupId: "system",
    groupLabel: "Sistema",
    pathPrefixes: ["/configuracion"],
  },
  {
    key: "history",
    label: "Log del Sistema",
    navItem: historyNavItem,
    groupId: "system",
    groupLabel: "Sistema",
    pathPrefixes: ["/historial"],
  },
  {
    key: "users",
    label: "Usuarios",
    navItem: usersNavItem,
    groupId: "system",
    groupLabel: "Sistema",
    pathPrefixes: ["/usuarios"],
  },
  {
    key: "dispositivos",
    label: "Dispositivos",
    navItem: dispositivosNavItem,
    groupId: "system",
    groupLabel: "Sistema",
    pathPrefixes: ["/dispositivos"],
  },
  {
    key: "maintenance",
    label: "Mantenimiento",
    navItem: maintenanceNavItem,
    groupId: "administration",
    groupLabel: "Administración",
    pathPrefixes: ["/mantenimiento"],
  },
]

export const APP_MODULE_DEFINITION_MAP = Object.fromEntries(
  APP_MODULE_DEFINITIONS.map((definition) => [definition.key, definition])
) as Record<AppModuleKey, AppModuleDefinition>

export const APP_MODULE_LABELS = Object.fromEntries(
  APP_MODULE_DEFINITIONS.map((definition) => [definition.key, definition.label])
) as Record<AppModuleKey, string>

export function createEmptyModuleVisibility(): ModuleVisibilityMap {
  return Object.fromEntries(
    APP_MODULE_KEYS.map((key) => [key, false])
  ) as ModuleVisibilityMap
}

export function createFullModuleVisibility(): ModuleVisibilityMap {
  return Object.fromEntries(
    APP_MODULE_KEYS.map((key) => [key, true])
  ) as ModuleVisibilityMap
}

export function normalizeModuleVisibility(
  input: Partial<ModuleVisibilityMap> | null | undefined
): ModuleVisibilityMap {
  const base = createEmptyModuleVisibility()

  if (!input) {
    return base
  }

  for (const key of APP_MODULE_KEYS) {
    if (typeof input[key] === "boolean") {
      base[key] = input[key]
    }
  }

  return base
}

export function getVisibleModuleKeys(
  visibility: ModuleVisibilityMap
): AppModuleKey[] {
  return APP_MODULE_KEYS.filter((key) => visibility[key])
}

export function resolveModuleKeyFromPathname(
  pathname: string
): AppModuleKey | null {
  if (pathname === "/perfil" || pathname.startsWith("/perfil/")) {
    return null
  }

  const matches = APP_MODULE_DEFINITIONS.filter((definition) =>
    definition.pathPrefixes.some((prefix) => {
      if (prefix === "/") {
        return pathname === "/"
      }

      return pathname === prefix || pathname.startsWith(`${prefix}/`)
    })
  ).sort(
    (left, right) =>
      Math.max(...right.pathPrefixes.map((prefix) => prefix.length)) -
      Math.max(...left.pathPrefixes.map((prefix) => prefix.length))
  )

  return matches[0]?.key ?? null
}

export function canAccessPathWithModules(
  pathname: string,
  visibility: ModuleVisibilityMap
): boolean {
  const moduleKey = resolveModuleKeyFromPathname(pathname)

  if (!moduleKey) {
    return true
  }

  return visibility[moduleKey]
}
