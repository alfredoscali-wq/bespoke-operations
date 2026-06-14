"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, MoreHorizontal } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskOverviewTab } from "@/components/tareas/task-tabs/overview-tab"
import { TaskChecklistTab } from "@/components/tareas/task-tabs/checklist-tab"
import { TaskEvidenceTab } from "@/components/tareas/task-tabs/evidence-tab"
import { TaskCommentsTab } from "@/components/tareas/task-tabs/comments-tab"
import { TaskHistoryTab } from "@/components/tareas/task-tabs/history-tab"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"
import type { Task, TaskDetail, TaskStatus } from "@/lib/types/tasks"
import {
  TASK_STATUS_OPTIONS,
} from "@/lib/tasks/constants"
import { canMoveToStatus, isFieldServiceTask } from "@/lib/tasks/utils"
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
  const { crews } = useCrews()
  const { updateTaskStatus, assignCrew } = useTasks()
  const [statusError, setStatusError] = useState<string | null>(null)
  const [crewError, setCrewError] = useState<string | null>(null)
  const [isAssigningCrew, setIsAssigningCrew] = useState(false)

  function handleStatusChange(newStatus: TaskStatus) {
    const result = updateTaskStatus(task.id, newStatus)
    if (!result.success) {
      setStatusError(result.message ?? "No se pudo actualizar el estado.")
      return
    }
    setStatusError(null)
  }

  async function handleCrewChange(value: string) {
    setCrewError(null)
    setIsAssigningCrew(true)

    if (value === "none") {
      const result = await assignCrew(task.id, null, "")
      setIsAssigningCrew(false)
      if (!result.success) {
        setCrewError(result.message ?? "No se pudo quitar la cuadrilla.")
      }
      return
    }

    const crew = crews.find((item) => item.id === value)
    const result = await assignCrew(task.id, value, crew?.name ?? "")
    setIsAssigningCrew(false)

    if (!result.success) {
      setCrewError(result.message ?? "No se pudo asignar la cuadrilla.")
    }
  }

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
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {task.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isFieldServiceTask(task)
                ? [
                    task.customerCompany,
                    task.workOrderNumber,
                    task.crew || "Sin cuadrilla",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : [
                    task.projectCode,
                    task.crew || "Sin cuadrilla",
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
            disabled={isAssigningCrew}
          >
            <SelectTrigger className="h-9 w-[200px] bg-background">
              <SelectValue placeholder="Cuadrilla" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin cuadrilla</SelectItem>
              {crews.map((crew) => (
                <SelectItem key={crew.id} value={crew.id}>
                  {crew.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-9 w-[180px] bg-background">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUS_OPTIONS.map((option) => {
                const validation = canMoveToStatus(task, option.value)
                return (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={
                      !validation.allowed && option.value !== task.status
                    }
                  >
                    {option.label}
                  </SelectItem>
                )
              })}
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

      {statusError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      )}

      {!canMoveToStatus(task, "finalizada").allowed && task.status !== "cerrada" && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {canMoveToStatus(task, "finalizada").message}
          </AlertDescription>
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
          <TaskEvidenceTab taskId={task.id} />
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
