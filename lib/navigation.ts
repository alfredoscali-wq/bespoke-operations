export type { NavGroup, NavItem } from "@/lib/navigation/nav-types"

export {
  analysisNavItems,
  availabilityNavItem,
  calendarNavItem,
  coreOperationsNavItems,
  crewsNavItem,
  customersNavItem,
  customersNavItems,
  dashboardNavItem,
  dispositivosNavItem,
  employeesNavItem,
  evidenceNavItem,
  fieldOperationsNavItems,
  historyNavItem,
  maintenanceNavItem,
  materialsNavItem,
  newsNavItem,
  projectsNavItem,
  reportsNavItem,
  rrhhDashboardNavItem,
  rrhhNavItems,
  settingsNavItem,
  systemNavItems,
  usersNavItem,
  workOrdersNavItem,
} from "@/lib/navigation/nav-items"

import type { NavGroup, NavItem } from "@/lib/navigation/nav-types"
import {
  analysisNavItems,
  coreOperationsNavItems,
  customersNavItems,
  dashboardNavItem,
  fieldOperationsNavItems,
  rrhhNavItems,
  systemNavItems,
  usersNavItem,
} from "@/lib/navigation/nav-items"

/** @deprecated Use coreOperationsNavItems + fieldOperationsNavItems. */
export const operationsNavItems: NavItem[] = [
  ...coreOperationsNavItems,
  ...fieldOperationsNavItems,
]

export const navGroups: NavGroup[] = [
  { id: "dashboard", items: [dashboardNavItem] },
  { id: "operations", label: "Operaciones", items: coreOperationsNavItems },
  { id: "customers", label: "Clientes", items: customersNavItems },
  {
    id: "field",
    label: "Operaciones de campo",
    items: fieldOperationsNavItems,
  },
  { id: "analysis", label: "Análisis", items: analysisNavItems },
  { id: "rrhh", label: "RRHH", items: rrhhNavItems },
  { id: "system", label: "Sistema", items: systemNavItems },
]

/** @deprecated Use navGroups. Kept for compatibility. */
export const mainNavItems: NavItem[] = [dashboardNavItem]

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  usersNavItem,
]
