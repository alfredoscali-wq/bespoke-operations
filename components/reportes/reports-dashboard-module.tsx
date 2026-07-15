import Link from "next/link"
import { ArrowRight, BarChart3, FileClock, UserRoundSearch } from "lucide-react"

import { ReportesSectionNav } from "@/components/reportes/reportes-section-nav"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const reportSections = [
  {
    href: "/reportes/operativos",
    title: "Reportes Operativos",
    description:
      "Indicadores, productividad por cuadrilla, localidades y exportación según período.",
    icon: BarChart3,
  },
  {
    href: "/reportes/por-empleado",
    title: "Reportes por Empleado",
    description:
      "Ficha de rendimiento individual adaptable al área: técnica, ventas, atención, RRHH o supervisión.",
    icon: UserRoundSearch,
  },
  {
    href: "/reportes/automaticos",
    title: "Reportes Automáticos",
    description:
      "Reporte semanal ejecutivo, historial, configuración y envíos programados.",
    icon: FileClock,
  },
] as const

export function ReportsDashboardModule() {
  return (
    <div className="space-y-6">
      <ReportesSectionNav />

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Dashboard Ejecutivo
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Punto de entrada unificado para consultar indicadores operativos,
          individuales y gestionar reportes automáticos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reportSections.map((section) => {
          const Icon = section.icon

          return (
            <Link key={section.href} href={section.href} className="group block">
              <Card className="h-full transition-colors hover:border-primary/30 hover:bg-muted/20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
