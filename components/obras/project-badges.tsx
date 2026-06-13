import type { ProjectStatus, ProjectType } from "@/lib/types/projects"
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_STYLES,
} from "@/lib/projects/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type ProjectStatusBadgeProps = {
  status: ProjectStatus
  className?: string
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", PROJECT_STATUS_STYLES[status], className)}
    >
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  )
}

type ProjectTypeBadgeProps = {
  type: ProjectType
  className?: string
}

export function ProjectTypeBadge({ type, className }: ProjectTypeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", PROJECT_TYPE_STYLES[type], className)}
    >
      {PROJECT_TYPE_LABELS[type]}
    </Badge>
  )
}
