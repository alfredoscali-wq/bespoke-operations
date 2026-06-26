"use client"

import { CalendarClock } from "lucide-react"

import { buildOverdueTaskSummary } from "@/lib/tasks/overdue-display"
import type { Task } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type OverdueTaskInfoPanelProps = {
  task: Task
  onReschedule?: () => void
  showRescheduleAction?: boolean
  compact?: boolean
  className?: string
}

export function OverdueTaskInfoPanel({
  task,
  onReschedule,
  showRescheduleAction = false,
  compact = false,
  className,
}: OverdueTaskInfoPanelProps) {
  const summary = buildOverdueTaskSummary(task)
  if (!summary) {
    return null
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-red-200/80 bg-red-50/70 p-3 text-red-950 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{summary.overdueDaysLabel}</p>
          {!compact ? (
            <p className="text-xs text-red-900/80 dark:text-red-100/80">
              La OT no inició ejecución dentro de la fecha programada.
            </p>
          ) : null}
        </div>
        {showRescheduleAction && onReschedule ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-200 bg-background/80"
            onClick={onReschedule}
          >
            <CalendarClock className="size-4" />
            Reprogramar
          </Button>
        ) : null}
      </div>

      <dl
        className={cn(
          "mt-3 grid gap-2 text-sm",
          compact ? "grid-cols-1" : "sm:grid-cols-2"
        )}
      >
        <div>
          <dt className="text-xs text-red-900/70 dark:text-red-100/70">
            Fecha programada
          </dt>
          <dd className="font-medium">{summary.scheduledDateLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-red-900/70 dark:text-red-100/70">
            Estado actual
          </dt>
          <dd className="font-medium">{summary.statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-red-900/70 dark:text-red-100/70">
            Cuadrilla asignada
          </dt>
          <dd className="font-medium">{summary.crewLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-red-900/70 dark:text-red-100/70">
            Supervisor
          </dt>
          <dd className="font-medium">{summary.supervisorLabel}</dd>
        </div>
      </dl>
    </div>
  )
}
