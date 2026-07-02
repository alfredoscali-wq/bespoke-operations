"use client"

import { CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { PlanningConfirmSnapshot } from "@/lib/planificacion/planning-confirm-session"
import { cn } from "@/lib/utils"

type PlanningDispatchStatusBannerProps = {
  date: string
  snapshot: PlanningConfirmSnapshot | null
  className?: string
}

function formatPlanningDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return date
  }

  return parsed.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function PlanningDispatchStatusBanner({
  date,
  snapshot: _snapshot,
  className,
}: PlanningDispatchStatusBannerProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className="border-emerald-300 bg-white/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          <CheckCircle2 className="size-3.5" />
          Planificación confirmada
        </Badge>
        <p className="text-sm text-emerald-900 dark:text-emerald-100">
          Jornada del{" "}
          <span className="font-semibold capitalize">
            {formatPlanningDateLabel(date)}
          </span>
          . Puede revisar el despacho o modificar la planificación si aún no
          comenzó la jornada.
        </p>
      </div>
    </section>
  )
}
