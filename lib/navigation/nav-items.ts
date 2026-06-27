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
  UserCog,
  Users,
  UsersRound,
} from "lucide-react"

import type { NavItem } from "@/lib/navigation/nav-types"

export const dashboardNavItem: NavItem = {
  title: "Dashboard Operativo",
  href: "/",
  icon: LayoutDashboard,
  pageTitle: "Dashboard Operativo",
  description: "Resumen operativo del día para coordinación y supervisión.",
}

export const rrhhDashboardNavItem: NavItem = {
  title: "Dashboard RRHH",
  href: "/",
  icon: LayoutDashboard,
  pageTitle: "Dashboard RRHH",
  description:
    "Empleados activos, licencias, disponibilidad, ausencias y cuadrillas.",
}

export const calendarNavItem: NavItem = {
  title: "Calendario Operativo",
  href: "/operations/calendar",
  icon: CalendarRange,
  pageTitle: "Calendario Operativo",
  description:
    "Visualizar órdenes de trabajo, ausencias y estado operativo de cuadrillas en una vista semanal.",
}

export const workOrdersNavItem: NavItem = {
  title: "Órdenes de Trabajo",
  href: "/tareas",
  icon: ListChecks,
  pageTitle: "Órdenes de Trabajo",
  description:
    "Planificar, asignar y dar seguimiento a órdenes de trabajo de campo.",
}

export const customersNavItem: NavItem = {
  title: "Clientes",
  href: "/clientes",
  icon: Contact,
  pageTitle: "Clientes",
  description: "Directorio de clientes para operaciones de campo.",
}

export const projectsNavItem: NavItem = {
  title: "Obras",
  href: "/obras",
  icon: Building2,
  pageTitle: "Obras",
  description: "Gestionar obras de infraestructura y telecomunicaciones en curso.",
}

export const employeesNavItem: NavItem = {
  title: "Empleados",
  href: "/rrhh",
  icon: Users,
  pageTitle: "Gestión de Empleados",
  description: "Personal, datos laborales y estado de RRHH.",
}

export const crewsNavItem: NavItem = {
  title: "Cuadrillas",
  href: "/cuadrillas",
  icon: UsersRound,
  pageTitle: "Gestión de Cuadrillas",
  description: "Equipos de trabajo, integrantes y capacidad operativa.",
}

export const materialsNavItem: NavItem = {
  title: "Materiales",
  href: "/materiales",
  icon: Package,
  pageTitle: "Gestión de Materiales",
  description: "Inventario, stock, movimientos y asignaciones a obras.",
}

export const evidenceNavItem: NavItem = {
  title: "Evidencias",
  href: "/evidencias",
  icon: Camera,
  pageTitle: "Evidencias de Campo",
  description: "Registro fotográfico y documental de trabajos realizados.",
}

export const reportsNavItem: NavItem = {
  title: "Reportes",
  href: "/reportes",
  icon: BarChart3,
  pageTitle: "Reportes",
  description:
    "Dashboard ejecutivo, indicadores operativos y reportes automáticos.",
}

export const historyNavItem: NavItem = {
  title: "Historial",
  href: "/historial",
  icon: History,
  pageTitle: "Historial del Sistema",
  description: "Bitácora y trazabilidad de operaciones del sistema.",
}

export const settingsNavItem: NavItem = {
  title: "Configuración del Sistema",
  href: "/configuracion",
  icon: Settings,
  pageTitle: "Configuración del Sistema",
  description: "Preferencias generales y parámetros de la plataforma.",
}

export const usersNavItem: NavItem = {
  title: "Usuarios",
  href: "/usuarios",
  icon: UserCog,
  pageTitle: "Usuarios del Sistema",
  description: "Accesos, roles y cuentas de la plataforma.",
}

export const availabilityNavItem: NavItem = {
  title: "Disponibilidad",
  href: "/operations/availability",
  icon: CalendarClock,
  pageTitle: "Disponibilidad del Personal",
  description: "Consultar disponibilidad operativa del personal.",
}

export const newsNavItem: NavItem = {
  title: "Novedades",
  href: "/operations/availability",
  icon: CalendarClock,
  pageTitle: "Novedades del Personal",
  description:
    "Gestionar vacaciones, licencias, capacitaciones y ausencias del personal.",
}

export const coreOperationsNavItems: NavItem[] = [
  calendarNavItem,
  projectsNavItem,
  workOrdersNavItem,
]

export const customersNavItems: NavItem[] = [customersNavItem]

export const fieldOperationsNavItems: NavItem[] = [
  crewsNavItem,
  materialsNavItem,
  evidenceNavItem,
]

export const rrhhNavItems: NavItem[] = [employeesNavItem, newsNavItem]

export const analysisNavItems: NavItem[] = [reportsNavItem]

export const systemNavItems: NavItem[] = [historyNavItem, settingsNavItem]
