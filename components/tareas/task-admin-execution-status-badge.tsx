import type { Task, TaskStatus } from "@/lib/types/tasks"
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "@/lib/tasks/constants"
import {
  hasActivePlanningReturn,
  PLANNING_RETURNED_DISPLAY_LABEL,
} from "@/lib/tasks/planning-return"
import { StatusBadge } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

const TASK_EXECUTION_STATUS_EMOJI: Partial<Record<TaskStatus, string>> = {
  programada: "🟡",
  asignada: "🔵",
  vencida: "🟡",
  "en-curso": "🟠",
  incidencia: "🟠",
  "pendiente-cierre": "🟡",
  "en-aprobacion": "🟡",
  finalizada: "🟢",
  cancelada: "🔴",
}

type TaskAdminExecutionStatusBadgeProps = {
  status: TaskStatus
  task?: Pick<Task, "taskMetadata">
  className?: string
}

export function TaskAdminExecutionStatusBadge({
  status,
  task,
  className,
}: TaskAdminExecutionStatusBadgeProps) {
  if (task && hasActivePlanningReturn(task)) {
    return (
      <StatusBadge className={cn(TASK_STATUS_STYLES.vencida, className)}>
        {`🟡 ${PLANNING_RETURNED_DISPLAY_LABEL}`}
      </StatusBadge>
    )
  }

  const emoji = TASK_EXECUTION_STATUS_EMOJI[status] ?? ""
  const label = TASK_STATUS_LABELS[status]

  return (
    <StatusBadge className={cn(TASK_STATUS_STYLES[status], className)}>
      {emoji ? `${emoji} ${label}` : label}
    </StatusBadge>
  )
}
