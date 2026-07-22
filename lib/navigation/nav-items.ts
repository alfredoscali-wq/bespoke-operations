import {
  Archive,
  BarChart3,
  Building2,
  CalendarClock,
  CalendarRange,
  Camera,
  Contact,
  Factory,
  Headset,
  History,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  Package,
  Radar,
  Settings,
  Smartphone,
  TriangleAlert,
  UserCog,
  Users,
  UsersRound,
  Wrench,
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

export const planificacionNavItem: NavItem = {
  title: "Planificación Operativa",
  href: "/operations/planificacion",
  icon: MapPinned,
  pageTitle: "Planificación Operativa",
  description:
    "Revise la planificación propuesta y realice los ajustes necesarios antes del inicio de la jornada.",
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
    "Crear, consultar y administrar las órdenes de trabajo.",
}

export const archivoOtNavItem: NavItem = {
  title: "Archivo OT",
  href: "/operations/archivo-ot",
  icon: Archive,
  pageTitle: "Archivo OT",
  description:
    "Historial operativo de OT finalizadas, canceladas y pendientes de cierre.",
}

export const customersNavItem: NavItem = {
  title: "Clientes",
  href: "/clientes",
  icon: Contact,
  pageTitle: "Clientes",
  description: "Directorio de clientes para operaciones de campo.",
}

export const atencionClienteNavItem: NavItem = {
  title: "Atención al Cliente",
  href: "/atencion-cliente",
  icon: Headset,
  pageTitle: "Atención al Cliente",
  description:
    "Registro y seguimiento de atenciones, contactos y gestión comercial del cliente.",
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

export const contractorsNavItem: NavItem = {
  title: "Contratistas",
  href: "/contratistas",
  icon: Factory,
  pageTitle: "Contratistas",
  description:
    "Empresas contratistas, cuadrillas externas y usuarios de Field Agent.",
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
  title: "Log del Sistema",
  href: "/historial",
  icon: History,
  pageTitle: "Log del Sistema",
  description: "Auditoría, trazabilidad y registro de eventos de la plataforma.",
}

export const activityNavItem: NavItem = {
  title: "Activity Engine",
  href: "/activity",
  icon: Radar,
  pageTitle: "Activity Engine",
  description:
    "Visor interno de solo lectura para validar eventos de Activity Engine.",
}

export const settingsNavItem: NavItem = {
  title: "Configuración",
  href: "/configuracion",
  icon: Settings,
  pageTitle: "Configuración",
  description: "Parámetros de la empresa para adaptar Bespoke Operations.",
}

export const workOrderTypesNavItem: NavItem = {
  title: "Tipos de OT",
  href: "/configuracion/tipos-ot",
  icon: ListChecks,
  pageTitle: "Tipos de Orden de Trabajo",
  description:
    "Configure el checklist operativo asociado a cada tipo de orden de trabajo.",
}

export const incidentTypesNavItem: NavItem = {
  title: "Tipos de Incidencia",
  href: "/configuracion/tipos-incidencia",
  icon: TriangleAlert,
  pageTitle: "Tipos de Incidencia",
  description:
    "Defina qué incidencias pueden reportar las cuadrillas durante la ejecución de OT.",
}

export const usersNavItem: NavItem = {
  title: "Usuarios",
  href: "/usuarios",
  icon: UserCog,
  pageTitle: "Usuarios",
  description:
    "Acceso al sistema: cuentas, credenciales y permisos de ingreso a la plataforma.",
}

export const dispositivosNavItem: NavItem = {
  title: "Dispositivos",
  href: "/dispositivos",
  icon: Smartphone,
  pageTitle: "Dispositivos",
  description:
    "Dispositivos corporativos autorizados para Bespoke Field Agent.",
}

export const maintenanceNavItem: NavItem = {
  title: "Mantenimiento",
  href: "/mantenimiento",
  icon: Wrench,
  pageTitle: "Mantenimiento",
  description:
    "Herramientas técnicas y administrativas para uso excepcional.",
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
  href: "/novedades",
  icon: CalendarClock,
  pageTitle: "Novedades del Personal",
  description:
    "Gestionar vacaciones, licencias, capacitaciones y ausencias del personal.",
}

export const coreOperationsNavItems: NavItem[] = [
  calendarNavItem,
  planificacionNavItem,
  projectsNavItem,
  workOrdersNavItem,
  archivoOtNavItem,
  evidenceNavItem,
  materialsNavItem,
]

export const customersNavItems: NavItem[] = [customersNavItem]

export const fieldOperationsNavItems: NavItem[] = [
  crewsNavItem,
  contractorsNavItem,
  materialsNavItem,
  evidenceNavItem,
]

export const rrhhNavItems: NavItem[] = [employeesNavItem, newsNavItem]

export const analysisNavItems: NavItem[] = [reportsNavItem]

export const systemNavItems: NavItem[] = [
  settingsNavItem,
  historyNavItem,
  activityNavItem,
  usersNavItem,
  dispositivosNavItem,
]

export const administrationNavItems: NavItem[] = [maintenanceNavItem]
