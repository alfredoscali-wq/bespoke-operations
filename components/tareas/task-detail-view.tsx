"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, MoreHorizontal } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getCrewsForTaskSelection,
  isCrewAssignable,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import { TaskOverviewTab } from "@/components/tareas/task-tabs/overview-tab"
import { TaskOperationalWorkflowActions } from "@/components/tareas/task-operational-workflow-actions"
import { TaskClosureRejectDialog } from "@/components/tareas/task-closure-reject-dialog"
import { TaskClosureValidationCard } from "@/components/tareas/task-closure-validation-card"
import { TaskChecklistTab } from "@/components/tareas/task-tabs/checklist-tab"
import { TaskEvidenceTab } from "@/components/tareas/task-tabs/evidence-tab"
import { TaskOperationalStepsTab } from "@/components/tareas/task-tabs/operational-steps-tab"
import { TaskCommentsTab } from "@/components/tareas/task-tabs/comments-tab"
import { TaskHistoryTab } from "@/components/tareas/task-tabs/history-tab"
import { hasOperationalSteps } from "@/lib/operational-steps/utils"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"
import { TaskOperationalCategoryBadge } from "@/components/tareas/task-operational-badge"
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
} from "@/lib/tasks/constants"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import { ACTIVE_TASK_STATUSES, isFinalTaskStatus } from "@/lib/tasks/status-groups"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import type { Task, TaskDetail } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
  const { assignCrew, approveTask, rejectTask, closeTask, cancelTask } = useTasks()
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

  async function handleApprove() {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await approveTask(task.id)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo aprobar la tarea.")
      return
    }

    setActionSuccess("Cierre aprobado. La tarea quedó cerrada.")
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
    setActionSuccess("Cierre rechazado. La tarea volvió a En Curso.")
  }

  async function handleClose() {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await closeTask(task.id)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo cerrar la tarea.")
      return
    }

    setActionSuccess("Tarea cerrada correctamente.")
  }

  async function handleCancel() {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await cancelTask(task.id)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo cancelar la tarea.")
      return
    }

    setActionSuccess("Tarea cancelada correctamente.")
  }

  const canCancel = ACTIVE_TASK_STATUSES.includes(task.status)
  const pendingClosure = isPendingClosureStatus(task.status)
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
              Volver a tareas
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
              {isWorkOrderTask(task) ? (
                <TaskOperationalCategoryBadge
                  task={task}
                  className="px-3 py-1 text-sm"
                />
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-semibold uppercase tracking-wide",
                    TASK_STATUS_STYLES[task.status]
                  )}
                >
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
              )}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Acciones
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Asignar cuadrilla</DropdownMenuItem>
              <DropdownMenuItem>Exportar tarea</DropdownMenuItem>
              <DropdownMenuItem>Duplicar tarea</DropdownMenuItem>
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

      <TaskOperationalWorkflowActions task={task} />

      {pendingClosure && (
        <TaskClosureValidationCard
          task={task}
          onApprove={handleApprove}
          onReject={() => setRejectDialogOpen(true)}
          isPending={isWorkflowActionPending}
        />
      )}

      <TaskClosureRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleConfirmReject}
        isSubmitting={isWorkflowActionPending}
      />

      {task.status === "finalizada" && (
        <Alert className="border-violet-200 bg-violet-50/60">
          <CheckCircle2 className="size-4 text-violet-700" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-foreground">
              La tarea fue aprobada. Cierre administrativo para completar el
              ciclo operativo.
            </span>
            <Button
              size="sm"
              onClick={handleClose}
              disabled={isWorkflowActionPending}
            >
              Cerrar Tarea
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {canCancel && (
        <Alert className="border-red-200 bg-red-50/60">
          <Ban className="size-4 text-red-700" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-foreground">
              Puede cancelar esta tarea si ya no debe ejecutarse en operaciones.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isWorkflowActionPending}
            >
              Cancelar tarea
            </Button>
          </AlertDescription>
        </Alert>
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
    </div>
  )
}
