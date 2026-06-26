"use client"

import {
  Briefcase,
  ClipboardList,
  HardHat,
  Users,
} from "lucide-react"

import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { getCrewsSummary } from "@/lib/crews/utils"
import { moduleFilterUrls } from "@/lib/navigation/query-filters"
import type { Crew, CrewSummary } from "@/lib/types/crews"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"

type CrewsSummaryCardsProps = {
  crews: Crew[]
  tasks: Task[]
  projects: Project[]
}

const cards: {
  key: keyof CrewSummary
  label: string
  icon: typeof Users
  tone: VisualTone
  href: string
}[] = [
  {
    key: "totalCrews",
    label: "Total de Cuadrillas",
    icon: Users,
    tone: "neutral",
    href: "/cuadrillas",
  },
  {
    key: "activeCrews",
    label: "Cuadrillas Activas",
    icon: HardHat,
    tone: "green",
    href: moduleFilterUrls.crews.status("activa"),
  },
  {
    key: "assignedTasks",
    label: "Órdenes de Trabajo Asignadas",
    icon: ClipboardList,
    tone: "blue",
    href: moduleFilterUrls.tasks.category("programadas"),
  },
  {
    key: "activeProjects",
    label: "Obras Activas",
    icon: Briefcase,
    tone: "violet",
    href: moduleFilterUrls.projects.status("active"),
  },
]

export function CrewsSummaryCards({
  crews,
  tasks,
  projects,
}: CrewsSummaryCardsProps) {
  const summary = getCrewsSummary(crews, tasks, projects)

  return (
    <KpiCardGrid layout="standard">
      {cards.map((card) => (
        <FilterableKpiCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
          href={card.href}
        />
      ))}
    </KpiCardGrid>
  )
}
