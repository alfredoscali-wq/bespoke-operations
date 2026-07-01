"use client"

import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PlayCircle,
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
        label="OT programadas"
        value={kpis.plannedCount}
        icon={CalendarClock}
        tone="blue"
      />
      <KpiCard
        compact
        label="Pendientes de ejecución"
        value={kpis.pendingExecutionCount}
        icon={ClipboardList}
        tone="yellow"
      />
      <KpiCard
        compact
        label="En curso"
        value={kpis.inProgressCount}
        icon={PlayCircle}
        tone="blue"
      />
      <KpiCard
        compact
        label="Finalizadas"
        value={kpis.completedCount}
        icon={CheckCircle2}
        tone="green"
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
