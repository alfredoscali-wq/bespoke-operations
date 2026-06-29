"use client"

import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  MapPinOff,
  UsersRound,
} from "lucide-react"

import { KpiCard } from "@/components/ui/kpi-card"
import type { PlanningKpis } from "@/lib/planificacion/planning-utils"

type PlanningSummaryCardsProps = {
  kpis: PlanningKpis
}

export function PlanningSummaryCards({ kpis }: PlanningSummaryCardsProps) {
  const estimatedHoursLabel =
    kpis.estimatedHours < 10
      ? kpis.estimatedHours.toFixed(1).replace(".", ",")
      : String(Math.round(kpis.estimatedHours))

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        compact
        label="OT Programadas"
        value={kpis.programmedCount}
        icon={CalendarClock}
        tone="blue"
      />
      <KpiCard
        compact
        label="Cuadrillas activas"
        value={kpis.activeCrewsCount}
        icon={UsersRound}
        tone="green"
      />
      <KpiCard
        compact
        label="Horas estimadas"
        value={`${estimatedHoursLabel} h`}
        icon={Clock3}
        tone="yellow"
      />
      <KpiCard
        compact
        label="OT sin cuadrilla"
        value={kpis.withoutCrewCount}
        icon={AlertTriangle}
        tone={kpis.withoutCrewCount > 0 ? "red" : "gray"}
      />
      <KpiCard
        compact
        label="OT sin GPS"
        value={kpis.withoutGpsCount}
        icon={MapPinOff}
        tone={kpis.withoutGpsCount > 0 ? "red" : "gray"}
      />
    </div>
  )
}
