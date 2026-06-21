"use client"

import {
  OPERATIONAL_PROJECT_CATEGORY_BADGE_LABELS,
  OPERATIONAL_PROJECT_CATEGORY_BADGE_STYLES,
  resolveOperationalProjectCategory,
} from "@/lib/projects/operational-project-category"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import { STATUS_BADGE_BASE } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type ProjectOperationalCategoryBadgeProps = {
  project: Project
  tasks?: Task[]
  className?: string
}

export function ProjectOperationalCategoryBadge({
  project,
  tasks = [],
  className,
}: ProjectOperationalCategoryBadgeProps) {
  const category = resolveOperationalProjectCategory(project, tasks)

  return (
    <span
      className={cn(
        STATUS_BADGE_BASE,
        OPERATIONAL_PROJECT_CATEGORY_BADGE_STYLES[category],
        className
      )}
    >
      {OPERATIONAL_PROJECT_CATEGORY_BADGE_LABELS[category]}
    </span>
  )
}
