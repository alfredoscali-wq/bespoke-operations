import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Users,
} from "lucide-react"

import type { CrewDetail } from "@/lib/types/crews"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CrewDetailStatsProps = {
  stats: CrewDetail["stats"]
}

const statItems = [
  {
    key: "activeTasks" as const,
    label: "Tareas Activas",
    icon: ClipboardList,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "activeProjects" as const,
    label: "Proyectos Activos",
    icon: Briefcase,
    color: "text-violet-600 bg-violet-50",
  },
  {
    key: "completedTasks" as const,
    label: "Tareas Completadas",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "membersAvailable" as const,
    label: "Integrantes Disponibles",
    icon: Users,
    color: "text-primary bg-primary/8",
  },
]

export function CrewDetailStats({ stats }: CrewDetailStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => {
        const Icon = item.icon
        const value = stats[item.key]

        return (
          <Card key={item.key} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    item.color
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
