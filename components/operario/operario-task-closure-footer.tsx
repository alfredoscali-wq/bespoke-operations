"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ClipboardCheck, Loader2, Play } from "lucide-react"

import { useOperario } from "@/components/operario/operario-provider"
import { OperarioTaskIncidentDialog } from "@/components/operario/operario-task-incident-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import { getOperationalStepPhotoCounts, getTaskEvidencePhotoCount } from "@/lib/supabase/task-photos.browser"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import { isIncidentStatus } from "@/lib/tasks/incidents"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { validateTaskClosureForSubmit } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"

type OperarioTaskClosureFooterProps = {
  task: Task
  stepsRefreshKey?: number
  onActionMessage?: (message: string | null) => void
  onActionError?: (message: string | null) => void
}

export function OperarioTaskClosureFooter({
  task: initialTask,
  stepsRefreshKey = 0,
  onActionMessage,
  onActionError,
}: OperarioTaskClosureFooterProps) {
  const { identity } = useOperario()
  const { getTask, startTask, submitTaskForApproval, reportTaskIncident } =
    useTasks()
  const task = getTask(initialTask.id) ?? initialTask
  const usesSteps = hasOperationalSteps(task)

  const [stepPhotoCounts, setStepPhotoCounts] = useState<Record<string, number>>(
    {}
  )
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [isPending, setIsPending] = useState(false)
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false)

  useEffect(() => {
    if (usesSteps) {
      let cancelled = false

      async function loadStepCounts() {
        const result = await getOperationalStepPhotoCounts(task.id)
        if (cancelled) return
        setStepPhotoCounts(result.data ?? {})
      }

      void loadStepCounts()

      return () => {
        cancelled = true
      }
    }

    let cancelled = false

    async function loadEvidenceCount() {
      const result = await getTaskEvidencePhotoCount(task.id)
      if (cancelled) return
      setEvidenceCount(result.data ?? 0)
    }

    void loadEvidenceCount()

    return () => {
      cancelled = true
    }
  }, [task.id, usesSteps, stepsRefreshKey])

  const closureValidation = validateTaskClosureForSubmit(task, {
    evidenceCount,
    stepPhotoCounts,
  })
  const closureBlocked = !closureValidation.allowed
  const showStart = task.status === "asignada"
  const showInProgressActions = task.status === "en-curso"
  const pendingClosure = isPendingClosureStatus(task.status)
  const hasIncident = isIncidentStatus(task.status)
  const hasOverdue = task.status === "vencida"

  if (hasOverdue) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-red-200 bg-red-50/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-red-50/90 dark:border-red-900 dark:bg-red-950/90">
        <div className="mx-auto max-w-lg space-y-1">
          <p className="text-base font-semibold text-red-900 dark:text-red-100">
            🔴 OT vencida
          </p>
          <p className="text-sm text-red-800 dark:text-red-200">
            Debe reprogramarse antes de iniciar la orden de trabajo.
          </p>
        </div>
      </div>
    )
  }

  if (pendingClosure) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-amber-200 bg-amber-50/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/90">
        <div className="mx-auto max-w-lg space-y-1">
          <p className="text-base font-semibold text-amber-900 dark:text-amber-100">
            🟡 Pendiente de cierre
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            El supervisor debe cerrar la OT desde BackOffice.
          </p>
        </div>
      </div>
    )
  }

  if (hasIncident) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-red-200 bg-red-50/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-red-50/90 dark:border-red-900 dark:bg-red-950/90">
        <div className="mx-auto max-w-lg space-y-1">
          <p className="text-base font-semibold text-red-900 dark:text-red-100">
            🔴 Incidencia reportada
          </p>
          <p className="text-sm text-red-800 dark:text-red-200">
            El supervisor revisará el caso y definirá los próximos pasos.
          </p>
        </div>
      </div>
    )
  }

  if (!showStart && !showInProgressActions) {
    return null
  }

  async function handleStartTask() {
    onActionError?.(null)
    onActionMessage?.(null)
    setIsPending(true)

    const result = await startTask(task.id)
    setIsPending(false)

    if (!result.success) {
      onActionError?.(result.message ?? "No se pudo iniciar la orden de trabajo.")
      return
    }

    onActionMessage?.("Trabajo iniciado.")
  }

  async function handleRequestClosure() {
    onActionError?.(null)
    onActionMessage?.(null)

    if (!closureValidation.allowed) {
      onActionError?.(
        closureValidation.message ?? "No se puede enviar a validación."
      )
      return
    }

    setIsPending(true)
    const result = await submitTaskForApproval(task.id)
    setIsPending(false)

    if (!result.success) {
      onActionError?.(result.message ?? "No se pudo enviar a validación.")
      return
    }

    onActionMessage?.("Trabajo enviado. Pendiente de cierre por supervisor.")
  }

  async function handleReportIncident(input: {
    reason: string
    observation: string
  }) {
    onActionError?.(null)
    onActionMessage?.(null)
    setIsPending(true)

    const result = await reportTaskIncident(task.id, {
      reason: input.reason,
      observation: input.observation,
      reportedBy: identity.displayName,
    })
    setIsPending(false)

    if (!result.success) {
      onActionError?.(result.message ?? "No se pudo reportar la incidencia.")
      return
    }

    setIncidentDialogOpen(false)
    onActionMessage?.("Incidencia reportada. El supervisor revisará el caso.")
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="mx-auto max-w-lg space-y-2">
          {showInProgressActions && closureBlocked ? (
            <p className="text-center text-sm text-muted-foreground">
              {closureValidation.message}
            </p>
          ) : null}

          {showStart ? (
            <Button
              type="button"
              size="lg"
              className="h-14 w-full gap-2 rounded-2xl text-base font-semibold"
              onClick={handleStartTask}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Play className="size-5" />
              )}
              Iniciar Orden de Trabajo
            </Button>
          ) : null}

          {showInProgressActions ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                size="lg"
                className="h-14 gap-2 rounded-2xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                onClick={handleRequestClosure}
                disabled={isPending || closureBlocked}
              >
                {isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ClipboardCheck className="size-5" />
                )}
                Solicitar cierre
              </Button>
              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="h-14 gap-2 rounded-2xl text-base font-semibold"
                onClick={() => setIncidentDialogOpen(true)}
                disabled={isPending}
              >
                <AlertTriangle className="size-5" />
                Reportar incidencia
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <OperarioTaskIncidentDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        onConfirm={handleReportIncident}
        isSubmitting={isPending}
      />
    </>
  )
}
