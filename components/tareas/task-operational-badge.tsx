"use client"

import { resolveOperationalExecutionBadge } from "@/lib/tasks/operational-category"
import type { Task } from "@/lib/types/tasks"
import { STATUS_BADGE_BASE } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

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
    <span
      className={cn(STATUS_BADGE_BASE, badge.className, className)}
    >
      {badge.label}
    </span>
  )
}
