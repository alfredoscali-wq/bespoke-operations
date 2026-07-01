"use client"

import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  UsersRound,
  Zap,
} from "lucide-react"

import { KpiCard } from "@/components/ui/kpi-card"
import type { PlanningDispatchKpis } from "@/lib/planificacion/planning-dispatch"

type PlanningSummaryCardsProps = {
  kpis: PlanningDispatchKpis
}

export function PlanningSummaryCards({ kpis }: PlanningSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        compact
        label="OT planificadas"
        value={kpis.plannedCount}
        icon={CalendarClock}
        tone="blue"
      />
      <KpiCard
        compact
        label="Cuadrillas involucradas"
        value={kpis.crewsInvolvedCount}
        icon={UsersRound}
        tone="green"
      />
      <KpiCard
        compact
        label="OT sin asignar"
        value={kpis.unassignedCount}
        icon={AlertTriangle}
        tone={kpis.unassignedCount > 0 ? "red" : "gray"}
      />
      <KpiCard
        compact
        label="OT pendientes"
        value={kpis.pendingCount}
        icon={ClipboardList}
        tone="yellow"
      />
      <KpiCard
        compact
        label="Incidencias"
        value={kpis.incidentsCount}
        icon={Zap}
        tone={kpis.incidentsCount > 0 ? "red" : "gray"}
      />
    </div>
  )
}
