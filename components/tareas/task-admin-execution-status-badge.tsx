import type { TaskStatus } from "@/lib/types/tasks"
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "@/lib/tasks/constants"
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
  cerrada: "🟢",
  cancelada: "🔴",
}

type TaskAdminExecutionStatusBadgeProps = {
  status: TaskStatus
  className?: string
}

export function TaskAdminExecutionStatusBadge({
  status,
  className,
}: TaskAdminExecutionStatusBadgeProps) {
  const emoji = TASK_EXECUTION_STATUS_EMOJI[status] ?? ""
  const label = TASK_STATUS_LABELS[status]

  return (
    <StatusBadge className={cn(TASK_STATUS_STYLES[status], className)}>
      {emoji ? `${emoji} ${label}` : label}
    </StatusBadge>
  )
}
