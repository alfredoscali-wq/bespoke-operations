"use client"

import {
  Ban,
  CircleDot,
  PauseCircle,
  UserCheck,
  CheckCircle2,
} from "lucide-react"

import { useTasksUI } from "@/components/tareas/tasks-ui-provider"
import {
  OPERATIONAL_CATEGORY_KPI_CARD_CLASS,
  OPERATIONAL_CATEGORY_KPI_LABELS,
  OPERATIONAL_CATEGORY_KPI_TONE,
  OPERATIONAL_CATEGORY_ORDER,
} from "@/lib/tasks/operational-category"
import { KpiCard } from "@/components/ui/kpi-card"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS = {
  "sin-cuadrilla": UserCheck,
  programadas: CircleDot,
  suspendidas: PauseCircle,
  completadas: CheckCircle2,
  canceladas: Ban,
} as const

export function TasksOperationalSummary() {
  const { operationalSummary, selectedCategory, openCategory } = useTasksUI()

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {OPERATIONAL_CATEGORY_ORDER.map((category) => {
        const isActive = selectedCategory === category
        const cardOverride = OPERATIONAL_CATEGORY_KPI_CARD_CLASS[category]

        return (
          <button
            key={category}
            type="button"
            onClick={() => openCategory(category)}
            className={cn(
              "rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isActive && "ring-2 ring-primary/25"
            )}
          >
            <KpiCard
              label={OPERATIONAL_CATEGORY_KPI_LABELS[category]}
              value={operationalSummary[category]}
              icon={CATEGORY_ICONS[category]}
              tone={OPERATIONAL_CATEGORY_KPI_TONE[category]}
              className={cn(
                "h-full cursor-pointer transition-shadow hover:shadow-md",
                cardOverride,
                isActive && "shadow-md"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
