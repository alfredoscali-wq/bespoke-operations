import type { Task, TaskPriority, TaskStatus, TaskType } from "@/lib/types/tasks"
import {
  TASK_OPERATION_LABELS,
  TASK_OPERATION_STYLES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
  TASK_TYPE_LABELS,
  TASK_TYPE_STYLES,
} from "@/lib/tasks/constants"
import { isFieldServiceTask } from "@/lib/tasks/utils"
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

export function TaskOperationBadge({
  task,
  className,
}: {
  task: Pick<Task, "projectId">
  className?: string
}) {
  const mode = isFieldServiceTask(task) ? "servicio" : "obra"

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TASK_OPERATION_STYLES[mode], className)}
    >
      {TASK_OPERATION_LABELS[mode]}
    </Badge>
  )
}
