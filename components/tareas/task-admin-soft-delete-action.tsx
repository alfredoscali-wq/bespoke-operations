"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

import { ForceDeleteAction } from "@/components/admin/force-delete-action"
import { useTasks } from "@/components/tareas/tasks-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import { canSoftDeleteWorkOrder } from "@/lib/tasks/work-order-deletion-policy"
import type { Task } from "@/lib/types/tasks"

type TaskAdminSoftDeleteActionProps = {
  task: Task
}

/** Soft-delete + admin force-delete on OT detail. */
export function TaskAdminSoftDeleteAction({
  task,
}: TaskAdminSoftDeleteActionProps) {
  const router = useRouter()
  const { deleteTask, removeTaskLocally } = useTasks()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const canDelete = canSoftDeleteWorkOrder(task)
  const taskLabel =
    formatTaskAdminDisplayCode(task.code) || task.title?.trim() || task.id

  async function handleConfirmDelete() {
    setIsDeleting(true)
    const result = await deleteTask(task.id)
    setIsDeleting(false)

    if (!result.success) {
      return
    }

    setOpen(false)
    removeTaskLocally(task.id)
    router.back()
  }

  function handleForceDeleteSuccess() {
    removeTaskLocally(task.id)
    router.back()
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-6">
        <ForceDeleteAction
          entityType="task"
          entityId={task.id}
          entityLabel={taskLabel}
          onSuccess={handleForceDeleteSuccess}
        />

        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="size-4" />
            Eliminar
          </Button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Orden de Trabajo</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta orden de trabajo?
              <span className="font-medium text-foreground"> {task.title}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleConfirmDelete()
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
