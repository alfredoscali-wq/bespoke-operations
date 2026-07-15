"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

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
import { canSoftDeleteWorkOrder } from "@/lib/tasks/work-order-deletion-policy"
import type { Task } from "@/lib/types/tasks"

type TaskAdminSoftDeleteActionProps = {
  task: Task
}

/** Soft-delete on OT detail — same confirmation dialog as list row actions. */
export function TaskAdminSoftDeleteAction({
  task,
}: TaskAdminSoftDeleteActionProps) {
  const router = useRouter()
  const { deleteTask, removeTaskLocally } = useTasks()
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const canDelete = canSoftDeleteWorkOrder(task)

  if (!canDelete) {
    return null
  }

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

  return (
    <>
      <div className="flex justify-end border-t pt-6">
        <Button
          type="button"
          variant="destructive"
          className="gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" />
          Eliminar
        </Button>
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
