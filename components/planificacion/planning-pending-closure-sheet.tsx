"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { PlanningPendingClosureDetailPanel } from "@/components/planificacion/planning-pending-closure-detail-panel"
import { TaskClosureRejectDialog } from "@/components/tareas/task-closure-reject-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  listPendingClosureTasksForPlanningDate,
  resolvePendingClosureClientLabel,
  resolvePendingClosureSubmittedAt,
  resolveTaskCrewOperatorLabel,
} from "@/lib/planificacion/planning-pending-closure"
import { PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR } from "@/lib/planificacion/planning-pending-closure-detail"
import {
  normalizePlanningPendingClosureSelectionId,
  resolvePlanningPendingClosureSheetViewPhase,
} from "@/lib/planificacion/planning-pending-closure-sheet-state"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import { canCloseWorkOrder } from "@/lib/tasks/task-closure-permissions"
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
import { Skeleton } from "@/components/ui/skeleton"

type PlanningPendingClosureSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  selectedTaskId: string | null
  onSelectedTaskIdChange: (taskId: string | null) => void
}

export function PlanningPendingClosureSheet({
  open,
  onOpenChange,
  date,
  selectedTaskId,
  onSelectedTaskIdChange,
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
  const [rejectOpen, setRejectOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const pendingTasks = useMemo(
    () => listPendingClosureTasksForPlanningDate(tasks, date, crews),
    [tasks, date, crews, detailVersion]
  )

  const canClose = canCloseWorkOrder(sessionUser?.systemRole)

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) {
      return null
    }

    return (
      getTask(selectedTaskId) ??
      pendingTasks.find((task) => task.id === selectedTaskId) ??
      null
    )
  }, [getTask, pendingTasks, selectedTaskId, detailVersion])

  const selectedDetail = useMemo(() => {
    if (!selectedTaskId) {
      return undefined
    }

    return getDetail(selectedTaskId)
  }, [getDetail, selectedTaskId, detailVersion])

  const viewPhase = resolvePlanningPendingClosureSheetViewPhase({
    selectedTaskId,
    detailLoading,
    detailError,
    hasSelectedTask: Boolean(selectedTask),
    hasSelectedDetail: Boolean(selectedDetail),
  })

  const supervisorActionsDisabled =
    isPending || detailLoading || !selectedTask || !selectedDetail

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setRejectOpen(false)
      setDetailLoading(false)
      setDetailError(null)
      return
    }

    if (
      selectedTaskId &&
      !pendingTasks.some((task) => task.id === selectedTaskId)
    ) {
      onSelectedTaskIdChange(null)
    }
  }, [open, onSelectedTaskIdChange, pendingTasks, selectedTaskId])

  useEffect(() => {
    if (!open || !selectedTaskId) {
      setDetailLoading(false)
      setDetailError(null)
      return
    }

    setDetailLoading(true)
    setDetailError(null)

    const task =
      getTask(selectedTaskId) ??
      pendingTasks.find((entry) => entry.id === selectedTaskId)

    if (!task) {
      setDetailError(
        "No fue posible identificar la orden seleccionada. Actualice la bandeja e intente nuevamente."
      )
      setDetailLoading(false)
      return
    }

    const detail = getDetail(selectedTaskId)
    if (!detail) {
      setDetailError(PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR)
      setDetailLoading(false)
      return
    }

    setDetailLoading(false)
  }, [open, selectedTaskId, getTask, getDetail, pendingTasks, detailVersion])

  function handleSelectTask(taskId: string | null | undefined) {
    const normalizedTaskId =
      normalizePlanningPendingClosureSelectionId(taskId)

    if (!normalizedTaskId) {
      onSelectedTaskIdChange(null)
      setDetailError(
        "No fue posible identificar la orden seleccionada. Actualice la bandeja e intente nuevamente."
      )
      setActionError(null)
      return
    }

    onSelectedTaskIdChange(normalizedTaskId)
    setActionError(null)
    setDetailError(null)
  }

  function handleBackToTaskList() {
    onSelectedTaskIdChange(null)
    setActionError(null)
    setDetailError(null)
  }

  function handleRetryDetailLoad() {
    if (!selectedTaskId) {
      return
    }

    setDetailLoading(true)
    setDetailError(null)

    const task =
      getTask(selectedTaskId) ??
      pendingTasks.find((entry) => entry.id === selectedTaskId)

    if (!task) {
      setDetailError(
        "No fue posible identificar la orden seleccionada. Actualice la bandeja e intente nuevamente."
      )
      setDetailLoading(false)
      return
    }

    const detail = getDetail(selectedTaskId)
    if (!detail) {
      setDetailError(PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR)
      setDetailLoading(false)
      return
    }

    setDetailLoading(false)
  }

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
              Revise la ejecución y apruebe o solicite corrección sin salir de
              planificación.
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

            {viewPhase === "LIST" ? (
              <div
                className="space-y-2"
                data-testid="planning-pending-closure-list"
              >
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
                        data-testid={`planning-pending-closure-list-item-${task.id}`}
                        onClick={() => handleSelectTask(task.id)}
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
              <div
                className="space-y-4"
                data-testid="planning-pending-closure-detail"
                data-view-phase={viewPhase}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 gap-1.5 text-muted-foreground"
                  onClick={handleBackToTaskList}
                >
                  <ArrowLeft className="size-4" />
                  Volver al listado
                </Button>

                {detailError ? (
                  <div
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    role="alert"
                  >
                    <p>{detailError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={detailLoading}
                      onClick={handleRetryDetailLoad}
                    >
                      Reintentar
                    </Button>
                  </div>
                ) : null}

                {detailLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : selectedTask && selectedDetail ? (
                  <PlanningPendingClosureDetailPanel
                    task={selectedTask}
                    detail={selectedDetail}
                    crewLabel={selectedTask.crew?.trim() || "—"}
                    operatorLabel={resolveTaskCrewOperatorLabel(
                      selectedTask,
                      crews
                    )}
                  />
                ) : detailError ? null : (
                  <p className="text-sm text-muted-foreground">
                    {PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR}
                  </p>
                )}
              </div>
            )}
          </div>

          {selectedTaskId && canClose ? (
            <SheetFooter
              className="shrink-0 border-t bg-background px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2"
              data-testid="planning-pending-closure-primary-actions"
            >
              <Button
                type="button"
                variant="outline"
                disabled={supervisorActionsDisabled}
                onClick={() => setRejectOpen(true)}
              >
                Solicitar corrección
              </Button>
              <Button
                type="button"
                disabled={supervisorActionsDisabled}
                className="gap-1.5"
                onClick={() => {
                  if (!selectedTask) {
                    return
                  }

                  void runAction(async () => {
                    const result = await approveTask(selectedTask.id)
                    if (result.success) {
                      onSelectedTaskIdChange(null)
                    }
                    return result
                  })
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Aprobar y cerrar
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
            onSelectedTaskIdChange(null)
          }
        }}
      />
    </>
  )
}
