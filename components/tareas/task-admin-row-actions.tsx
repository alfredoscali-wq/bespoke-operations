"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, Pencil, Trash2 } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskWorkOrderDialog } from "@/components/tareas/task-work-order-dialog"
import { WorkOrderAdminSoftDeleteDialog } from "@/components/tareas/work-order-admin-soft-delete-dialog"
import { useAuth } from "@/components/auth/auth-provider"
import {
  canAdminModifyWorkOrder,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_TOOLTIP,
} from "@/lib/tasks/work-order-admin-mutation"
import {
  canShowAdminSoftDeleteInArchive,
  canSoftDeleteWorkOrder,
  WORK_ORDER_SOFT_DELETE_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-deletion-policy"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
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
  const { editTask, deleteTask, removeTaskLocally, tasks } = useTasks()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editBlockedOpen, setEditBlockedOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const viewHref = detailHref ?? `/tareas/${task.id}`

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

  const canModify = canAdminModifyWorkOrder(task.status)
  const canDelete = canSoftDeleteWorkOrder(task)

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

        <AdminRowActionButton
          label="Editar"
          disabled={!canModify}
          tooltip={WORK_ORDER_ADMIN_MUTATION_BLOCKED_TOOLTIP}
          onClick={handleEditClick}
        >
          <Pencil className="size-4" />
        </AdminRowActionButton>

        {canDelete ? (
          <AdminRowActionButton
            label="Eliminar"
            destructive
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </AdminRowActionButton>
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

      <Dialog open={editBlockedOpen} onOpenChange={setEditBlockedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edición no disponible</DialogTitle>
            <DialogDescription>
              {WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE}
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
