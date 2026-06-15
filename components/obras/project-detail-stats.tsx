"use client"

import { useMemo } from "react"
import {
  Camera,
  CheckCircle2,
  CircleDot,
  TrendingUp,
} from "lucide-react"

import { useEvidence } from "@/components/evidencias/evidence-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { getProjectOperationalStats } from "@/lib/projects/utils"
import type { Project } from "@/lib/types/projects"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectDetailStatsProps = {
  project: Project
}

const statItems = [
  {
    key: "activeTasks" as const,
    label: "Tareas Activas",
    icon: CircleDot,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "completedTasks" as const,
    label: "Tareas Completadas",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "evidenceFiles" as const,
    label: "Evidencias",
    icon: Camera,
    color: "text-violet-600 bg-violet-50",
  },
  {
    key: "progress" as const,
    label: "Avance del Proyecto",
    icon: TrendingUp,
    color: "text-primary bg-primary/8",
    suffix: "%",
  },
]

export function ProjectDetailStats({ project }: ProjectDetailStatsProps) {
  const { tasks } = useTasks()
  const { evidence } = useEvidence()

  const stats = useMemo(
    () => getProjectOperationalStats(project, tasks, evidence),
    [project, tasks, evidence]
  )

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
                {item.suffix ?? ""}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
