"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, FileClock, LayoutDashboard } from "lucide-react"

import { cn } from "@/lib/utils"

const reportesSections = [
  {
    href: "/reportes",
    label: "Dashboard Ejecutivo",
    icon: LayoutDashboard,
    match: (pathname: string) => pathname === "/reportes",
  },
  {
    href: "/reportes/operativos",
    label: "Reportes Operativos",
    icon: BarChart3,
    match: (pathname: string) => pathname.startsWith("/reportes/operativos"),
  },
  {
    href: "/reportes/automaticos",
    label: "Reportes Automáticos",
    icon: FileClock,
    match: (pathname: string) => pathname.startsWith("/reportes/automaticos"),
  },
] as const

export function ReportesSectionNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Secciones de reportes"
      className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3"
    >
      {reportesSections.map((section) => {
        const Icon = section.icon
        const isActive = section.match(pathname)

        return (
          <Link
            key={section.href}
            href={section.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {section.label}
          </Link>
        )
      })}
    </nav>
  )
}
