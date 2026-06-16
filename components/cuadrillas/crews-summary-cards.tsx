import {
  Briefcase,
  ClipboardList,
  HardHat,
  Users,
} from "lucide-react"

import { getCrewsSummary } from "@/lib/crews/utils"
import type { Crew, CrewSummary } from "@/lib/types/crews"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

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
}[] = [
  {
    key: "totalCrews",
    label: "Total de Cuadrillas",
    icon: Users,
    tone: "neutral",
  },
  {
    key: "activeCrews",
    label: "Cuadrillas Activas",
    icon: HardHat,
    tone: "green",
  },
  {
    key: "assignedTasks",
    label: "Tareas Asignadas",
    icon: ClipboardList,
    tone: "blue",
  },
  {
    key: "activeProjects",
    label: "Proyectos Activos",
    icon: Briefcase,
    tone: "violet",
  },
]

export function CrewsSummaryCards({
  crews,
  tasks,
  projects,
}: CrewsSummaryCardsProps) {
  const summary = getCrewsSummary(crews, tasks, projects)

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  )
}
