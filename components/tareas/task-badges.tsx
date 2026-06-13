import type { TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_TYPE_LABELS,
  TASK_TYPE_STYLES,
} from "@/lib/tasks/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TASK_STATUS_STYLES[status], className)}
    >
      {TASK_STATUS_LABELS[status]}
    </Badge>
  )
}

export function TaskTypeBadge({
  type,
  className,
}: {
  type: TaskType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TASK_TYPE_STYLES[type], className)}
    >
      {TASK_TYPE_LABELS[type]}
    </Badge>
  )
}

export function TaskPriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TASK_PRIORITY_STYLES[priority], className)}
    >
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  )
}
