"use client"

import {
  OPERATIONAL_CATEGORY_BADGE_LABELS,
  OPERATIONAL_CATEGORY_BADGE_STYLES,
  resolveOperationalCategory,
} from "@/lib/tasks/operational-category"
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
  const category = resolveOperationalCategory(task)

  return (
    <span
      className={cn(
        STATUS_BADGE_BASE,
        OPERATIONAL_CATEGORY_BADGE_STYLES[category],
        className
      )}
    >
      {OPERATIONAL_CATEGORY_BADGE_LABELS[category]}
    </span>
  )
}
