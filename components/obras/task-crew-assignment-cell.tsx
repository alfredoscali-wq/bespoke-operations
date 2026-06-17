import { AlertTriangle } from "lucide-react"

import type { Task } from "@/lib/types/tasks"
import type { Crew } from "@/lib/types/crews"
import {
  getTaskCrewArchiveWarning,
  isTaskCrewArchived,
  resolveTaskCrewDisplayName,
} from "@/lib/tasks/crew-relation"
import { cn } from "@/lib/utils"

type TaskCrewAssignmentCellProps = {
  task: Task
  getCrew: (id: string) => Pick<Crew, "name"> | undefined
  compact?: boolean
  className?: string
}

export function TaskCrewAssignmentCell({
  task,
  getCrew,
  compact = false,
  className,
}: TaskCrewAssignmentCellProps) {
  const displayName = resolveTaskCrewDisplayName(task, getCrew)
  const archived = isTaskCrewArchived(task, getCrew)

  if (!archived) {
    return (
      <span className={cn("text-muted-foreground", className)}>{displayName}</span>
    )
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-1.5 text-amber-800">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className={compact ? "text-sm" : undefined}>{displayName}</span>
      </div>
      <p className="text-[11px] leading-relaxed text-amber-700">
        {getTaskCrewArchiveWarning(task)}
      </p>
    </div>
  )
}
