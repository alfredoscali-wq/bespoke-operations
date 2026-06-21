import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarRange,
  Camera,
  Contact,
  History,
  LayoutDashboard,
  ListChecks,
  Package,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  pageTitle?: string
}

export type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}

export const dashboardNavItem: NavItem = {
  title: "Dashboard",
  href: "/",
  icon: LayoutDashboard,
  description: "Resumen operativo del día para coordinación y supervisión.",
}

export const coreOperationsNavItems: NavItem[] = [
  {
    title: "Calendario",
    href: "/operations/calendar",
    icon: CalendarRange,
    pageTitle: "Calendario Operativo",
    description:
      "Visualizar tareas, ausencias y estado operativo de cuadrillas en una vista semanal.",
  },
  {
    title: "Obras",
    href: "/obras",
    icon: Building2,
    pageTitle: "Obras y Proyectos",
    description:
      "Gestionar proyectos de infraestructura y telecomunicaciones en curso.",
  },
  {
    title: "Tareas",
    href: "/tareas",
    icon: ListChecks,
    pageTitle: "Gestión de Tareas",
    description: "Planificar, asignar y dar seguimiento a actividades de campo.",
  },
]

export const customersNavItems: NavItem[] = [
  {
    title: "Clientes",
    href: "/clientes",
    icon: Contact,
    pageTitle: "Gestión de Clientes",
    description:
      "Directorio de abonados y suscriptores para operaciones de campo.",
  },
]

export const fieldOperationsNavItems: NavItem[] = [
  {
    title: "Cuadrillas",
    href: "/cuadrillas",
    icon: UsersRound,
    pageTitle: "Gestión de Cuadrillas",
    description: "Equipos de trabajo, integrantes y capacidad operativa.",
  },
  {
    title: "Materiales",
    href: "/materiales",
    icon: Package,
    pageTitle: "Gestión de Materiales",
    description: "Inventario, stock, movimientos y asignaciones a obras.",
  },
  {
    title: "Evidencias",
    href: "/evidencias",
    icon: Camera,
    pageTitle: "Evidencias de Campo",
    description: "Registro fotográfico y documental de trabajos realizados.",
  },
]

/** @deprecated Use coreOperationsNavItems + fieldOperationsNavItems. */
export const operationsNavItems: NavItem[] = [
  ...coreOperationsNavItems,
  ...fieldOperationsNavItems,
]

export const rrhhNavItems: NavItem[] = [
  {
    title: "Empleados",
    href: "/rrhh",
    icon: Users,
    pageTitle: "Gestión de Empleados",
    description: "Personal, datos laborales y estado de RRHH.",
  },
  {
    title: "Novedades",
    href: "/operations/availability",
    icon: CalendarClock,
    pageTitle: "Novedades del Personal",
    description:
      "Gestionar vacaciones, licencias, capacitaciones y ausencias del personal.",
  },
]

export const analysisNavItems: NavItem[] = [
  {
    title: "Reportes",
    href: "/reportes",
    icon: BarChart3,
    pageTitle: "Reportes Operativos",
    description:
      "Indicadores y análisis de órdenes de trabajo según período y filtros operativos.",
  },
]

export const systemNavItems: NavItem[] = [
  {
    title: "Historial",
    href: "/historial",
    icon: History,
    pageTitle: "Historial Operativo",
    description: "Bitácora y trazabilidad de operaciones del sistema.",
  },
  {
    title: "Configuración",
    href: "/configuracion",
    icon: Settings,
    pageTitle: "Configuración del Sistema",
    description: "Preferencias generales y parámetros de la plataforma.",
  },
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

export const allNavItems: NavItem[] = navGroups.flatMap((group) => group.items)
