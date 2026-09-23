"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { PlanningPendingClosureDetailPanel } from "@/components/planificacion/planning-pending-closure-detail-panel"
import { TaskClosureRejectDialog } from "@/components/tareas/task-closure-reject-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import { getTaskDetail } from "@/lib/data/tasks"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR } from "@/lib/planificacion/planning-pending-closure-detail"
import { resolveTaskCrewOperatorLabel } from "@/lib/planificacion/planning-pending-closure"
import {
  loadLiveCompanyTask,
  TASK_IDENTITY_UNRESOLVED_MESSAGE,
} from "@/lib/tasks/live-company-task"
import { getLiveTaskByCompanyAndId } from "@/lib/supabase/tasks.browser"
import type { Task } from "@/lib/types/tasks"
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

type ProjectTaskClosureReviewSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string | null
  task?: Task | null
  onReviewCompleted?: () => void
}

export function ProjectTaskClosureReviewSheet({
  open,
  onOpenChange,
  taskId,
  task: loadedTask,
  onReviewCompleted,
}: ProjectTaskClosureReviewSheetProps) {
  const { sessionUser } = useAuth()
  const { companyId } = useTenantCompanyId()
  const { crews } = useCrews()
  const { detailVersion, approveTask, rejectTask } = useTasks()
  const [resolvedTask, setResolvedTask] = useState<Task | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const canReview = canAccessObrasModuleForStart(sessionUser)

  const detail = useMemo(() => {
    if (!resolvedTask) {
      return null
    }

    return getTaskDetail(resolvedTask)
  }, [resolvedTask, detailVersion])

  useEffect(() => {
    if (!open) {
      setResolvedTask(null)
      setDetailLoading(false)
      setDetailError(null)
      setActionError(null)
      setRejectOpen(false)
      return
    }

    if (!taskId) {
      setResolvedTask(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }

    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)

    void loadLiveCompanyTask(taskId, companyId, {
      loadedTask: loadedTask,
      loadLiveTask: getLiveTaskByCompanyAndId,
    }).then((result) => {
      if (cancelled) {
        return
      }

      if (!result.ok) {
        setResolvedTask(null)
        setDetailError(TASK_IDENTITY_UNRESOLVED_MESSAGE)
        setDetailLoading(false)
        return
      }

      setResolvedTask(result.task)
      setDetailLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, taskId, loadedTask, companyId])

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

  function handleRetryDetailLoad() {
    if (!taskId) {
      return
    }

    setDetailLoading(true)
    setDetailError(null)

    void loadLiveCompanyTask(taskId, companyId, {
      loadedTask: loadedTask,
      loadLiveTask: getLiveTaskByCompanyAndId,
    }).then((result) => {
      if (!result.ok) {
        setResolvedTask(null)
        setDetailError(TASK_IDENTITY_UNRESOLVED_MESSAGE)
        setDetailLoading(false)
        return
      }

      setResolvedTask(result.task)
      setDetailLoading(false)
    })
  }

  const task = resolvedTask
  const supervisorActionsDisabled =
    !canReview || isPending || detailLoading || Boolean(detailError) || !task

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl"
          data-testid="project-task-closure-review-sheet"
        >
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Revisar cierre de orden de trabajo</SheetTitle>
            <SheetDescription>
              Revise la ejecución de la OT de obra y apruebe o solicite
              corrección.
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
            ) : task && detail ? (
              <PlanningPendingClosureDetailPanel
                task={task}
                detail={detail}
                crewLabel={task.crew?.trim() || "—"}
                operatorLabel={resolveTaskCrewOperatorLabel(task, crews)}
              />
            ) : detailError ? null : (
              <p className="text-sm text-muted-foreground">
                {PLANNING_PENDING_CLOSURE_DETAIL_LOAD_ERROR}
              </p>
            )}
          </div>

          {task && canReview ? (
            <SheetFooter
              className="shrink-0 border-t bg-background px-6 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2"
              data-testid="project-task-closure-review-actions"
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
                  if (!task) {
                    return
                  }

                  void runAction(async () => {
                    const result = await approveTask(task.id, { task })
                    if (result.success) {
                      onReviewCompleted?.()
                      onOpenChange(false)
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
          if (!task) {
            return
          }

          const result = await runAction(() =>
            rejectTask(task.id, reason, { task })
          )

          if (result?.success) {
            setRejectOpen(false)
            onReviewCompleted?.()
            onOpenChange(false)
          }
        }}
      />
    </>
  )
}
