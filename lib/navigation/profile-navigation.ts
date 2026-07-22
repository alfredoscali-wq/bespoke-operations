import {
  OPERATIONAL_PROFILE_DASHBOARD_SUBTITLE,
  OPERATIONAL_PROFILE_DASHBOARD_TITLE,
  profileUsesOperationalDashboard,
  profileUsesRrhhDashboard,
  type OperationalProfile,
} from "@/lib/operations/operational-profile"
import type { NavGroup, NavItem } from "@/lib/navigation/nav-types"
import {
  calendarNavItem,
  crewsNavItem,
  contractorsNavItem,
  customersNavItem,
  dashboardNavItem,
  dispositivosNavItem,
  employeesNavItem,
  evidenceNavItem,
  historyNavItem,
  activityNavItem,
  availabilityNavItem,
  maintenanceNavItem,
  materialsNavItem,
  newsNavItem,
  planificacionNavItem,
  projectsNavItem,
  reportsNavItem,
  rrhhDashboardNavItem,
  rrhhNavItems,
  settingsNavItem,
  usersNavItem,
  workOrderTypesNavItem,
  workOrdersNavItem,
  archivoOtNavItem,
  incidentTypesNavItem,
} from "@/lib/navigation/nav-items"

const PROFILE_NAV_BUILDERS: Record<
  Exclude<OperationalProfile, "operario">,
  () => NavGroup[]
> = {
  administrador: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [
        dashboardNavItem,
        calendarNavItem,
        planificacionNavItem,
        projectsNavItem,
        workOrdersNavItem,
        archivoOtNavItem,
        evidenceNavItem,
        materialsNavItem,
        customersNavItem,
        crewsNavItem,
        contractorsNavItem,
      ],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
    { id: "rrhh", label: "RRHH", items: rrhhNavItems },
    {
      id: "system",
      label: "Sistema",
      items: [
        settingsNavItem,
        historyNavItem,
        activityNavItem,
        usersNavItem,
        dispositivosNavItem,
      ],
    },
    {
      id: "administration",
      label: "Administración",
      items: [maintenanceNavItem],
    },
  ],
  supervisor: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [
        calendarNavItem,
        planificacionNavItem,
        projectsNavItem,
        workOrdersNavItem,
        archivoOtNavItem,
        customersNavItem,
      ],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
    {
      id: "system",
      label: "Sistema",
      items: [settingsNavItem],
    },
  ],
  administracion_operativa: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [
        calendarNavItem,
        customersNavItem,
        workOrdersNavItem,
        archivoOtNavItem,
        projectsNavItem,
      ],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
  ],
  ventas: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [calendarNavItem, customersNavItem, workOrdersNavItem, archivoOtNavItem],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
  ],
  rrhh: () => [
    { id: "dashboard", items: [rrhhDashboardNavItem] },
    {
      id: "rrhh",
      label: "RRHH",
      items: [
        employeesNavItem,
        crewsNavItem,
        availabilityNavItem,
        newsNavItem,
        usersNavItem,
      ],
    },
  ],
  demo: () => [
    { id: "dashboard", items: [dashboardNavItem] },
    {
      id: "operations",
      label: "Operaciones",
      items: [
        calendarNavItem,
        workOrdersNavItem,
        archivoOtNavItem,
        customersNavItem,
        projectsNavItem,
      ],
    },
    {
      id: "rrhh",
      label: "RRHH",
      items: [employeesNavItem, crewsNavItem, availabilityNavItem],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
    { id: "system", label: "Sistema", items: [historyNavItem] },
  ],
}

export function buildNavGroupsForProfile(
  profile: OperationalProfile
): NavGroup[] {
  if (profile === "operario") {
    return []
  }

  return PROFILE_NAV_BUILDERS[profile]()
}

export function getAllNavItemsForProfile(profile: OperationalProfile): NavItem[] {
  const items = buildNavGroupsForProfile(profile).flatMap((group) => group.items)

  if (profile === "administrador" || profile === "supervisor") {
    return [...items, workOrderTypesNavItem, incidentTypesNavItem]
  }

  return items
}

export function getDashboardPageMeta(profile: OperationalProfile): {
  title: string
  subtitle: string
} {
  if (profile === "operario") {
    return {
      title: OPERATIONAL_PROFILE_DASHBOARD_TITLE.administracion_operativa,
      subtitle: OPERATIONAL_PROFILE_DASHBOARD_SUBTITLE.operario,
    }
  }

  if (profileUsesRrhhDashboard(profile)) {
    return {
      title: OPERATIONAL_PROFILE_DASHBOARD_TITLE.rrhh,
      subtitle: OPERATIONAL_PROFILE_DASHBOARD_SUBTITLE.rrhh,
    }
  }

  if (profileUsesOperationalDashboard(profile)) {
    const title =
      profile === "demo"
        ? OPERATIONAL_PROFILE_DASHBOARD_TITLE.demo
        : OPERATIONAL_PROFILE_DASHBOARD_TITLE.administrador
    const subtitle =
      profile === "demo"
        ? OPERATIONAL_PROFILE_DASHBOARD_SUBTITLE.demo
        : OPERATIONAL_PROFILE_DASHBOARD_SUBTITLE.administrador

    return { title, subtitle }
  }

  return {
    title: calendarNavItem.pageTitle ?? calendarNavItem.title,
    subtitle: calendarNavItem.description ?? "",
  }
}

export function getPageMetaForProfile(
  pathname: string,
  profile: OperationalProfile
): { title: string; subtitle: string } {
  if (pathname === "/" || pathname === "") {
    return getDashboardPageMeta(profile)
  }

  if (pathname.startsWith("/clientes/migracion")) {
    return {
      title: "Migración de Clientes",
      subtitle:
        "Centro de revisión previo a la migración definitiva desde el sistema comercial.",
    }
  }

  const navItems = getAllNavItemsForProfile(profile)
  const match =
    [...navItems]
      .filter((item) =>
        item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href)
      )
      .sort((a, b) => b.href.length - a.href.length)[0] ?? navItems[0]

  if (!match) {
    return getDashboardPageMeta(profile)
  }

  return {
    title: match.pageTitle ?? match.title,
    subtitle: match.description ?? "Gestión operativa de infraestructura",
  }
}

/** Ítems de navegación por perfil (referencia para permisos futuros). */
export const PROFILE_NAV_ITEM_KEYS = {
  planificacionNavItem,
  calendarNavItem,
  workOrdersNavItem,
  archivoOtNavItem,
  customersNavItem,
  projectsNavItem,
  employeesNavItem,
  crewsNavItem,
  reportsNavItem,
  historyNavItem,
  activityNavItem,
  settingsNavItem,
  usersNavItem,
  dispositivosNavItem,
  maintenanceNavItem,
  availabilityNavItem,
  newsNavItem,
  workOrderTypesNavItem,
  incidentTypesNavItem,
}
