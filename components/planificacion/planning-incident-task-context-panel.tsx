"use client"

import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@/lib/tasks/constants"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import type { Task } from "@/lib/types/tasks"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PlanningIncidentTaskContextPanelProps = {
  task: Task
  crewLabel: string
  operatorLabel?: string | null
  showStatus?: boolean
}

export function PlanningIncidentTaskContextPanel({
  task,
  crewLabel,
  operatorLabel,
  showStatus = true,
}: PlanningIncidentTaskContextPanelProps) {
  const customerLabel =
    task.customerName?.trim() ||
    task.customerCompany?.trim() ||
    "—"
  const workTitle =
    resolveTaskOperationalTitle(task) ||
    TASK_TYPE_LABELS[task.type] ||
    task.title?.trim() ||
    "—"

  return (
    <Card data-testid="planning-incident-task-context">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Orden de trabajo</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Código OT</p>
          <p className="font-mono text-sm font-semibold text-primary">
            {formatTaskAdminDisplayCode(task.code)}
          </p>
        </div>
        {showStatus ? (
          <div>
            <p className="text-xs text-muted-foreground">Estado</p>
            <Badge variant="outline" className="mt-1">
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Trabajo</p>
          <p className="text-sm font-medium">{workTitle}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm font-medium">{customerLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cuadrilla</p>
          <p className="text-sm font-medium">{crewLabel}</p>
        </div>
        {operatorLabel ? (
          <div>
            <p className="text-xs text-muted-foreground">Operario</p>
            <p className="text-sm font-medium">{operatorLabel}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
