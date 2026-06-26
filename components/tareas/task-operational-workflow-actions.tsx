"use client"

import { useState } from "react"
import {
  CalendarClock,
  CheckCircle2,
  Play,
  XCircle,
} from "lucide-react"

import { TaskIncidentCancelDialog } from "@/components/tareas/task-incident-cancel-dialog"
import { TaskRescheduleDialog } from "@/components/tareas/task-reschedule-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  formatTaskDateTime,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants"
import { resolveIncidentReasonLabel } from "@/lib/tasks/incidents"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const OPERATIONAL_STATUS_DISPLAY: Partial<
  Record<TaskStatus, { emoji: string; label: string }>
> = {
  asignada: { emoji: "📅", label: "Programada" },
  vencida: { emoji: "🔴", label: "Vencida" },
  "en-curso": { emoji: "🟠", label: "En curso" },
  "pendiente-cierre": { emoji: "🟡", label: "Pendiente de cierre" },
  "en-aprobacion": { emoji: "🟡", label: "Pendiente de cierre" },
  incidencia: { emoji: "🔴", label: "Incidencia" },
  finalizada: { emoji: "🟢", label: "Finalizada" },
  cerrada: { emoji: "🟢", label: "Finalizada" },
  cancelada: { emoji: "🔴", label: "Cancelada" },
}

type TaskOperationalWorkflowActionsProps = {
  task: Task
  rescheduledBy: string
  canClose?: boolean
  onClose?: () => void
  onReject?: () => void
  onResume?: () => Promise<void>
  onReschedule?: (input: TaskRescheduleInput) => Promise<void>
  onCancelIncident?: (input: {
    reason: string
    observation: string
  }) => Promise<void>
  isPending?: boolean
  className?: string
}

function resolveOperationalStatusDisplay(task: Task) {
  return (
    OPERATIONAL_STATUS_DISPLAY[task.status] ?? {
      emoji: "",
      label: TASK_STATUS_LABELS[task.status],
    }
  )
}

export function TaskOperationalWorkflowActions({
  task: initialTask,
  rescheduledBy,
  canClose = false,
  onClose,
  onReject,
  onResume,
  onReschedule,
  onCancelIncident,
  isPending = false,
  className,
}: TaskOperationalWorkflowActionsProps) {
  const { getTask } = useTasks()
  const task = getTask(initialTask.id) ?? initialTask
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const statusDisplay = resolveOperationalStatusDisplay(task)
  const pendingClosure = isPendingClosureStatus(task.status)
  const hasIncident = task.status === "incidencia"
  const hasOverdue = task.status === "vencida"
  const showCloseAction = pendingClosure && canClose && onClose
  const showRejectAction = pendingClosure && canClose && onReject
  const showIncidentActions =
    hasIncident && canClose && onResume && onReschedule && onCancelIncident
  const showOverdueActions = hasOverdue && canClose && onReschedule

  const cardTone = hasIncident || hasOverdue
    ? "border-red-200/80 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
    : pendingClosure
      ? "border-amber-200/80 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20"
      : "border-blue-200/80 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20"

  return (
    <>
      <Card className={cn("shadow-sm", cardTone, className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acciones Operativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estado actual
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {statusDisplay.emoji ? `${statusDisplay.emoji} ` : ""}
              {statusDisplay.label}
            </p>
          </div>

          {hasOverdue ? (
            <div className="rounded-lg border border-red-200/80 bg-background/80 p-3 text-sm text-red-900 dark:text-red-100">
              La fecha y hora programadas ya vencieron sin iniciar la OT.
              Reprograme antes de continuar la operación.
            </div>
          ) : null}

          {hasIncident ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="mt-1 text-sm font-medium">
                    {resolveIncidentReasonLabel(task.incidentReason)}
                  </p>
                </div>
                <div className="rounded-lg border bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">Operario</p>
                  <p className="mt-1 text-sm font-medium">
                    {task.incidentReportedBy?.trim() || "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">Observación</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {task.incidentObservation?.trim() || "—"}
                </p>
              </div>

              <div className="rounded-lg border bg-background/80 p-3">
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="mt-1 text-sm font-medium">
                  {task.incidentReportedAt
                    ? formatTaskDateTime(task.incidentReportedAt)
                    : "—"}
                </p>
              </div>
            </div>
          ) : null}

          {showCloseAction || showRejectAction ? (
            <div className="flex flex-wrap gap-2">
              {showCloseAction ? (
                <Button
                  onClick={onClose}
                  disabled={isPending}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="size-4" />
                  Cerrar OT
                </Button>
              ) : null}
              {showRejectAction ? (
                <Button
                  variant="outline"
                  onClick={onReject}
                  disabled={isPending}
                >
                  Rechazar cierre
                </Button>
              ) : null}
            </div>
          ) : null}

          {showIncidentActions ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setRescheduleOpen(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <CalendarClock className="size-4" />
                Reprogramar OT
              </Button>
              <Button
                variant="outline"
                onClick={() => void onResume!()}
                disabled={isPending}
                className="gap-1.5"
              >
                <Play className="size-4" />
                Reanudar OT
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <XCircle className="size-4" />
                Cancelar OT
              </Button>
            </div>
          ) : null}

          {showOverdueActions ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setRescheduleOpen(true)}
                disabled={isPending}
                className="gap-1.5"
              >
                <CalendarClock className="size-4" />
                Reprogramar OT
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {(showIncidentActions || showOverdueActions) && onReschedule ? (
        <>
          <TaskRescheduleDialog
            open={rescheduleOpen}
            onOpenChange={setRescheduleOpen}
            task={task}
            rescheduledBy={rescheduledBy}
            description={
              hasOverdue
                ? "La OT volverá a Programada. Indique la nueva fecha, hora y motivo."
                : "La OT volverá a Programada. Indique la nueva fecha, hora y motivo de la reprogramación."
            }
            onConfirm={async (input) => {
              await onReschedule(input)
              setRescheduleOpen(false)
            }}
            isSubmitting={isPending}
          />

          {showIncidentActions && onCancelIncident ? (
            <TaskIncidentCancelDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              onConfirm={async (input) => {
                await onCancelIncident(input)
                setCancelOpen(false)
              }}
              isSubmitting={isPending}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
