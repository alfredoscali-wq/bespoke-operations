"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, CheckCircle2, MoreHorizontal } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  getCrewsForTaskSelection,
  isCrewAssignable,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import { TaskOverviewTab } from "@/components/tareas/task-tabs/overview-tab"
import { TaskChecklistTab } from "@/components/tareas/task-tabs/checklist-tab"
import { TaskEvidenceTab } from "@/components/tareas/task-tabs/evidence-tab"
import { TaskCommentsTab } from "@/components/tareas/task-tabs/comments-tab"
import { TaskHistoryTab } from "@/components/tareas/task-tabs/history-tab"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_STYLES,
} from "@/lib/tasks/constants"
import { canPerformTaskAction } from "@/lib/tasks/task-status-workflow"
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
  const { assignCrew, approveTask, rejectTask, closeTask } = useTasks()
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

    setActionSuccess("Tarea aprobada. Ya puede cerrarla administrativamente.")
  }

  async function handleReject() {
    setActionError(null)
    setActionSuccess(null)
    setIsWorkflowActionPending(true)
    const result = await rejectTask(task.id)
    setIsWorkflowActionPending(false)

    if (!result.success) {
      setActionError(result.message ?? "No se pudo rechazar la tarea.")
      return
    }

    setActionSuccess("Tarea devuelta a en curso para correcciones.")
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

  const submitValidation = canPerformTaskAction(task, "submit-for-approval")

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
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-semibold uppercase tracking-wide",
                  TASK_STATUS_STYLES[task.status]
                )}
              >
                {TASK_STATUS_LABELS[task.status]}
              </Badge>
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
            disabled={isAssigningCrew || task.status === "cerrada"}
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

      {task.status === "en-aprobacion" && (
        <Alert className="border-orange-200 bg-orange-50/60">
          <AlertTriangle className="size-4 text-orange-700" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-foreground">
              Esta tarea requiere revisión de supervisión antes de continuar.
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isWorkflowActionPending}
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReject}
                disabled={isWorkflowActionPending}
              >
                Rechazar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

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

      {task.status === "en-curso" && !submitValidation.allowed && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>{submitValidation.message}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="evidence">Evidencias</TabsTrigger>
            <TabsTrigger value="comments">Comentarios</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <TaskOverviewTab task={task} />
        </TabsContent>
        <TabsContent value="checklist">
          <TaskChecklistTab task={task} />
        </TabsContent>
        <TabsContent value="evidence">
          <TaskEvidenceTab task={task} />
        </TabsContent>
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
