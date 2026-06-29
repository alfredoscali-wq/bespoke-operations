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
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { moduleFilterUrls } from "@/lib/navigation/query-filters"
import {
  OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS,
  OPERATIONAL_PROJECT_CATEGORY_KPI_TONE,
  OPERATIONAL_PROJECT_CATEGORY_ORDER,
} from "@/lib/projects/operational-project-category"

const CATEGORY_ICONS = {
  "sin-iniciar": Building2,
  "en-ejecucion": CircleDot,
  detenida: PauseCircle,
  finalizada: CheckCircle2,
  cancelada: Ban,
} as const

const MANAGEMENT_KPIS = [
  {
    key: "averageProgress" as const,
    label: "Avance promedio",
    icon: TrendingUp,
    tone: "neutral" as const,
    format: (value: number) => `${value}%`,
    href: undefined,
  },
  {
    key: "overdueProjects" as const,
    label: "Obras vencidas",
    icon: Ban,
    tone: "red" as const,
    format: (value: number) => String(value),
    href: moduleFilterUrls.projects.health("overdue"),
  },
  {
    key: "riskProjects" as const,
    label: "Obras en riesgo",
    icon: AlertTriangle,
    tone: "yellow" as const,
    format: (value: number) => String(value),
    href: moduleFilterUrls.projects.health("risk"),
  },
  {
    key: "pendingTasks" as const,
    label: "OT programadas",
    icon: ListChecks,
    tone: "blue" as const,
    format: (value: number) => String(value),
    href: "/tareas",
  },
]

export function ProjectsOperationalSummary() {
  const {
    operationalSummary,
    managementSummary,
    selectedCategory,
    openCategory,
  } = useProjectsUI()

  return (
    <div className="space-y-5">
      <KpiCardGrid layout="operational">
        {OPERATIONAL_PROJECT_CATEGORY_ORDER.map((category) => {
          const Icon = CATEGORY_ICONS[category]

          return (
            <FilterableKpiCard
              key={category}
              label={OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS[category]}
              value={operationalSummary[category]}
              icon={Icon}
              tone={OPERATIONAL_PROJECT_CATEGORY_KPI_TONE[category]}
              isActive={selectedCategory === category}
              onClick={() => openCategory(category)}
            />
          )
        })}
      </KpiCardGrid>

      <KpiCardGrid layout="standard">
        {MANAGEMENT_KPIS.map((item) => {
          const Icon = item.icon
          const value = managementSummary[item.key]

          return (
            <FilterableKpiCard
              key={item.key}
              label={item.label}
              value={item.format(value)}
              icon={Icon}
              tone={item.tone}
              href={item.href}
            />
          )
        })}
      </KpiCardGrid>
    </div>
  )
}
