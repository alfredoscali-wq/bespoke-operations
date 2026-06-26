"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Ban,
  Eye,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react"

import { PermanentDeleteDialog } from "@/components/admin/permanent-delete-dialog"
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
import { TaskIncidentCancelDialog } from "@/components/tareas/task-incident-cancel-dialog"
import type { Task } from "@/lib/types/tasks"
import { resolveCrewSnapshotsForAssignment } from "@/lib/tasks/crew-relation"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"
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
  const { editTask, changeTaskStatus, deleteTask, assignCrew, cancelTask, removeTaskLocally } =
    useTasks()
  const { getCrew } = useCrews()
  const isSystemAdministrator = useIsSystemAdministrator()
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [crewOpen, setCrewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
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
    scheduledTime?: string | null
    estimatedDuration: string
    contractedPlan?: string | null
    amountToCollect?: number | null
    sharedLocation?: string | null
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
      ...(payload.scheduledTime !== undefined
        ? { scheduledTime: payload.scheduledTime }
        : {}),
      estimatedDuration: payload.estimatedDuration,
      supervisor: payload.supervisor,
      crewId: snapshots.crewId ?? payload.crewId,
      crew: snapshots.crew || payload.crew,
      ...(payload.contractedPlan !== undefined
        ? { contractedPlan: payload.contractedPlan }
        : {}),
      ...(payload.amountToCollect !== undefined
        ? { amountToCollect: payload.amountToCollect }
        : {}),
      ...(payload.sharedLocation !== undefined
        ? { sharedLocation: payload.sharedLocation }
        : {}),
    })

    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la orden de trabajo.")
    }

    onFeedback({
      variant: "success",
      message: "Orden de trabajo actualizada correctamente.",
    })
  }

  async function handleStatusChange(status: Task["status"]) {
    const result = await changeTaskStatus(task.id, status)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo cambiar el estado.")
    }
    onFeedback({
      variant: "success",
      message: "Estado de la orden de trabajo actualizado.",
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

  async function handleConfirmCancel(input: {
    reason: string
    observation: string
  }) {
    setIsCancelling(true)
    const result = await cancelTask(task.id, {
      reason: input.reason,
      observation: input.observation,
    })
    setIsCancelling(false)

    if (!result.success) {
      onFeedback({
        variant: "error",
        message: result.message ?? "No se pudo cancelar la orden de trabajo.",
      })
      return
    }

    onFeedback({
      variant: "success",
      message: "Orden de trabajo cancelada correctamente.",
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
      message: "Orden de trabajo eliminada correctamente.",
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
            {hideInternalStatusActions ? "Editar Orden de Trabajo" : "Editar Orden de Trabajo"}
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
              onClick={() => setCancelOpen(true)}
              disabled={isCancelling}
            >
              <Ban className="size-4" />
              Cancelar Orden de Trabajo
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={!canArchive}
          >
            <Trash2 className="size-4" />
            Eliminar Orden de Trabajo
          </DropdownMenuItem>
          {isSystemAdministrator ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setPermanentDeleteOpen(true)}
              >
                <ShieldAlert className="size-4" />
                Eliminar definitivamente
              </DropdownMenuItem>
            </>
          ) : null}
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

      {canCancel ? (
        <TaskIncidentCancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onConfirm={async (input) => {
            await handleConfirmCancel(input)
            setCancelOpen(false)
          }}
          isSubmitting={isCancelling}
        />
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Orden de Trabajo</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta orden de trabajo?
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

      <PermanentDeleteDialog
        open={permanentDeleteOpen}
        onOpenChange={setPermanentDeleteOpen}
        entityType="task"
        entityId={task.id}
        entityLabel={task.code || task.title}
        onSuccess={(message) => {
          removeTaskLocally(task.id)
          onFeedback({ variant: "success", message })
        }}
      />
    </>
  )
}
