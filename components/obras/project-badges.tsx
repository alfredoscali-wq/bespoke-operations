import type { ProjectStatus, ProjectType } from "@/lib/types/projects"
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_STYLES,
} from "@/lib/projects/constants"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

type ProjectStatusBadgeProps = {
  status: ProjectStatus
  className?: string
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <StatusBadge className={cn(PROJECT_STATUS_STYLES[status], className)}>
      {PROJECT_STATUS_LABELS[status]}
    </StatusBadge>
  )
}

type ProjectTypeBadgeProps = {
  type: ProjectType
  className?: string
}

export function ProjectTypeBadge({ type, className }: ProjectTypeBadgeProps) {
  return (
    <StatusBadge className={cn(PROJECT_TYPE_STYLES[type], className)}>
      {PROJECT_TYPE_LABELS[type]}
    </StatusBadge>
  )
}
