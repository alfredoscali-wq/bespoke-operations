import {
  Camera,
  CheckSquare,
  HardHat,
  History,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description?: string
}

export const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Resumen operativo",
  },
  {
    title: "Obras",
    href: "/obras",
    icon: HardHat,
    description: "Proyectos de infraestructura",
  },
  {
    title: "Tareas",
    href: "/tareas",
    icon: CheckSquare,
    description: "Actividades de campo",
  },
  {
    title: "Cuadrillas",
    href: "/cuadrillas",
    icon: Users,
    description: "Equipos de trabajo",
  },
  {
    title: "Evidencias",
    href: "/evidencias",
    icon: Camera,
    description: "Registro fotográfico",
  },
  {
    title: "Historial",
    href: "/historial",
    icon: History,
    description: "Bitácora de operaciones",
  },
  {
    title: "Configuración",
    href: "/configuracion",
    icon: Settings,
    description: "Preferencias del sistema",
  },
]
