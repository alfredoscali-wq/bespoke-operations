"use client"

import { useEffect, useState } from "react"
import { ClipboardCheck, Loader2, Play } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { getOperationalStepPhotoCounts, getTaskEvidencePhotoCount } from "@/lib/supabase/task-photos.browser"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
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
  const { getTask, startTask, submitTaskForApproval } = useTasks()
  const task = getTask(initialTask.id) ?? initialTask
  const usesSteps = hasOperationalSteps(task)

  const [stepPhotoCounts, setStepPhotoCounts] = useState<Record<string, number>>(
    {}
  )
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [isPending, setIsPending] = useState(false)

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
  const showRequestClosure = task.status === "en-curso"
  const pendingClosure = isPendingClosureStatus(task.status)

  if (pendingClosure) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t border-orange-200 bg-orange-50/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-orange-50/90 dark:border-orange-900 dark:bg-orange-950/90">
        <div className="mx-auto max-w-lg space-y-1">
          <p className="text-base font-semibold text-orange-900 dark:text-orange-100">
            🟠 Trabajo enviado
          </p>
          <p className="text-sm text-orange-800 dark:text-orange-200">
            Pendiente de validación del supervisor.
          </p>
        </div>
      </div>
    )
  }

  if (!showStart && !showRequestClosure) {
    return null
  }

  async function handleStartTask() {
    onActionError?.(null)
    onActionMessage?.(null)
    setIsPending(true)

    const result = await startTask(task.id)
    setIsPending(false)

    if (!result.success) {
      onActionError?.(result.message ?? "No se pudo iniciar la tarea.")
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

    onActionMessage?.("Trabajo enviado. Pendiente de validación de cierre.")
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="mx-auto max-w-lg space-y-2">
        {showRequestClosure && closureBlocked ? (
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
            Iniciar tarea
          </Button>
        ) : null}

        {showRequestClosure ? (
          <Button
            type="button"
            size="lg"
            className="h-14 w-full gap-2 rounded-2xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
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
        ) : null}
      </div>
    </div>
  )
}
