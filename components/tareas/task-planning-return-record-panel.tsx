"use client"

import { useState } from "react"
import { CalendarClock, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/auth-provider"
import { TaskRescheduleDialog } from "@/components/tareas/task-reschedule-dialog"
import { WorkOrderPlanningReturnDeleteDialog } from "@/components/tareas/work-order-planning-return-delete-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { formatScheduledTimeForInput } from "@/lib/tasks/scheduling"
import { readPlanningReturnInfo } from "@/lib/tasks/planning-return"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import type { Task } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskPlanningReturnRecordPanelProps = {
  task: Task
}

export function TaskPlanningReturnRecordPanel({
  task,
}: TaskPlanningReturnRecordPanelProps) {
  const { sessionUser } = useAuth()
  const { reschedulePlanningReturnedTask, deleteTask, removeTaskLocally } =
    useTasks()
  const router = useRouter()
  const returnInfo = readPlanningReturnInfo(task)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!returnInfo) {
    return null
  }

  const actorName = sessionUser?.displayName?.trim() || "Usuario"
  const previousSchedule = [
    returnInfo.previousDueDate
      ? formatTaskDateTime(returnInfo.previousDueDate)
      : null,
    returnInfo.previousScheduledTime
      ? formatScheduledTimeForInput(returnInfo.previousScheduledTime)
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  async function handleReschedule(input: TaskRescheduleInput) {
    setIsSubmitting(true)
    setFeedback(null)

    const result = await reschedulePlanningReturnedTask(task.id, {
      ...input,
      actor: actorName,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setFeedback(result.message ?? "No se pudo reprogramar la orden de trabajo.")
      return
    }

    setRescheduleOpen(false)
  }

  async function handleDelete(observation: string) {
    setIsSubmitting(true)
    setDeleteError(null)

    const result = await deleteTask(task.id, {
      administration: true,
      observation,
    })

    setIsSubmitting(false)

    if (!result.success) {
      setDeleteError(result.message ?? "No se pudo eliminar la orden de trabajo.")
      return
    }

    setDeleteOpen(false)
    removeTaskLocally(task.id)
    router.push("/tareas")
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base text-amber-950">
            Devuelta por Planificación
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-amber-300 bg-background/80"
              onClick={() => setRescheduleOpen(true)}
              disabled={isSubmitting}
            >
              <CalendarClock className="size-4" />
              Reprogramar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={isSubmitting}
              onClick={() => {
                setDeleteError(null)
                setDeleteOpen(true)
              }}
            >
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
              Motivo
            </p>
            <p className="mt-1 whitespace-pre-wrap text-amber-950">
              {returnInfo.reason}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
                Devuelta por
              </p>
              <p className="mt-1 text-amber-950">{returnInfo.returnedBy}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
                Fecha y hora
              </p>
              <p className="mt-1 text-amber-950">
                {formatTaskDateTime(returnInfo.returnedAt)}
              </p>
            </div>
          </div>

          {returnInfo.previousCrewName || previousSchedule ? (
            <div className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-amber-950">
              {returnInfo.previousCrewName ? (
                <p>
                  <span className="font-medium">Cuadrilla anterior:</span>{" "}
                  {returnInfo.previousCrewName}
                </p>
              ) : null}
              {previousSchedule ? (
                <p>
                  <span className="font-medium">Programación anterior:</span>{" "}
                  {previousSchedule}
                </p>
              ) : null}
            </div>
          ) : null}

          {feedback ? (
            <p className="text-sm text-destructive" role="alert">
              {feedback}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TaskRescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        task={task}
        rescheduledBy={actorName}
        description="Seleccione una nueva fecha. Al confirmar, la OT deja el KPI Devueltas por Planificación y vuelve al flujo normal."
        isSubmitting={isSubmitting}
        onConfirm={handleReschedule}
      />

      <WorkOrderPlanningReturnDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteError(null)
        }}
        taskLabel={task.code?.trim() || task.title}
        onConfirm={handleDelete}
        isSubmitting={isSubmitting}
        error={deleteError}
      />
    </>
  )
}
