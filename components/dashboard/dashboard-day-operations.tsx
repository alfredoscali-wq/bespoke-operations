import Link from "next/link"
import { Camera, CheckCircle2, ClipboardList } from "lucide-react"

import type { DashboardDayOperationMetric } from "@/lib/data/dashboard"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const METRIC_ICONS = {
  "scheduled-today": ClipboardList,
  "completed-today": CheckCircle2,
  "pending-evidence": Camera,
} as const

const METRIC_HREFS = {
  "scheduled-today": "/operations/calendar",
  "completed-today": "/tareas?status=finalizada",
  "pending-evidence": "/evidencias",
} as const

type DashboardDayOperationsProps = {
  metrics: DashboardDayOperationMetric[]
}

export function DashboardDayOperations({
  metrics,
}: DashboardDayOperationsProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-1 border-b">
        <CardTitle className="text-base">Operación del Día</CardTitle>
        <CardDescription>
          Resumen operativo de la jornada actual
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = METRIC_ICONS[metric.id as keyof typeof METRIC_ICONS]
          const href = METRIC_HREFS[metric.id as keyof typeof METRIC_HREFS]

          return (
            <Link
              key={metric.id}
              href={href}
              className={cn(
                "rounded-xl border bg-muted/20 px-4 py-4 transition-colors hover:bg-muted/35",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metric.hint}
                  </p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Icon className="size-4" />
                </div>
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
