"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { TaskClosureRejectDialog } from "@/components/tareas/task-closure-reject-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import {
  listPendingClosureTasksForPlanningDate,
  resolvePendingClosureClientLabel,
  resolvePendingClosureSubmittedAt,
  resolveTaskCrewOperatorLabel,
} from "@/lib/planificacion/planning-pending-closure"
import { canCloseWorkOrder } from "@/lib/tasks/task-closure-permissions"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
type PlanningPendingClosureSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
}

export function PlanningPendingClosureSheet({
  open,
  onOpenChange,
  date,
}: PlanningPendingClosureSheetProps) {
  const { sessionUser } = useAuth()
  const { crews } = useCrews()
  const {
    tasks,
    getTask,
    getDetail,
    detailVersion,
    approveTask,
    rejectTask,
  } = useTasks()
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const pendingTasks = useMemo(
    () => listPendingClosureTasksForPlanningDate(tasks, date, crews),
    [tasks, date, crews, detailVersion]
  )

  const canClose = canCloseWorkOrder(sessionUser?.systemRole)

  useEffect(() => {
    if (!open) {
      setSelectedTaskId(null)
      setActionError(null)
      setRejectOpen(false)
      return
    }

    if (
      selectedTaskId &&
      !pendingTasks.some((task) => task.id === selectedTaskId)
    ) {
      setSelectedTaskId(null)
    }
  }, [open, pendingTasks, selectedTaskId])

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) {
      return null
    }

    return getTask(selectedTaskId) ?? pendingTasks.find((task) => task.id === selectedTaskId)
  }, [getTask, pendingTasks, selectedTaskId, detailVersion])

  const selectedDetail = useMemo(() => {
    if (!selectedTaskId) {
      return undefined
    }

    return getDetail(selectedTaskId)
  }, [getDetail, selectedTaskId, detailVersion])

  async function runAction(
    action: () => Promise<{ success: boolean; message?: string }>
  ) {
    setIsPending(true)
    setActionError(null)

    try {
      const result = await action()
      if (!result.success) {
        setActionError(result.message ?? "No fue posible completar la acción.")
      }
      return result
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl"
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Órdenes pendientes de aprobación</SheetTitle>
            <SheetDescription>
              Revise el expediente técnico y apruebe o solicite corrección sin
              salir de planificación.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {actionError ? (
              <p
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}

            {!selectedTask || !selectedDetail ? (
              <div className="space-y-2">
                {pendingTasks.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay órdenes pendientes de aprobación para esta jornada.
                  </p>
                ) : (
                  pendingTasks.map((task) => {
                    const liveTask = getTask(task.id) ?? task
                    const submittedAt = resolvePendingClosureSubmittedAt(liveTask)

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          setSelectedTaskId(task.id)
                          setActionError(null)
                        }}
                        className="w-full rounded-lg border bg-muted/20 p-4 text-left transition hover:border-primary/40 hover:bg-muted/30"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-semibold text-primary">
                              {formatTaskAdminDisplayCode(liveTask.code)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {resolvePendingClosureClientLabel(liveTask)}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {submittedAt
                              ? formatTaskDateTime(submittedAt)
                              : "—"}
                          </p>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Cuadrilla
                            </p>
                            <p className="font-medium">
                              {liveTask.crew?.trim() || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Operario
                            </p>
                            <p className="font-medium">
                              {resolveTaskCrewOperatorLabel(liveTask, crews)}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 text-muted-foreground"
                  onClick={() => {
                    setSelectedTaskId(null)
                    setActionError(null)
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Volver al listado
                </Button>

                <TaskAdminDetailView
                  task={selectedTask}
                  detail={selectedDetail}
                  embedded
                />
              </div>
            )}
          </div>

          {selectedTask && canClose ? (
            <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setRejectOpen(true)}
              >
                Solicitar corrección
              </Button>
              <Button
                type="button"
                disabled={isPending}
                className="gap-1.5"
                onClick={() =>
                  void runAction(async () => {
                    const result = await approveTask(selectedTask.id)
                    if (result.success) {
                      setSelectedTaskId(null)
                    }
                    return result
                  })
                }
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Aprobar OT
                  </>
                )}
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>

      <TaskClosureRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        isSubmitting={isPending}
        title="Solicitar corrección"
        description="La orden de trabajo volverá a En curso para que la cuadrilla corrija lo necesario."
        confirmLabel="Solicitar corrección"
        onConfirm={async (reason) => {
          if (!selectedTask) {
            return
          }

          const result = await runAction(() =>
            rejectTask(selectedTask.id, reason)
          )

          if (result?.success) {
            setRejectOpen(false)
            setSelectedTaskId(null)
          }
        }}
      />
    </>
  )
}
