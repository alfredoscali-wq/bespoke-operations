"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Ban,
  CalendarClock,
  Eye,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  TaskCrewAssignDialog,
  TaskEditDialog,
  TaskStatusDialog,
} from "@/components/tareas/task-action-dialogs"
import { TaskWorkOrderDialog } from "@/components/tareas/task-work-order-dialog"
import { TaskIncidentCancelDialog } from "@/components/tareas/task-incident-cancel-dialog"
import { WorkOrderPermanentDeleteDialog } from "@/components/tareas/work-order-permanent-delete-dialog"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"
import { canAssignWorkOrderCrew } from "@/lib/tasks/task-closure-permissions"
import { resolveCrewSnapshotsForAssignment } from "@/lib/tasks/crew-relation"
import {
  canSoftDeleteWorkOrder,
  resolveWorkOrderRowMenuPolicy,
  WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
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
  const {
    editTask,
    changeTaskStatus,
    deleteTask,
    assignCrew,
    cancelTask,
    reopenPlanningTasks,
    removeTaskLocally,
    tasks,
  } = useTasks()
  const { sessionUser } = useAuth()
  const { getCrew, crews } = useCrews()
  const isSystemAdministrator = useIsSystemAdministrator()
  const canAssignCrew = canAssignWorkOrderCrew(sessionUser?.systemRole)
  const isWorkOrder = isWorkOrderTask(task)
  const menuPolicy = isWorkOrder ? resolveWorkOrderRowMenuPolicy(task) : null

  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [crewOpen, setCrewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isReopeningPlanning, setIsReopeningPlanning] = useState(false)

  const hideInternalStatusActions = operationalMode || isWorkOrder
  const useWorkOrderEditForm = isWorkOrder
  const canSoftDelete = isWorkOrder
    ? menuPolicy?.showSoftDelete ?? false
    : canSoftDeleteWorkOrder(task.status)

  async function handleUpdateWorkOrder(
    taskId: string,
    payload: UpdateTaskPayload
  ) {
    const result = await editTask(taskId, payload)

    if (!result.success) {
      throw new Error(
        result.message ?? "No se pudo actualizar la orden de trabajo."
      )
    }

    onFeedback({
      variant: "success",
      message: "Orden de trabajo actualizada correctamente.",
    })

    return result.task ?? task
  }

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
      snapshots.supervisor,
      { promoteToAssigned: true }
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

  async function handleReopenPlanning() {
    setIsReopeningPlanning(true)
    const result = await reopenPlanningTasks([task.id], crews)
    setIsReopeningPlanning(false)

    if (!result.success) {
      onFeedback({
        variant: "error",
        message: result.message ?? "No se pudo modificar la planificación.",
      })
      return
    }

    onFeedback({
      variant: "success",
      message: "Planificación reabierta para replanificación.",
    })
  }

  async function handleConfirmDelete() {
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

  const viewHref = `/tareas/${task.id}`
  const viewLabel = menuPolicy?.viewLabel ?? "Ver detalle"

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
          {(menuPolicy?.showView ?? true) ? (
            <DropdownMenuItem asChild>
              <Link href={viewHref}>
                <Eye className="size-4" />
                {viewLabel}
              </Link>
            </DropdownMenuItem>
          ) : null}

          {(menuPolicy?.showEdit ?? !hideInternalStatusActions) ? (
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
          ) : null}

          {!hideInternalStatusActions ? (
            <DropdownMenuItem onClick={() => setStatusOpen(true)}>
              <RefreshCw className="size-4" />
              Cambiar estado
            </DropdownMenuItem>
          ) : null}

          {(menuPolicy?.showAssignCrew ?? canAssignCrew) && canAssignCrew ? (
            <DropdownMenuItem onClick={() => setCrewOpen(true)}>
              <Users className="size-4" />
              Reasignar cuadrilla
            </DropdownMenuItem>
          ) : null}

          {menuPolicy?.showReopenPlanning ? (
            <DropdownMenuItem
              onClick={() => void handleReopenPlanning()}
              disabled={isReopeningPlanning}
            >
              <CalendarClock className="size-4" />
              Replanificar planificación
            </DropdownMenuItem>
          ) : null}

          {menuPolicy?.showCancel ? (
            <DropdownMenuItem
              onClick={() => setCancelOpen(true)}
              disabled={isCancelling}
            >
              <Ban className="size-4" />
              Cancelar
            </DropdownMenuItem>
          ) : null}

          {canSoftDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Eliminar
              </DropdownMenuItem>
            </>
          ) : null}

          {isSystemAdministrator && isWorkOrder ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setPermanentDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Eliminar definitivamente
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskWorkOrderDialog
        open={editOpen && useWorkOrderEditForm}
        onOpenChange={setEditOpen}
        existingTasks={tasks}
        mode="edit"
        task={task}
        onUpdate={handleUpdateWorkOrder}
      />

      <TaskEditDialog
        open={editOpen && !useWorkOrderEditForm}
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

      {menuPolicy?.showCancel ? (
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
              {!canSoftDelete && (
                <span className="mt-2 block text-destructive">
                  {WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE}
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
              disabled={isDeleting || !canSoftDelete}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkOrderPermanentDeleteDialog
        open={permanentDeleteOpen}
        onOpenChange={setPermanentDeleteOpen}
        taskId={task.id}
        taskLabel={task.code || task.title}
        onSuccess={(message) => {
          removeTaskLocally(task.id)
          onFeedback({ variant: "success", message })
        }}
      />
    </>
  )
}
