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
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CrewsSummaryCardsProps = {
  crews: Crew[]
  tasks: Task[]
  projects: Project[]
}

const cards = [
  {
    key: "totalCrews" as keyof CrewSummary,
    label: "Total de Cuadrillas",
    icon: Users,
    color: "text-primary bg-primary/8",
  },
  {
    key: "activeCrews" as keyof CrewSummary,
    label: "Cuadrillas Activas",
    icon: HardHat,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "assignedTasks" as keyof CrewSummary,
    label: "Tareas Asignadas",
    icon: ClipboardList,
    color: "text-amber-600 bg-amber-50",
  },
  {
    key: "activeProjects" as keyof CrewSummary,
    label: "Proyectos Activos",
    icon: Briefcase,
    color: "text-blue-600 bg-blue-50",
  },
]

export function CrewsSummaryCards({
  crews,
  tasks,
  projects,
}: CrewsSummaryCardsProps) {
  const summary = getCrewsSummary(crews, tasks, projects)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        const value = summary[card.key]

        return (
          <Card key={card.key} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    card.color
                  )}
                >
                  <Icon className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {value}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
