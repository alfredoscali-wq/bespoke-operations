"use client"

import { CheckCircle2, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  formatPlanningConfirmDateTime,
  type PlanningConfirmSnapshot,
} from "@/lib/planificacion/planning-confirm-session"
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
  snapshot,
  className,
}: PlanningDispatchStatusBannerProps) {
  const confirmedAtLabel = snapshot
    ? formatPlanningConfirmDateTime(snapshot.confirmedAt)
    : "—"
  const supervisorLabel = snapshot?.confirmedBy?.trim() || "—"

  return (
    <section
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-300 bg-white/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              <CheckCircle2 className="size-3.5" />
              Planificación Confirmada
            </Badge>
          </div>
          <p className="text-sm text-emerald-900 dark:text-emerald-100">
            Jornada del{" "}
            <span className="font-semibold capitalize">
              {formatPlanningDateLabel(date)}
            </span>
            . El despacho está listo para operación de campo.
          </p>
        </div>

        <dl className="grid gap-3 text-sm sm:min-w-[240px]">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Confirmación</dt>
            <dd className="text-right font-medium text-foreground">
              {confirmedAtLabel}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <UserRound className="size-3.5 shrink-0" />
              Supervisor
            </dt>
            <dd className="text-right font-medium text-foreground">
              {supervisorLabel}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
