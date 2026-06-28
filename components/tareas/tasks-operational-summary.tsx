"use client"

import {
  Ban,
  CalendarClock,
  CheckCircle2,
  HardHat,
  PauseCircle,
  UserCheck,
} from "lucide-react"

import { useTasksUI } from "@/components/tareas/tasks-ui-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  OPERATIONAL_CATEGORY_KPI_LABELS,
  OPERATIONAL_CATEGORY_KPI_TONE,
  OPERATIONAL_CATEGORY_ORDER,
} from "@/lib/tasks/operational-category"

const CATEGORY_ICONS = {
  programadas: CalendarClock,
  asignadas: UserCheck,
  "en-curso": HardHat,
  "pendientes-cierre": PauseCircle,
  finalizadas: CheckCircle2,
  canceladas: Ban,
} as const

export function TasksOperationalSummary() {
  const { operationalSummary, selectedCategory, openCategory } = useTasksUI()

  return (
    <KpiCardGrid layout="operational">
      {OPERATIONAL_CATEGORY_ORDER.map((category) => {
        const Icon = CATEGORY_ICONS[category]

        return (
          <FilterableKpiCard
            key={category}
            label={OPERATIONAL_CATEGORY_KPI_LABELS[category]}
            value={operationalSummary[category]}
            icon={Icon}
            tone={OPERATIONAL_CATEGORY_KPI_TONE[category]}
            isActive={selectedCategory === category}
            onClick={() => openCategory(category)}
          />
        )
      })}
    </KpiCardGrid>
  )
}
