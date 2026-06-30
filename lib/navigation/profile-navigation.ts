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
  customersNavItem,
  dashboardNavItem,
  dispositivosNavItem,
  employeesNavItem,
  historyNavItem,
  availabilityNavItem,
  newsNavItem,
  planificacionNavItem,
  projectsNavItem,
  reportsNavItem,
  rrhhDashboardNavItem,
  settingsNavItem,
  usersNavItem,
  workOrdersNavItem,
} from "@/lib/navigation/nav-items"

const PROFILE_NAV_BUILDERS: Record<
  Exclude<OperationalProfile, "operario">,
  () => NavGroup[]
> = {
  administrador: () => [
    { id: "dashboard", items: [dashboardNavItem] },
    {
      id: "operations",
      label: "Operaciones",
      items: [
        calendarNavItem,
        projectsNavItem,
        workOrdersNavItem,
        planificacionNavItem,
        customersNavItem,
      ],
    },
    {
      id: "rrhh",
      label: "RRHH",
      items: [employeesNavItem],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
    {
      id: "system",
      label: "Sistema",
      items: [historyNavItem, settingsNavItem, usersNavItem, dispositivosNavItem],
    },
  ],
  supervisor: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [
        calendarNavItem,
        projectsNavItem,
        workOrdersNavItem,
        planificacionNavItem,
        customersNavItem,
      ],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
  ],
  administracion_operativa: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [
        calendarNavItem,
        customersNavItem,
        workOrdersNavItem,
        projectsNavItem,
      ],
    },
    { id: "analysis", label: "Análisis", items: [reportsNavItem] },
  ],
  ventas: () => [
    {
      id: "operations",
      label: "Operaciones",
      items: [calendarNavItem, customersNavItem, workOrdersNavItem],
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
  return buildNavGroupsForProfile(profile).flatMap((group) => group.items)
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
  customersNavItem,
  projectsNavItem,
  employeesNavItem,
  crewsNavItem,
  reportsNavItem,
  historyNavItem,
  settingsNavItem,
  usersNavItem,
  availabilityNavItem,
  newsNavItem,
}
