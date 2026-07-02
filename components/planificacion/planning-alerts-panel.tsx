"use client"

import type { PlanningAlerts } from "@/lib/planificacion/planning-utils"
import { cn } from "@/lib/utils"

type PlanningAlertsPanelProps = {
  alerts: PlanningAlerts
  className?: string
}

function AlertItem({
  label,
  value,
  active,
}: {
  label: string
  value: number | string
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        active ? "border-amber-200 bg-amber-50/80" : "border-border bg-muted/20"
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

export function PlanningAlertsPanel({
  alerts,
  className,
}: PlanningAlertsPanelProps) {
  const overloadedLabel =
    alerts.overloadedCrews.length === 0
      ? "Ninguna"
      : alerts.overloadedCrews
          .map(
            (crew) =>
              `${crew.crewName} (${crew.estimatedHours.toFixed(1).replace(".", ",")} h)`
          )
          .join(", ")

  const hasAlerts =
    alerts.withoutGps > 0 ||
    alerts.withoutCrew > 0 ||
    alerts.withoutDuration > 0 ||
    alerts.overloadedCrews.length > 0

  return (
    <section
      className={cn(
        "rounded-xl border bg-card px-4 py-4 shadow-sm",
        className
      )}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          Alertas de Planificación
        </h2>
        <p className="text-xs text-muted-foreground">
          {hasAlerts
            ? "Revise estos puntos antes de confirmar la jornada."
            : "Sin alertas para la jornada seleccionada."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AlertItem
          label="OT sin GPS"
          value={alerts.withoutGps}
          active={alerts.withoutGps > 0}
        />
        <AlertItem
          label="OT sin cuadrilla"
          value={alerts.withoutCrew}
          active={alerts.withoutCrew > 0}
        />
        <AlertItem
          label="OT sin duración"
          value={alerts.withoutDuration}
          active={alerts.withoutDuration > 0}
        />
        <AlertItem
          label="Cuadrillas sobrecargadas"
          value={overloadedLabel}
          active={alerts.overloadedCrews.length > 0}
        />
      </div>
    </section>
  )
}
