"use client"

import { AlertTriangle } from "lucide-react"

import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { countVencidaTasks } from "@/lib/tasks/vencida-status"
import type { Task } from "@/lib/types/tasks"

type TasksVencidasKpiProps = {
  tasks: Task[]
  isActive?: boolean
  onOpen: () => void
}

export function TasksVencidasKpi({
  tasks,
  isActive = false,
  onOpen,
}: TasksVencidasKpiProps) {
  const count = countVencidaTasks(tasks)

  return (
    <FilterableKpiCard
      label="OT Vencidas"
      value={count}
      icon={AlertTriangle}
      tone="red"
      compact
      isActive={isActive}
      onClick={onOpen}
      ariaLabel={`OT Vencidas: ${count}`}
      hint="OT que no pudieron ejecutarse y requieren reprogramación."
    />
  )
}
