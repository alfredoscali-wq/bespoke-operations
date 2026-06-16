"use client"

import { useMemo } from "react"
import {
  Camera,
  CheckCircle2,
  CircleDot,
  HardHat,
  TrendingUp,
  Users,
} from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEvidence } from "@/components/evidencias/evidence-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { getProjectOperationalStats } from "@/lib/projects/utils"
import type { Project } from "@/lib/types/projects"
import { KpiCard } from "@/components/ui/kpi-card"

type ProjectDetailStatsProps = {
  project: Project
}

const statItems = [
  {
    key: "assignedCrews" as const,
    label: "Cuadrillas asignadas",
    icon: HardHat,
    tone: "blue" as const,
  },
  {
    key: "assignedPersonnel" as const,
    label: "Personal asignado",
    icon: Users,
    tone: "violet" as const,
  },
  {
    key: "activeTasks" as const,
    label: "Tareas activas",
    icon: CircleDot,
    tone: "blue" as const,
  },
  {
    key: "completedTasks" as const,
    label: "Tareas completadas",
    icon: CheckCircle2,
    tone: "green" as const,
  },
  {
    key: "evidenceFiles" as const,
    label: "Evidencias",
    icon: Camera,
    tone: "violet" as const,
  },
  {
    key: "progress" as const,
    label: "Avance",
    icon: TrendingUp,
    tone: "neutral" as const,
    suffix: "%",
  },
]

export function ProjectDetailStats({ project }: ProjectDetailStatsProps) {
  const { tasks } = useTasks()
  const { evidence } = useEvidence()
  const { crews } = useCrews()

  const stats = useMemo(
    () => getProjectOperationalStats(project, tasks, evidence, crews),
    [project, tasks, evidence, crews]
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {statItems.map((item) => {
        const Icon = item.icon
        const value = stats[item.key]

        return (
          <KpiCard
            key={item.key}
            label={item.label}
            value={`${value}${item.suffix ?? ""}`}
            icon={Icon}
            tone={item.tone}
          />
        )
      })}
    </div>
  )
}
