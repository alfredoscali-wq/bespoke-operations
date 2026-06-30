"use client"

import { useState } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useOperario } from "@/components/operario/operario-provider"
import {
  OperarioCrewEmptyState,
  OperarioCrewStatusMessage,
} from "@/components/operario/operario-crew-status-message"
import { OperationalStepsPanel } from "@/components/operario/operational-steps-panel"
import { OperarioTaskClosureFooter } from "@/components/operario/operario-task-closure-footer"
import {
  OperarioTaskClientCard,
  OperarioTaskCrewNotes,
  OperarioTaskLocationCard,
  OperarioTaskReferencePhotos,
  OperarioTaskServiceInfoCard,
} from "@/components/operario/operario-task-field-sections"
import { isOperarioWorkerTaskAccessible } from "@/lib/data/operario"
import { OperarioFtthInstallationCard } from "@/components/operario/operario-ftth-installation-card"
import { resolveOperarioExecutionOrderHeader } from "@/lib/planificacion/planning-execution-order"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import { taskRequiresFtthInstallation } from "@/lib/tasks/ftth-installation"
import { getTaskTechnologyLabel } from "@/lib/tasks/commercial-plan"
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
} from "@/lib/tasks/constants"
import { isIncidentStatus } from "@/lib/tasks/incidents"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { getWorkOrderServiceTypeLabel } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type OperarioTaskDetailScreenProps = {
  id: string
}

export function OperarioTaskDetailScreen({ id }: OperarioTaskDetailScreenProps) {
  const {
    workerCrewRef,
    crewStatus,
    assignedCrewNames,
    isCrewReady,
  } = useOperario()
  const { getTask } = useTasks()
  const { isReadOnly } = useDemoMode()
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stepsRefreshKey, setStepsRefreshKey] = useState(0)

  if (!isCrewReady || crewStatus === "loading") {
    return (
      <div className="space-y-3 px-4 pt-3 pb-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-9 gap-2 text-muted-foreground"
          asChild
        >
          <Link href="/operario/tareas">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <OperarioCrewEmptyState crewStatus="loading" />
      </div>
    )
  }

  if (crewStatus === "unassigned") {
    return (
      <div className="space-y-3 px-4 pt-3 pb-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-9 gap-2 text-muted-foreground"
          asChild
        >
          <Link href="/operario/tareas">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <OperarioCrewStatusMessage crewStatus={crewStatus} />
        <OperarioCrewEmptyState crewStatus={crewStatus} />
      </div>
    )
  }

  const task = getTask(id)

  if (!task) {
    notFound()
  }

  if (!isOperarioWorkerTaskAccessible(task, workerCrewRef)) {
    notFound()
  }

  const activeTask = task as Task
  const serviceTypeTitle =
    getWorkOrderServiceTypeLabel(activeTask.serviceType) ?? activeTask.title
  const technologyLabel = getTaskTechnologyLabel(activeTask)
  const usesOperationalSteps = hasOperationalSteps(activeTask)
  const actionsDisabled =
    isReadOnly ||
    isPendingClosureStatus(activeTask.status) ||
    isIncidentStatus(activeTask.status)
  const showFooter =
    !isReadOnly &&
    (activeTask.status === "asignada" ||
    activeTask.status === "en-curso" ||
    isIncidentStatus(activeTask.status) ||
    isPendingClosureStatus(activeTask.status))
  const rejectionReason = activeTask.rejectionReason?.trim()
  const executionOrderHeader = resolveOperarioExecutionOrderHeader(
    activeTask.executionOrder
  )

  return (
    <div
      className={cn(
        "space-y-3 px-4 pt-3",
        showFooter ? "pb-44" : "pb-6"
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-9 gap-2 text-muted-foreground"
        asChild
      >
        <Link href="/operario/tareas">
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      </Button>

      <OperarioCrewStatusMessage
        crewStatus={crewStatus}
        primaryCrewName={workerCrewRef.name}
        assignedCrewNames={assignedCrewNames}
      />

      {/* 1. Tipo de trabajo · 2. Badges */}
      <header className="space-y-2">
        <h1 className="text-xl font-bold uppercase leading-tight tracking-wide text-foreground">
          {serviceTypeTitle}
        </h1>
        {executionOrderHeader ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {executionOrderHeader.heading}
            </span>{" "}
            {executionOrderHeader.text}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-semibold",
              TASK_STATUS_STYLES[activeTask.status]
            )}
          >
            {activeTask.status === "incidencia" ? "🔴 " : ""}
            {activeTask.status === "pendiente-cierre" ? "🟡 " : ""}
            {activeTask.status === "en-curso" ? "🟠 " : ""}
            {activeTask.status === "asignada" ? "🔵 " : ""}
            {activeTask.status === "finalizada" ? "🟢 " : ""}
            {activeTask.status === "cancelada" ? "🔴 " : ""}
            {TASK_STATUS_LABELS[activeTask.status]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-semibold",
              TASK_PRIORITY_STYLES[activeTask.priority]
            )}
          >
            {TASK_PRIORITY_LABELS[activeTask.priority]}
          </Badge>
          {technologyLabel ? (
            <Badge
              variant="outline"
              className="rounded-md px-2 py-0.5 text-xs font-semibold"
            >
              {technologyLabel}
            </Badge>
          ) : null}
        </div>
      </header>

      {actionMessage ? (
        <Alert className="py-2">
          <CheckCircle2 className="size-4" />
          <AlertDescription className="text-sm">{actionMessage}</AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-sm">{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {isIncidentStatus(activeTask.status) ? (
        <Alert className="border-red-200 bg-red-50/80 py-2 dark:border-red-900 dark:bg-red-950/30">
          <AlertDescription className="space-y-0.5 text-red-900 dark:text-red-100">
            <p className="text-sm font-semibold">🔴 Incidencia reportada</p>
            <p className="text-xs">
              El supervisor revisará el caso y definirá los próximos pasos.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {actionsDisabled && isPendingClosureStatus(activeTask.status) ? (
        <Alert className="border-amber-200 bg-amber-50/80 py-2 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertDescription className="space-y-0.5 text-amber-900 dark:text-amber-100">
            <p className="text-sm font-semibold">🟡 Pendiente de cierre</p>
            <p className="text-xs">
              El supervisor debe cerrar la orden de trabajo desde el panel administrativo.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {activeTask.status === "en-curso" && rejectionReason ? (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="size-4" />
          <AlertDescription className="space-y-0.5">
            <p className="text-sm font-semibold">⚠ Cierre rechazado</p>
            <p className="text-xs whitespace-pre-wrap">
              Motivo:
              <br />
              {rejectionReason}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* 3. Cliente · 4. Dirección · 5. Información del servicio */}
      <div className="space-y-2">
        <OperarioTaskClientCard task={activeTask} />
        <OperarioTaskLocationCard task={activeTask} />
        <OperarioTaskServiceInfoCard task={activeTask} />
      </div>

      {/* 6. Observaciones */}
      <OperarioTaskCrewNotes task={activeTask} />

      <OperarioTaskReferencePhotos taskId={activeTask.id} />

      {taskRequiresFtthInstallation(activeTask) ? (
        <OperarioFtthInstallationCard
          task={activeTask}
          actionsDisabled={actionsDisabled}
          onSaved={() => setStepsRefreshKey((value) => value + 1)}
        />
      ) : null}

      {usesOperationalSteps ? (
        <OperationalStepsPanel
          task={activeTask}
          refreshKey={stepsRefreshKey}
          actionsDisabled={actionsDisabled}
          onProgressChange={() => setStepsRefreshKey((value) => value + 1)}
        />
      ) : (
        <section className="rounded-xl border border-dashed bg-card/60 p-3 text-center text-sm text-muted-foreground">
          Esta orden usa el flujo operativo anterior. Contacte a supervisión
          para completarla.
        </section>
      )}

      {/* 7. Botón principal — fijo al final */}
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
