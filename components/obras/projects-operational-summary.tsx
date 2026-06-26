"use client"

import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  CircleDot,
  ListChecks,
  PauseCircle,
  TrendingUp,
} from "lucide-react"

import { useProjectsUI } from "@/components/obras/projects-ui-provider"
import {
  OPERATIONAL_PROJECT_CATEGORY_KPI_CARD_CLASS,
  OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS,
  OPERATIONAL_PROJECT_CATEGORY_KPI_TONE,
  OPERATIONAL_PROJECT_CATEGORY_ORDER,
} from "@/lib/projects/operational-project-category"
import { KpiCard } from "@/components/ui/kpi-card"
import { cn } from "@/lib/utils"

const CATEGORY_ICONS = {
  "sin-iniciar": Building2,
  "en-ejecucion": CircleDot,
  detenida: PauseCircle,
  finalizada: CheckCircle2,
  cancelada: Ban,
} as const

const MANAGEMENT_KPIS = [
  {
    key: "averageProgress",
    label: "Avance promedio",
    icon: TrendingUp,
    tone: "neutral" as const,
    format: (value: number) => `${value}%`,
  },
  {
    key: "overdueProjects",
    label: "Obras vencidas",
    icon: Ban,
    tone: "red" as const,
    format: (value: number) => String(value),
  },
  {
    key: "riskProjects",
    label: "Obras en riesgo",
    icon: AlertTriangle,
    tone: "yellow" as const,
    format: (value: number) => String(value),
  },
  {
    key: "pendingTasks",
    label: "Órdenes de trabajo pendientes",
    icon: ListChecks,
    tone: "blue" as const,
    format: (value: number) => String(value),
  },
] as const

export function ProjectsOperationalSummary() {
  const {
    operationalSummary,
    managementSummary,
    selectedCategory,
    openCategory,
  } = useProjectsUI()

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {OPERATIONAL_PROJECT_CATEGORY_ORDER.map((category) => {
          const isActive = selectedCategory === category
          const cardOverride = OPERATIONAL_PROJECT_CATEGORY_KPI_CARD_CLASS[category]

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
                label={OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS[category]}
                value={operationalSummary[category]}
                icon={CATEGORY_ICONS[category]}
                tone={OPERATIONAL_PROJECT_CATEGORY_KPI_TONE[category]}
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

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {MANAGEMENT_KPIS.map((item) => {
          const Icon = item.icon
          const value = managementSummary[item.key]

          return (
            <KpiCard
              key={item.key}
              label={item.label}
              value={item.format(value)}
              icon={Icon}
              tone={item.tone}
              className="shadow-sm"
            />
          )
        })}
      </div>
    </div>
  )
}
