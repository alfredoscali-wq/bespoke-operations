"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, MoreHorizontal } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getCrewsForTaskSelection,
  isCrewAssignable,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import { TaskOverviewTab } from "@/components/tareas/task-tabs/overview-tab"
import { TaskOperationalWorkflowActions } from "@/components/tareas/task-operational-workflow-actions"
import { TaskClosureRejectDialog } from "@/components/tareas/task-closure-reject-dialog"
import { TaskIncidentCancelDialog } from "@/components/tareas/task-incident-cancel-dialog"
import { TaskEvidencePhotosGallery } from "@/components/tareas/task-evidence-photos-gallery"
import { TaskChecklistTab } from "@/components/tareas/task-tabs/checklist-tab"
import { TaskEvidenceTab } from "@/components/tareas/task-tabs/evidence-tab"
import { TaskOperationalStepsTab } from "@/components/tareas/task-tabs/operational-steps-tab"
import { TaskCommentsTab } from "@/components/tareas/task-tabs/comments-tab"
import { TaskHistoryTab } from "@/components/tareas/task-tabs/history-tab"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { canAssignWorkOrderCrew, canCloseWorkOrder } from "@/lib/tasks/task-closure-permissions"
import { isCancellableTaskStatus, isFinalTaskStatus } from "@/lib/tasks/status-groups"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import type { Task, TaskDetail } from "@/lib/types/tasks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type TaskDetailViewProps = {
  task: Task
  detail: TaskDetail
}

export function TaskDetailView({ task, detail }: TaskDetailViewProps) {
  const { crews, getCrew } = useCrews()
  const { assignCrew, approveTask, rejectTask, cancelTask, resumeTaskFromIncident, rescheduleTaskFromIncident, rescheduleTaskFromOverdue } = useTasks()
  const { sessionUser } = useAuth()
  const actorName = resolveAuthDisplay(sessionUser).displayName
  const crewDisplayName = useMemo(
    () => resolveTaskCrewDisplayName(task, getCrew),
    [task, getCrew]
  )
  const crewOptions = useMemo(
    () => getCrewsForTaskSelection(crews, task.crewId),
    [crews, task.crewId]
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const [crewError, setCrewError] = useState<string | null>(null)
  const [isAssigningCrew, setIsAssigningCrew] = useState(false)
  const [isWorkflowActionPending, setIsWorkflowActionPending] = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  async function handleCrewChange(value: string) {
    setCrewError(null)
    setIsAssigningCrew(true)

    if (value === "none") {
      const result = await assignCrew(task.id, null, "", "")
      setIsAssigningCrew(false)
      if (!result.success) {
        setCrewError(result.message ?? "No se pudo quitar la cuadrilla.")
      }
      return
    }

    const crew = crews.find((item) => item.id === value)
    const validation = validateCrewAssignment(crew)
    if (!validation.allowed) {
      setIsAssigningCrew(false)
      setCrewError(validation.message ?? "No se pudo asignar la cuadrilla.")
      return
    }

    const result = await assignCrew(
      task.id,
      value,
      crew?.name ?? "",
      crew?.supervisor ?? ""
    )
    setIsAssigningCrew(false)

    if (!result.success) {
      setCrewError(result.message ?? "No se pudo asignar la cuadrilla.")
    }
  }

  async function handleCloseWorkOrder() {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await approveTask(task.id)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo cerrar la orden de trabajo.")
      return
    }

    setActionSuccess("Orden de trabajo cerrada y finalizada.")
  }

  async function handleConfirmReject(reason: string) {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await rejectTask(task.id, reason)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo rechazar el cierre.")
      return
    }

    setRejectDialogOpen(false)
    setActionSuccess("Cierre rechazado. La orden de trabajo volvió a En curso.")
  }

  async function handleResumeFromIncident() {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await resumeTaskFromIncident(task.id, actorName)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo reanudar la orden de trabajo.")
      return
    }

    setActionSuccess("Orden de trabajo reanudada. Volvió a En curso.")
  }

  async function handleRescheduleFromIncident(input: TaskRescheduleInput) {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await rescheduleTaskFromIncident(task.id, {
      ...input,
      actor: actorName,
    })
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo reprogramar la orden de trabajo.")
      return
    }

    setActionSuccess("Orden de trabajo reprogramada. Quedó en estado Asignada.")
  }

  async function handleRescheduleFromOverdue(input: TaskRescheduleInput) {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await rescheduleTaskFromOverdue(task.id, {
      ...input,
      actor: actorName,
    })
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo reprogramar la orden de trabajo.")
      return
    }

    setActionSuccess("Orden de trabajo reprogramada. Quedó en estado Asignada.")
  }

  async function handleConfirmCancel(input: {
    reason: string
    observation: string
  }) {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await cancelTask(task.id, {
      reason: input.reason,
      observation: input.observation,
      actor: actorName,
    })
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo cancelar la orden de trabajo.")
      return
    }

    setActionSuccess("Orden de trabajo cancelada correctamente.")
  }

  const canCancel = isCancellableTaskStatus(task.status)
  const pendingClosure = isPendingClosureStatus(task.status)
  const hasIncident = task.status === "incidencia"
  const hasOverdue = task.status === "vencida"
  const canCloseOt = canCloseWorkOrder(sessionUser?.systemRole)
  const canAssignCrew = canAssignWorkOrderCrew(sessionUser?.systemRole)
  const usesOperationalSteps = hasOperationalSteps(task)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 text-muted-foreground"
            asChild
          >
            <Link href="/tareas">
              <ArrowLeft className="size-4" />
              Volver a órdenes de trabajo
            </Link>
          </Button>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-primary">
                {task.code}
              </span>
              <TaskOperationBadge task={task} />
              <TaskTypeBadge type={task.type} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {task.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <TaskStatusBadge status={task.status} className="px-3 py-1 text-sm" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isFieldServiceTask(task)
                ? [
                    task.customerCompany,
                    task.workOrderNumber,
                    crewDisplayName,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : [
                    task.projectCode,
                    crewDisplayName,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canAssignCrew ? (
            <Select
              value={task.crewId ?? "none"}
              onValueChange={handleCrewChange}
              disabled={isAssigningCrew || isFinalTaskStatus(task.status)}
            >
              <SelectTrigger className="h-9 w-[200px] bg-background">
                <SelectValue placeholder="Cuadrilla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuadrilla</SelectItem>
                {crewOptions.map((crew) => (
                  <SelectItem
                    key={crew.id}
                    value={crew.id}
                    disabled={
                      !isCrewAssignable(crew) && crew.id !== task.crewId
                    }
                  >
                    {crew.name}
                    {!isCrewAssignable(crew) ? " (inactiva)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex h-9 min-w-[200px] items-center rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground">
              {crewDisplayName}
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Acciones
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Exportar Orden de Trabajo</DropdownMenuItem>
              <DropdownMenuItem>Duplicar Orden de Trabajo</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {crewError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{crewError}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {actionSuccess && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{actionSuccess}</AlertDescription>
        </Alert>
      )}

      <TaskOperationalWorkflowActions
        task={task}
        rescheduledBy={actorName}
        canClose={canCloseOt}
        onClose={pendingClosure ? handleCloseWorkOrder : undefined}
        onReject={
          pendingClosure && canCloseOt ? () => setRejectDialogOpen(true) : undefined
        }
        onResume={hasIncident ? handleResumeFromIncident : undefined}
        onReschedule={
          hasIncident
            ? handleRescheduleFromIncident
            : hasOverdue
              ? handleRescheduleFromOverdue
              : undefined
        }
        onCancelIncident={hasIncident ? handleConfirmCancel : undefined}
        isPending={isWorkflowActionPending}
      />

      <TaskClosureRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleConfirmReject}
        isSubmitting={isWorkflowActionPending}
      />

      {canCancel && (
        <>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              disabled={isWorkflowActionPending}
            >
              Cancelar Orden de Trabajo
            </Button>
          </div>

          <TaskIncidentCancelDialog
            open={cancelDialogOpen}
            onOpenChange={setCancelDialogOpen}
            onConfirm={async (input) => {
              await handleConfirmCancel(input)
              setCancelDialogOpen(false)
            }}
            isSubmitting={isWorkflowActionPending}
          />
        </>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            {usesOperationalSteps ? (
              <TabsTrigger value="operational-steps">
                Pasos Operativos
              </TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="evidence">Evidencias</TabsTrigger>
              </>
            )}
            <TabsTrigger value="comments">Comentarios</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <TaskOverviewTab task={task} />
        </TabsContent>
        {usesOperationalSteps ? (
          <TabsContent value="operational-steps">
            <TaskOperationalStepsTab task={task} />
          </TabsContent>
        ) : (
          <>
            <TabsContent value="checklist">
              <TaskChecklistTab task={task} />
            </TabsContent>
            <TabsContent value="evidence">
              <TaskEvidenceTab task={task} />
            </TabsContent>
          </>
        )}
        <TabsContent value="comments">
          <TaskCommentsTab comments={detail.comments} />
        </TabsContent>
        <TabsContent value="history">
          <TaskHistoryTab history={detail.history} />
        </TabsContent>
      </Tabs>

      {usesOperationalSteps ? (
        <TaskEvidencePhotosGallery
          taskId={task.id}
          title="Evidencias Operativas"
        />
      ) : null}
    </div>
  )
}
