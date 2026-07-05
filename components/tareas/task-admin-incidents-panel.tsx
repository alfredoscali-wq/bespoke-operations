"use client"

import { useTasks } from "@/components/tareas/tasks-provider"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { resolveIncidentReasonLabel } from "@/lib/tasks/incidents"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminIncidentsPanelProps = {
  task: Task
}

function hasIncidentRecord(task: Task): boolean {
  return Boolean(
    task.incidentReason?.trim() ||
      task.incidentObservation?.trim() ||
      task.incidentReportedAt ||
      task.incidentReportedBy?.trim() ||
      task.cancellationReason?.trim() ||
      task.cancellationObservation?.trim()
  )
}

export function TaskAdminIncidentsPanel({ task }: TaskAdminIncidentsPanelProps) {
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task

  if (!hasIncidentRecord(liveTask)) {
    return null
  }

  const hasOperationalIncident = Boolean(
    liveTask.incidentReason?.trim() ||
      liveTask.incidentObservation?.trim() ||
      liveTask.incidentReportedAt ||
      liveTask.incidentReportedBy?.trim()
  )
  const hasCancellation = Boolean(
    liveTask.cancellationReason?.trim() ||
      liveTask.cancellationObservation?.trim()
  )

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Incidencias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasOperationalIncident ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Motivo</p>
                <p className="mt-1 text-sm font-medium">
                  {resolveIncidentReasonLabel(liveTask.incidentReason)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Reportado por</p>
                <p className="mt-1 text-sm font-medium">
                  {liveTask.incidentReportedBy?.trim() || "—"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Observación</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {liveTask.incidentObservation?.trim() || "—"}
              </p>
            </div>

            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Fecha de reporte</p>
              <p className="mt-1 text-sm font-medium">
                {liveTask.incidentReportedAt
                  ? formatTaskDateTime(liveTask.incidentReportedAt)
                  : "—"}
              </p>
            </div>
          </div>
        ) : null}

        {hasCancellation ? (
          <div className="space-y-3">
            {hasOperationalIncident ? (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cancelación
              </p>
            ) : null}
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Motivo de cancelación</p>
              <p className="mt-1 text-sm font-medium">
                {liveTask.cancellationReason?.trim() || "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Observación</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {liveTask.cancellationObservation?.trim() || "—"}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
