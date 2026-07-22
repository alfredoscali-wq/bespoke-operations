"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskWorkOrderDialog } from "@/components/tareas/task-work-order-dialog"
import { TaskRescheduleDialog } from "@/components/tareas/task-reschedule-dialog"
import { WorkOrderAdminSoftDeleteDialog } from "@/components/tareas/work-order-admin-soft-delete-dialog"
import { ForceDeleteAction } from "@/components/admin/force-delete-action"
import {
  canAdminModifyWorkOrderTask,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_TOOLTIP,
  WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_MESSAGE,
  WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_TOOLTIP,
} from "@/lib/tasks/work-order-admin-mutation"
import {
  canShowAdminSoftDeleteInArchive,
  canSoftDeleteWorkOrder,
  WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { hasActivePlanningReturn } from "@/lib/tasks/planning-return"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { CalendarClock, Eye, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

type TaskAdminRowActionsProps = {
  task: Task
  onFeedback: (input: {
    variant: "success" | "error"
    message: string
  }) => void
  readOnly?: boolean
  detailHref?: string
}

function AdminRowActionButton({
  label,
  disabled,
  tooltip,
  onClick,
  destructive = false,
  children,
}: {
  label: string
  disabled?: boolean
  tooltip?: string
  onClick?: () => void
  destructive?: boolean
  children: React.ReactNode
}) {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={
        destructive
          ? "size-8 text-destructive hover:text-destructive disabled:text-muted-foreground disabled:opacity-50"
          : "size-8 disabled:text-muted-foreground disabled:opacity-50"
      }
      title={disabled ? undefined : label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Button>
  )

  if (!disabled || !tooltip) {
    return button
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

/** Archivo OT list — same admin soft-delete flow as TaskRowActions / detail. */
function TaskAdminArchiveRowActions({
  task,
  viewHref,
  systemRole,
  deleteTask,
  removeTaskLocally,
  onFeedback,
}: {
  task: Task
  viewHref: string
  systemRole: string | null | undefined
  deleteTask: (
    id: string,
    options?: { administration?: boolean }
  ) => Promise<{ success: boolean; message?: string }>
  removeTaskLocally: (id: string) => void
  onFeedback: TaskAdminRowActionsProps["onFeedback"]
}) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taskLabel = task.code?.trim() || task.title?.trim() || task.id
  const canSoftDelete = canShowAdminSoftDeleteInArchive(systemRole, task.status)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)

    const result = await deleteTask(task.id, { administration: true })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message ?? TASK_DELETE_USER_MESSAGE)
      return
    }

    setOpen(false)
    removeTaskLocally(task.id)
    onFeedback({
      variant: "success",
      message: "Orden de trabajo eliminada definitivamente.",
    })
  }

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          asChild
          title="Ver detalle"
        >
          <Link href={viewHref}>
            <Eye className="size-4" />
            <span className="sr-only">Ver detalle</span>
          </Link>
        </Button>

        {canSoftDelete ? (
          <AdminRowActionButton
            label="Eliminar definitivamente"
            destructive
            onClick={() => {
              setError(null)
              setOpen(true)
            }}
          >
            <Trash2 className="size-4" />
          </AdminRowActionButton>
        ) : null}

        <ForceDeleteAction
          entityType="task"
          entityId={task.id}
          entityLabel={taskLabel}
          presentation="icon"
          onSuccess={(message) => {
            removeTaskLocally(task.id)
            onFeedback({ variant: "success", message })
          }}
        />
      </div>

      <WorkOrderAdminSoftDeleteDialog
        open={open}
        onOpenChange={setOpen}
        taskLabel={taskLabel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        error={error}
      />
    </>
  )
}

export function TaskAdminRowActions({
  task,
  onFeedback,
  readOnly = false,
  detailHref,
}: TaskAdminRowActionsProps) {
  const { sessionUser } = useAuth()
  const { editTask, deleteTask, removeTaskLocally, tasks, reschedulePlanningReturnedTask } =
    useTasks()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editBlockedOpen, setEditBlockedOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRescheduling, setIsRescheduling] = useState(false)

  const viewHref = detailHref ?? `/tareas/${task.id}`
  const showPlanningReturnReschedule = hasActivePlanningReturn(task)
  const actorName = sessionUser?.displayName?.trim() || "Usuario"

  if (readOnly) {
    return (
      <TaskAdminArchiveRowActions
        task={task}
        viewHref={viewHref}
        systemRole={sessionUser?.systemRole}
        deleteTask={deleteTask}
        removeTaskLocally={removeTaskLocally}
        onFeedback={onFeedback}
      />
    )
  }

  const canModify = canAdminModifyWorkOrderTask(task)
  const canDelete = canSoftDeleteWorkOrder(task)
  const isPlanningReturnTray = showPlanningReturnReschedule
  const editBlockedTooltip = isPlanningReturnTray
    ? WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_TOOLTIP
    : WORK_ORDER_ADMIN_MUTATION_BLOCKED_TOOLTIP
  const taskLabel =
    formatTaskAdminDisplayCode(task.code) || task.title?.trim() || task.id

  function handleForceDeleteSuccess(message: string) {
    removeTaskLocally(task.id)
    onFeedback({
      variant: "success",
      message,
    })
  }

  function handleEditClick() {
    if (!canModify) {
      return
    }

    setEditOpen(true)
  }

  async function handleUpdateWorkOrder(
    taskId: string,
    payload: UpdateTaskPayload
  ) {
    const result = await editTask(taskId, payload, { administration: true })

    if (!result.success) {
      throw new Error(
        result.message ?? "No se pudo actualizar la orden de trabajo."
      )
    }

    return result.task ?? task
  }

  function handleWorkOrderUpdated() {
    onFeedback({
      variant: "success",
      message: "Orden de trabajo actualizada correctamente.",
    })
  }

  async function handleConfirmDelete() {
    setIsDeleting(true)
    const result = await deleteTask(task.id, { administration: true })
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

  async function handlePlanningReturnReschedule(input: TaskRescheduleInput) {
    setIsRescheduling(true)
    const result = await reschedulePlanningReturnedTask(task.id, {
      ...input,
      actor: actorName,
    })
    setIsRescheduling(false)

    if (!result.success) {
      onFeedback({
        variant: "error",
        message: result.message ?? "No se pudo reprogramar la orden de trabajo.",
      })
      return
    }

    setRescheduleOpen(false)
    onFeedback({
      variant: "success",
      message: "Orden de trabajo reprogramada correctamente.",
    })
  }

  return (
    <>
      <div className="flex items-center justify-end gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          asChild
          title="Ver detalle"
        >
          <Link href={viewHref}>
            <Eye className="size-4" />
            <span className="sr-only">Ver detalle</span>
          </Link>
        </Button>

        {showPlanningReturnReschedule ? (
          <AdminRowActionButton
            label="Reprogramar"
            onClick={() => setRescheduleOpen(true)}
          >
            <CalendarClock className="size-4" />
          </AdminRowActionButton>
        ) : null}

        {!isPlanningReturnTray ? (
          <AdminRowActionButton
            label="Editar"
            disabled={!canModify}
            tooltip={editBlockedTooltip}
            onClick={handleEditClick}
          >
            <Pencil className="size-4" />
          </AdminRowActionButton>
        ) : null}

        {!isPlanningReturnTray && canDelete ? (
          <AdminRowActionButton
            label="Eliminar"
            destructive
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </AdminRowActionButton>
        ) : null}

        {!isPlanningReturnTray ? (
          <ForceDeleteAction
            entityType="task"
            entityId={task.id}
            entityLabel={taskLabel}
            presentation="icon"
            onSuccess={handleForceDeleteSuccess}
          />
        ) : null}
      </div>

      <TaskWorkOrderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existingTasks={tasks}
        mode="edit"
        task={task}
        onUpdate={handleUpdateWorkOrder}
        onTaskUpdated={handleWorkOrderUpdated}
        onEditBlocked={() => setEditBlockedOpen(true)}
      />

      <TaskRescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        task={task}
        rescheduledBy={actorName}
        description="Seleccione una nueva fecha. Al confirmar, la OT deja el KPI Devueltas por Planificación y vuelve al flujo normal."
        isSubmitting={isRescheduling}
        onConfirm={handlePlanningReturnReschedule}
      />

      <Dialog open={editBlockedOpen} onOpenChange={setEditBlockedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edición no disponible</DialogTitle>
            <DialogDescription>
              {isPlanningReturnTray
                ? WORK_ORDER_PLANNING_RETURN_EDIT_BLOCKED_MESSAGE
                : WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setEditBlockedOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Orden de Trabajo</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta orden de trabajo?
              <span className="font-medium text-foreground"> {task.title}</span>
              {!canDelete ? (
                <span className="mt-2 block text-destructive">
                  {WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE}
                </span>
              ) : null}
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
              disabled={isDeleting || !canDelete}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
