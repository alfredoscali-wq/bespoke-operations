"use client"

import { resolveOperationalExecutionBadge } from "@/lib/tasks/operational-category"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

type TaskOperationalCategoryBadgeProps = {
  task: Task
  className?: string
}

export function TaskOperationalCategoryBadge({
  task,
  className,
}: TaskOperationalCategoryBadgeProps) {
  const badge = resolveOperationalExecutionBadge(task)

  return (
    <StatusBadge className={cn(badge.className, className)}>
      {badge.label}
    </StatusBadge>
  )
}
