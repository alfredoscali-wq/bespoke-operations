"use client"

import type { ReactNode } from "react"

import { DispatchOrderBadge } from "@/components/tareas/dispatch-order-badge"
import { TaskOperationalCategoryBadge } from "@/components/tareas/task-operational-badge"
import { formatTaskDate } from "@/lib/tasks/constants"
import {
  formatTaskOperationalCode,
  resolveTaskAddressLabel,
  resolveTaskClientLabel,
  resolveTaskCrewOperationalLabel,
} from "@/lib/tasks/operational-category"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type OperationalTaskCardBodyProps = {
  task: Task
  crewLabel: string
  className?: string
  footer?: ReactNode
  showCode?: boolean
}

export function OperationalTaskCardBody({
  task,
  crewLabel,
  className,
  footer,
  showCode = true,
}: OperationalTaskCardBodyProps) {
  const serviceLabel = resolveTaskOperationalTitle(task).toUpperCase()

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start gap-3">
        <DispatchOrderBadge task={task} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-primary">
            {serviceLabel}
          </p>
          <p className="text-base font-semibold text-foreground">
            {resolveTaskClientLabel(task)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-sm text-foreground">
        <p className="text-muted-foreground">
          📍 {resolveTaskAddressLabel(task)}
        </p>
        <p className="text-muted-foreground">📅 {formatTaskDate(task.dueDate)}</p>
        <p className="text-muted-foreground">
          👷 {resolveTaskCrewOperationalLabel(crewLabel)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Estado:</span>
        <TaskOperationalCategoryBadge task={task} />
      </div>

      {showCode ? (
        <p className="font-mono text-[11px] text-muted-foreground/70">
          {formatTaskOperationalCode(task.code)}
        </p>
      ) : null}

      {footer}
    </div>
  )
}
