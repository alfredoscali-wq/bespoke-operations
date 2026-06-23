"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Ban,
  Eye,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  canArchiveTaskByStatus,
  isCancellableTaskStatus,
} from "@/lib/tasks/status-groups"
import {
  TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE,
  TASK_DELETE_USER_MESSAGE,
} from "@/lib/operations/user-messages"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import {
  TaskCrewAssignDialog,
  TaskEditDialog,
  TaskStatusDialog,
} from "@/components/tareas/task-action-dialogs"
import type { Task } from "@/lib/types/tasks"
import {
  resolveCrewSnapshotsForAssignment,
} from "@/lib/tasks/crew-relation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type TaskRowActionsProps = {
  task: Task
  onFeedback: (input: {
    variant: "success" | "error"
    message: string
  }) => void
  triggerClassName?: string
  operationalMode?: boolean
}

export function TaskRowActions({
  task,
  onFeedback,
  triggerClassName,
  operationalMode = false,
}: TaskRowActionsProps) {
  const { editTask, changeTaskStatus, deleteTask, assignCrew, cancelTask } =
    useTasks()
  const { getCrew } = useCrews()
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [crewOpen, setCrewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const canCancel = isCancellableTaskStatus(task.status)
  const canArchive = canArchiveTaskByStatus(task.status)
  const hideInternalStatusActions =
    operationalMode || isWorkOrderTask(task)

  async function handleEdit(payload: {
    title: string
    description: string
    type: Task["type"]
    priority: Task["priority"]
    supervisor: string
    crewId: string
    crew: string
    startDate: string
    dueDate: string
    estimatedDuration: string
  }) {
    const selectedCrew = getCrew(payload.crewId)
    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

    const result = await editTask(task.id, {
      title: payload.title,
      description: payload.description,
      type: payload.type,
      priority: payload.priority,
      dueDate: payload.dueDate,
      startDate: payload.startDate,
      estimatedDuration: payload.estimatedDuration,
      supervisor: payload.supervisor,
      crewId: snapshots.crewId ?? payload.crewId,
      crew: snapshots.crew || payload.crew,
    })

    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la tarea.")
    }

    onFeedback({
      variant: "success",
      message: "Tarea actualizada correctamente.",
    })
  }

  async function handleStatusChange(status: Task["status"]) {
    const result = await changeTaskStatus(task.id, status)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo cambiar el estado.")
    }
    onFeedback({
      variant: "success",
      message: "Estado de la tarea actualizado.",
    })
  }

  async function handleCrewAssign(crewId: string) {
    const selectedCrew = getCrew(crewId)
    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)
    const result = await assignCrew(
      task.id,
      snapshots.crewId,
      snapshots.crew,
      snapshots.supervisor
    )
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo reasignar la cuadrilla.")
    }
    onFeedback({
      variant: "success",
      message: "Cuadrilla reasignada correctamente.",
    })
  }

  async function handleCancelTask() {
    setIsCancelling(true)
    const result = await cancelTask(task.id)
    setIsCancelling(false)

    if (!result.success) {
      onFeedback({
        variant: "error",
        message: result.message ?? "No se pudo cancelar la tarea.",
      })
      return
    }

    onFeedback({
      variant: "success",
      message: "Tarea cancelada correctamente.",
    })
  }

  async function handleConfirmDelete() {
    logDeleteTrace("ui.task-row-actions.handleConfirmDelete", {
      entity: "task",
      id: task.id,
      code: task.code,
    })

    setIsDeleting(true)
    const result = await deleteTask(task.id)
    setIsDeleting(false)

    if (!result.success) {
      onFeedback({
        variant: "error",
        message: result.message ?? TASK_DELETE_USER_MESSAGE,
      })
      return
    }

    setDeleteOpen(false)
    onFeedback({
      variant: "success",
      message: "Tarea eliminada correctamente.",
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={triggerClassName ?? "size-8"}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/tareas/${task.id}`}>
              <Eye className="size-4" />
              Ver detalle
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            {hideInternalStatusActions ? "Editar orden" : "Editar tarea"}
          </DropdownMenuItem>
          {!hideInternalStatusActions && (
            <DropdownMenuItem onClick={() => setStatusOpen(true)}>
              <RefreshCw className="size-4" />
              Cambiar estado
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setCrewOpen(true)}>
            <Users className="size-4" />
            Reasignar cuadrilla
          </DropdownMenuItem>
          {canCancel && (
            <DropdownMenuItem
              onClick={handleCancelTask}
              disabled={isCancelling}
            >
              <Ban className="size-4" />
              Cancelar tarea
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={!canArchive}
          >
            <Trash2 className="size-4" />
            Eliminar tarea
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        task={task}
        onSubmit={handleEdit}
      />

      <TaskStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        task={task}
        onSubmit={handleStatusChange}
      />

      <TaskCrewAssignDialog
        open={crewOpen}
        onOpenChange={setCrewOpen}
        task={task}
        onSubmit={handleCrewAssign}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar tarea</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta tarea?
              <span className="font-medium text-foreground"> {task.title}</span>
              {!canArchive && (
                <span className="mt-2 block text-destructive">
                  {TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting || !canArchive}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
