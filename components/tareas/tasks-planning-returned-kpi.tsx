"use client"

import { RotateCcw } from "lucide-react"

import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { countPlanningReturnedTasks } from "@/lib/tasks/planning-return"
import type { Task } from "@/lib/types/tasks"

type TasksPlanningReturnedKpiProps = {
  tasks: Task[]
  isActive: boolean
  onToggle: () => void
}

export function TasksPlanningReturnedKpi({
  tasks,
  isActive,
  onToggle,
}: TasksPlanningReturnedKpiProps) {
  const count = countPlanningReturnedTasks(tasks)

  return (
    <FilterableKpiCard
      label="Devueltas por Planificación"
      value={count}
      icon={RotateCcw}
      tone="amber"
      compact
      isActive={isActive}
      onClick={onToggle}
      ariaLabel={`Devueltas por Planificación: ${count}`}
      hint="OT devueltas por un supervisor para revisión de Atención al Cliente."
    />
  )
}
