"use client"

import { useState } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useOperario } from "@/components/operario/operario-provider"
import { OperationalStepsPanel } from "@/components/operario/operational-steps-panel"
import { OperarioTaskClosureFooter } from "@/components/operario/operario-task-closure-footer"
import {
  OperarioTaskClientCard,
  OperarioTaskCrewNotes,
  OperarioTaskLocationCard,
  OperarioTaskReferencePhotos,
} from "@/components/operario/operario-task-field-sections"
import { getWorkerTasks, resolveWorkerCrewRef } from "@/lib/data/operario"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES } from "@/lib/tasks/constants"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type OperarioTaskDetailScreenProps = {
  id: string
}

export function OperarioTaskDetailScreen({ id }: OperarioTaskDetailScreenProps) {
  const { worker } = useOperario()
  const { crews } = useCrews()
  const workerCrew = resolveWorkerCrewRef(worker, crews)
  const { tasks, getTask } = useTasks()
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stepsRefreshKey, setStepsRefreshKey] = useState(0)

  const task = getTask(id)

  if (!task) {
    notFound()
  }

  const isAssigned = getWorkerTasks(tasks, workerCrew).some((item) => item.id === id)
  if (!isAssigned) {
    notFound()
  }

  const activeTask = task as Task
  const usesOperationalSteps = hasOperationalSteps(activeTask)
  const actionsDisabled = isPendingClosureStatus(activeTask.status)
  const showFooter =
    activeTask.status === "asignada" ||
    activeTask.status === "en-curso" ||
    actionsDisabled

  return (
    <div
      className={cn(
        "space-y-4 px-4 pt-4",
        showFooter ? "pb-44" : "pb-6"
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-10 gap-2 text-muted-foreground"
        asChild
      >
        <Link href="/operario/tareas">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      <header className="space-y-2">
        <p className="font-mono text-sm font-bold text-primary">{activeTask.code}</p>
        <h1 className="text-2xl font-bold leading-snug text-foreground">
          {activeTask.title}
        </h1>
        <Badge
          variant="outline"
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold",
            TASK_STATUS_STYLES[activeTask.status]
          )}
        >
          {activeTask.status === "pendiente-cierre" ? "🟠 " : ""}
          {TASK_STATUS_LABELS[activeTask.status]}
        </Badge>
      </header>

      {actionMessage ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {actionsDisabled ? (
        <Alert className="border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30">
          <AlertDescription className="space-y-1 text-orange-900 dark:text-orange-100">
            <p className="font-semibold">🟠 Trabajo enviado</p>
            <p className="text-sm">
              Pendiente de validación del supervisor.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <OperarioTaskClientCard task={activeTask} />
      <OperarioTaskLocationCard task={activeTask} />
      <OperarioTaskCrewNotes task={activeTask} />
      <OperarioTaskReferencePhotos taskId={activeTask.id} />

      {usesOperationalSteps ? (
        <OperationalStepsPanel
          task={activeTask}
          refreshKey={stepsRefreshKey}
          actionsDisabled={actionsDisabled}
          onProgressChange={() => setStepsRefreshKey((value) => value + 1)}
        />
      ) : (
        <section className="rounded-2xl border border-dashed bg-card/60 p-4 text-center text-sm text-muted-foreground">
          Esta orden usa el flujo operativo anterior. Contacte a supervisión
          para completarla.
        </section>
      )}

      {showFooter ? (
        <OperarioTaskClosureFooter
          task={activeTask}
          stepsRefreshKey={stepsRefreshKey}
          onActionMessage={setActionMessage}
          onActionError={setActionError}
        />
      ) : null}
    </div>
  )
}
