"use client"

import { Building2, CheckCircle2, CircleDot, Layers } from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import type { ProjectStatus } from "@/lib/types/projects"

type ProjectsOperationalSummaryProps = {
  activeStatusFilter: ProjectStatus | "all"
  onStatusFilterChange: (status: ProjectStatus | "all") => void
}

const STATUS_KPIS = [
  {
    key: "all" as const,
    label: "Total de Obras",
    icon: Layers,
    tone: "neutral" as const,
    matches: () => true,
  },
  {
    key: "active" as const,
    label: "Activas",
    icon: CircleDot,
    tone: "green" as const,
    matches: (status: ProjectStatus) => status === "active",
  },
  {
    key: "planned" as const,
    label: "Planificadas",
    icon: Building2,
    tone: "blue" as const,
    matches: (status: ProjectStatus) => status === "planned",
  },
  {
    key: "closed" as const,
    label: "Finalizadas",
    icon: CheckCircle2,
    tone: "neutral" as const,
    matches: (status: ProjectStatus) => status === "closed",
  },
]

export function ProjectsOperationalSummary({
  activeStatusFilter,
  onStatusFilterChange,
}: ProjectsOperationalSummaryProps) {
  const { projects } = useProjects()

  return (
    <KpiCardGrid layout="standard">
      {STATUS_KPIS.map((item) => {
        const Icon = item.icon
        const value =
          item.key === "all"
            ? projects.length
            : projects.filter((project) => item.matches(project.status)).length
        const isActive =
          item.key === "all"
            ? activeStatusFilter === "all"
            : activeStatusFilter === item.key

        return (
          <FilterableKpiCard
            key={item.key}
            compact
            label={item.label}
            value={value}
            icon={Icon}
            tone={item.tone}
            isActive={isActive}
            onClick={() => onStatusFilterChange(item.key)}
          />
        )
      })}
    </KpiCardGrid>
  )
}
