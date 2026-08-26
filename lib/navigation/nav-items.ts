import {
  Archive,
  Box,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Cable,
  Camera,
  Compass,
  Contact,
  ContactRound,
  Factory,
  FileText,
  Headphones,
  History,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  Package,
  Radar,
  Receipt,
  Settings,
  Smartphone,
  TriangleAlert,
  Tv,
  UserCog,
  Users,
  UsersRound,
  WalletCards,
  Wrench,
  BarChart3,
  BookOpen,
} from "lucide-react"

import type { NavItem } from "@/lib/navigation/nav-types"

export const dashboardNavItem: NavItem = {
  title: "Dashboard Operativo",
  href: "/",
  icon: LayoutDashboard,
  pageTitle: "Dashboard Operativo",
  description: "Resumen operativo del día para coordinación y supervisión.",
  moduleColor: "ops",
}

export const rrhhDashboardNavItem: NavItem = {
  title: "Dashboard RRHH",
  href: "/",
  icon: LayoutDashboard,
  pageTitle: "Dashboard RRHH",
  description:
    "Empleados activos, licencias, disponibilidad, ausencias y cuadrillas.",
  moduleColor: "people",
}

export const planificacionNavItem: NavItem = {
  title: "Planificación Operativa",
  href: "/operations/planificacion",
  icon: MapPinned,
  pageTitle: "Planificación Operativa",
  description:
    "Revise la planificación propuesta y realice los ajustes necesarios antes del inicio de la jornada.",
  moduleColor: "ops",
}

export const calendarNavItem: NavItem = {
  title: "Calendario Operativo",
  href: "/operations/calendar",
  icon: CalendarDays,
  pageTitle: "Calendario Operativo",
  description:
    "Visualizar órdenes de trabajo, ausencias y estado operativo de cuadrillas en una vista semanal.",
  moduleColor: "ops",
}

export const workOrdersNavItem: NavItem = {
  title: "Órdenes de Trabajo",
  href: "/tareas",
  icon: ListChecks,
  pageTitle: "Órdenes de Trabajo",
  description: "Crear, consultar y administrar las órdenes de trabajo.",
  moduleColor: "work",
}

export const archivoOtNavItem: NavItem = {
  title: "Archivo OT",
  href: "/operations/archivo-ot",
  icon: Archive,
  pageTitle: "Archivo OT",
  description:
    "Historial operativo de OT finalizadas, canceladas y pendientes de cierre.",
  moduleColor: "work",
}

export const customersNavItem: NavItem = {
  title: "Clientes",
  href: "/clientes",
  icon: ContactRound,
  pageTitle: "Clientes",
  description: "Directorio de clientes para operaciones de campo.",
  moduleColor: "customers",
}

export const clientes360NavItem: NavItem = {
  title: "Clientes 360°",
  href: "/clientes-360",
  icon: Contact,
  pageTitle: "Clientes 360°",
  description:
    "Vista integral de los abonados ISP: servicios, conexiones, OT y actividad.",
  moduleColor: "customers",
}

export const conexionesNavItem: NavItem = {
  title: "Conexiones",
  href: "/conexiones",
  icon: Cable,
  pageTitle: "Conexiones",
  description: "Servicios y conexiones técnicas de abonados ISP.",
  moduleColor: "ops",
}

export const serviciosNavItem: NavItem = {
  title: "Servicios",
  href: "/servicios",
  icon: Package,
  pageTitle: "Servicios",
  description: "Catálogo de servicios y planes comerciales del ISP.",
  moduleColor: "commercial",
}

export const atencionClienteNavItem: NavItem = {
  title: "Atención al Cliente",
  href: "/atencion-cliente",
  icon: Headphones,
  pageTitle: "Atención al Cliente",
  description:
    "Registro y seguimiento de atenciones, contactos y gestión comercial del cliente.",
  moduleColor: "attention",
}

export const projectsNavItem: NavItem = {
  title: "Obras",
  href: "/obras",
  icon: Building2,
  pageTitle: "Obras",
  description: "Gestionar obras de infraestructura y telecomunicaciones en curso.",
  moduleColor: "ops",
}

export const employeesNavItem: NavItem = {
  title: "Empleados",
  href: "/rrhh",
  icon: Users,
  pageTitle: "Gestión de Empleados",
  description: "Personal, datos laborales y estado de RRHH.",
  moduleColor: "people",
}

export const crewsNavItem: NavItem = {
  title: "Cuadrillas",
  href: "/cuadrillas",
  icon: UsersRound,
  pageTitle: "Gestión de Cuadrillas",
  description: "Equipos de trabajo, integrantes y capacidad operativa.",
  moduleColor: "people",
}

export const contractorsNavItem: NavItem = {
  title: "Contratistas",
  href: "/contratistas",
  icon: Factory,
  pageTitle: "Contratistas",
  description:
    "Empresas contratistas, cuadrillas externas y usuarios de Field Agent.",
  moduleColor: "people",
}

export const materialsNavItem: NavItem = {
  title: "Materiales",
  href: "/materiales",
  icon: Box,
  pageTitle: "Gestión de Materiales",
  description: "Inventario, stock, movimientos y asignaciones a obras.",
  moduleColor: "ops",
}

export const evidenceNavItem: NavItem = {
  title: "Evidencias",
  href: "/evidencias",
  icon: Camera,
  pageTitle: "Evidencias de Campo",
  description: "Registro fotográfico y documental de trabajos realizados.",
  moduleColor: "ops",
}

export const reportsNavItem: NavItem = {
  title: "Reportes Operativos",
  href: "/reportes/operativos",
  icon: BarChart3,
  pageTitle: "Reportes Operativos",
  description:
    "Producción operativa: cuadrillas, cumplimiento, obras e indicadores.",
  moduleColor: "intelligence",
}

export const tesoreriaNavItem: NavItem = {
  title: "Tesorería",
  href: "/tesoreria",
  icon: WalletCards,
  pageTitle: "Tesorería",
  description:
    "Registro operativo de ingresos, egresos y saldo de la empresa.",
  moduleColor: "system",
}

export const facturacionNavItem: NavItem = {
  title: "Facturación",
  href: "/facturacion",
  icon: Receipt,
  pageTitle: "Facturación",
  description: "Comprobantes y documentos de la empresa facturadora.",
  moduleColor: "commercial",
}

export const facturacionComprobantesNavItem: NavItem = {
  title: "Comprobantes",
  href: "/facturacion/comprobantes",
  icon: FileText,
  pageTitle: "Comprobantes",
  description:
    "Gestioná facturas, presupuestos y demás documentos emitidos.",
  parentHref: "/facturacion",
  moduleColor: "commercial",
}

export const facturacionMensualNavItem: NavItem = {
  title: "Facturación mensual",
  href: "/facturacion/mensual",
  icon: CalendarRange,
  pageTitle: "Facturación mensual",
  description:
    "Prepará, revisá y confirmá el ciclo mensual antes de emitir comprobantes.",
  parentHref: "/facturacion",
  moduleColor: "commercial",
}

export const facturacionConfigNavItem: NavItem = {
  title: "Facturación",
  href: "/configuracion/facturacion",
  icon: Receipt,
  pageTitle: "Configuración de facturación",
  description:
    "Configurá la empresa emisora, punto de venta, comprobantes e integraciones fiscales.",
  parentHref: "/configuracion",
  moduleColor: "commercial",
}

export const subscriptionsNavItem: NavItem = {
  title: "TV & Suscripciones",
  href: "/subscriptions",
  icon: Tv,
  pageTitle: "TV & Suscripciones",
  description:
    "Administración de servicios recurrentes (Bespoke TV y futuros).",
  moduleColor: "commercial",
}

export const gestionComercialNavItem: NavItem = {
  title: "Gestión Comercial",
  href: "/gestion-comercial/oportunidades",
  icon: BriefcaseBusiness,
  pageTitle: "Clientes",
  description: "Escritorio operativo para gestionar clientes y actividad comercial.",
  moduleColor: "commercial",
}

export const historyNavItem: NavItem = {
  title: "Log del Sistema",
  href: "/historial",
  icon: History,
  pageTitle: "Log del Sistema",
  description: "Auditoría, trazabilidad y registro de eventos de la plataforma.",
  moduleColor: "system",
}

export const activityNavItem: NavItem = {
  title: "Sala de Situación",
  href: "/activity",
  icon: Radar,
  pageTitle: "Sala de Situación",
  description: "Estado actual de la empresa para supervisión y gerencia.",
  moduleColor: "intelligence",
}

export const executiveDailyBriefNavItem: NavItem = {
  title: "Resumen Ejecutivo Diario",
  href: "/activity/daily-brief",
  icon: FileText,
  pageTitle: "Resumen Ejecutivo Diario",
  description:
    "Qué ocurrió hoy en la empresa — lectura ejecutiva de menos de cinco minutos.",
  moduleColor: "intelligence",
}

export const workforceMonitorNavItem: NavItem = {
  title: "Workforce Monitor",
  href: "/activity/workforce-monitor",
  icon: UsersRound,
  pageTitle: "Workforce Monitor",
  description:
    "Supervisión de la jornada laboral desde Activity Engine.",
  moduleColor: "people",
}

export const crewProductionNavItem: NavItem = {
  title: "Cuadrillas",
  href: "/activity/cuadrillas",
  icon: Factory,
  pageTitle: "Cuadrillas",
  description:
    "Expediente operativo completo de cada equipo de trabajo.",
  moduleColor: "work",
}

export const activityTimelineNavItem: NavItem = {
  title: "Auditoría Técnica",
  href: "/activity/timeline",
  icon: History,
  pageTitle: "Auditoría Técnica",
  description:
    "Auditoría técnica global de eventos del Activity Engine.",
  separatorBefore: true,
  moduleColor: "system",
}

export const dayActivityNavItem: NavItem = {
  title: "Actividad de la Jornada",
  href: "/activity/jornada",
  icon: BookOpen,
  pageTitle: "Actividad de la Jornada",
  description:
    "Bitácora de negocio: qué hizo cada persona durante la jornada.",
  moduleColor: "work",
}

export const executiveCenterNavItem: NavItem = {
  title: "Centro Ejecutivo",
  href: "/activity/executive-center",
  icon: Compass,
  pageTitle: "Centro Ejecutivo",
  description: "Qué necesita mi atención ahora — prioridades del día.",
  moduleColor: "intelligence",
}

export const settingsNavItem: NavItem = {
  title: "Configuración",
  href: "/configuracion",
  icon: Settings,
  pageTitle: "Configuración",
  description: "Parámetros de la empresa para adaptar Bespoke Operations.",
  moduleColor: "system",
}

export const workOrderTypesNavItem: NavItem = {
  title: "Tipos de OT",
  href: "/configuracion/tipos-ot",
  icon: ListChecks,
  pageTitle: "Tipos de Orden de Trabajo",
  description:
    "Configure el checklist operativo asociado a cada tipo de orden de trabajo.",
  moduleColor: "work",
}

export const incidentTypesNavItem: NavItem = {
  title: "Tipos de Incidencia",
  href: "/configuracion/tipos-incidencia",
  icon: TriangleAlert,
  pageTitle: "Tipos de Incidencia",
  description:
    "Defina qué incidencias pueden reportar las cuadrillas durante la ejecución de OT.",
  moduleColor: "system",
}

export const usersNavItem: NavItem = {
  title: "Usuarios",
  href: "/usuarios",
  icon: UserCog,
  pageTitle: "Usuarios",
  description:
    "Acceso al sistema: cuentas, credenciales y permisos de ingreso a la plataforma.",
  moduleColor: "system",
}

export const dispositivosNavItem: NavItem = {
  title: "Dispositivos",
  href: "/dispositivos",
  icon: Smartphone,
  pageTitle: "Dispositivos",
  description:
    "Dispositivos corporativos autorizados para Bespoke Field Agent.",
  moduleColor: "system",
}

export const maintenanceNavItem: NavItem = {
  title: "Mantenimiento",
  href: "/mantenimiento",
  icon: Wrench,
  pageTitle: "Mantenimiento",
  description:
    "Herramientas técnicas y administrativas para uso excepcional.",
  moduleColor: "system",
}

export const availabilityNavItem: NavItem = {
  title: "Disponibilidad",
  href: "/operations/availability",
  icon: CalendarClock,
  pageTitle: "Disponibilidad del Personal",
  description: "Consultar disponibilidad operativa del personal.",
  moduleColor: "people",
}

export const newsNavItem: NavItem = {
  title: "Novedades",
  href: "/novedades",
  icon: CalendarClock,
  pageTitle: "Novedades del Personal",
  description:
    "Gestionar vacaciones, licencias, capacitaciones y ausencias del personal.",
  moduleColor: "people",
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

export const analysisNavItems: NavItem[] = [
  executiveCenterNavItem,
  dayActivityNavItem,
  reportsNavItem,
  activityNavItem,
  workforceMonitorNavItem,
  crewProductionNavItem,
  activityTimelineNavItem,
  tesoreriaNavItem,
  subscriptionsNavItem,
]

export const systemNavItems: NavItem[] = [
  settingsNavItem,
  facturacionConfigNavItem,
  historyNavItem,
  usersNavItem,
  dispositivosNavItem,
]

export const administrationNavItems: NavItem[] = [
  facturacionNavItem,
  maintenanceNavItem,
]
