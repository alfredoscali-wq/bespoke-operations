"use client"

import { useTasks } from "@/components/tareas/tasks-provider"
import {
  resolveFinalTechnologyFromTask,
  resolveTechnologyLabel,
} from "@/lib/tasks/ftth-installation"
import { WORK_ORDER_TECHNOLOGY_OPTIONS } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { StatusBadge } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

const TECHNOLOGY_BADGE_STYLES: Record<string, string> = {
  fiber: "border-violet-200 bg-violet-500/10 text-violet-800 dark:border-violet-500/30 dark:text-violet-200",
  wireless:
    "border-sky-200 bg-sky-500/10 text-sky-800 dark:border-sky-500/30 dark:text-sky-200",
}

type TaskAdminTechnologyBadgeProps = {
  task: Task
  className?: string
}

export function TaskAdminTechnologyBadge({
  task,
  className,
}: TaskAdminTechnologyBadgeProps) {
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const technology = resolveFinalTechnologyFromTask(liveTask)
  const label =
    resolveTechnologyLabel(technology) ??
    WORK_ORDER_TECHNOLOGY_OPTIONS.find((option) => option.value === technology)
      ?.label

  if (!label) {
    return null
  }

  return (
    <StatusBadge
      className={cn(
        TECHNOLOGY_BADGE_STYLES[technology] ??
          "border-border bg-muted/40 text-foreground",
        className
      )}
    >
      {label}
    </StatusBadge>
  )
}
