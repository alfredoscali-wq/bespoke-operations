"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, ClipboardCheck, Play } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getOperationalStepPhotoCounts,
  getTaskEvidencePhotoCount,
} from "@/lib/supabase/task-photos.browser"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { validateTaskClosureForSubmit } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskOperationalWorkflowActionsProps = {
  task: Task
  variant?: "default" | "operario"
  evidenceCount?: number
  stepsRefreshKey?: number
  className?: string
  showTitle?: boolean
  onActionMessage?: (message: string | null) => void
  onActionError?: (message: string | null) => void
}

export function TaskOperationalWorkflowActions({
  task: initialTask,
  variant = "default",
  evidenceCount: controlledEvidenceCount,
  stepsRefreshKey = 0,
  className,
  showTitle = true,
  onActionMessage,
  onActionError,
}: TaskOperationalWorkflowActionsProps) {
  const { getTask, startTask, submitTaskForApproval, detailVersion } = useTasks()
  const task = getTask(initialTask.id) ?? initialTask
  const usesSteps = hasOperationalSteps(task)

  const [evidenceCount, setEvidenceCount] = useState(controlledEvidenceCount ?? 0)
  const [stepPhotoCounts, setStepPhotoCounts] = useState<Record<string, number>>({})
  const [isPending, setIsPending] = useState(false)
  const [internalMessage, setInternalMessage] = useState<string | null>(null)
  const [internalError, setInternalError] = useState<string | null>(null)

  useEffect(() => {
    if (usesSteps) {
      if (controlledEvidenceCount !== undefined) {
        return
      }

      let cancelled = false

      async function loadStepPhotoCounts() {
        const result = await getOperationalStepPhotoCounts(task.id)
        if (cancelled) return
        setStepPhotoCounts(result.data ?? {})
      }

      void loadStepPhotoCounts()

      return () => {
        cancelled = true
      }
    }

    if (controlledEvidenceCount !== undefined) {
      setEvidenceCount(controlledEvidenceCount)
      return
    }

    if (task.status !== "en-curso") {
      return
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
  }, [
    controlledEvidenceCount,
    detailVersion,
    stepsRefreshKey,
    task.id,
    task.status,
    usesSteps,
  ])

  const closureValidation = validateTaskClosureForSubmit(task, {
    evidenceCount,
    stepPhotoCounts,
  })
  const closureBlocked = !closureValidation.allowed
  const showStart = task.status === "asignada"
  const showRequestClosure = task.status === "en-curso"
  const hasActions = showStart || showRequestClosure

  function setMessage(message: string | null) {
    if (onActionMessage) {
      onActionMessage(message)
      return
    }
    setInternalMessage(message)
  }

  function setError(message: string | null) {
    if (onActionError) {
      onActionError(message)
      return
    }
    setInternalError(message)
  }

  async function handleStartTask() {
    setError(null)
    setMessage(null)
    setIsPending(true)

    const result = await startTask(task.id)
    setIsPending(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo iniciar la tarea.")
      return
    }

    setMessage("Trabajo iniciado.")
  }

  async function handleRequestClosure() {
    setError(null)
    setMessage(null)

    if (!closureValidation.allowed) {
      setError(closureValidation.message ?? "No se puede enviar a validación.")
      return
    }

    setIsPending(true)
    const result = await submitTaskForApproval(task.id)
    setIsPending(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo enviar a validación.")
      return
    }

    setMessage("Trabajo enviado. Pendiente de validación de cierre.")
  }

  if (!hasActions && variant === "default") {
    return null
  }

  const content = (
    <div className={cn("space-y-3", className)}>
      {showTitle && variant === "default" ? (
        <p className="text-sm text-muted-foreground">
          Estado actual:{" "}
          <span className="font-medium text-foreground">
            {TASK_STATUS_LABELS[task.status]}
          </span>
        </p>
      ) : null}

      {onActionMessage == null && internalMessage ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{internalMessage}</AlertDescription>
        </Alert>
      ) : null}

      {onActionError == null && internalError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{internalError}</AlertDescription>
        </Alert>
      ) : null}

      {closureBlocked && task.status === "en-curso" ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>{closureValidation.message}</AlertDescription>
        </Alert>
      ) : null}

      {variant === "operario" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {showStart ? (
            <Button
              size="lg"
              className="h-16 gap-2 rounded-2xl text-base font-semibold"
              onClick={handleStartTask}
              disabled={isPending}
            >
              <Play className="size-5 shrink-0" />
              Iniciar tarea
            </Button>
          ) : null}

          {showRequestClosure ? (
            <Button
              size="lg"
              className="h-16 gap-2 rounded-2xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
              onClick={handleRequestClosure}
              disabled={isPending || closureBlocked}
            >
              <ClipboardCheck className="size-5 shrink-0" />
              Solicitar cierre
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {showStart ? (
            <Button
              onClick={handleStartTask}
              disabled={isPending}
              className="gap-1.5"
            >
              <Play className="size-4" />
              Iniciar tarea
            </Button>
          ) : null}

          {showRequestClosure ? (
            <Button
              onClick={handleRequestClosure}
              disabled={isPending || closureBlocked}
              className="gap-1.5"
            >
              <ClipboardCheck className="size-4" />
              Solicitar cierre
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )

  if (variant === "operario") {
    return content
  }

  if (!hasActions) {
    return null
  }

  return (
    <Card className="border-blue-200/80 bg-blue-50/30 shadow-sm dark:border-blue-900 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Acciones Operativas</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
