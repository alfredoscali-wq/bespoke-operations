"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

import { WorkOrderAdminSoftDeleteDialog } from "@/components/tareas/work-order-admin-soft-delete-dialog"
import { useTasks } from "@/components/tareas/tasks-provider"
import { Button } from "@/components/ui/button"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import type { Task } from "@/lib/types/tasks"

type TaskAdminArchivePermanentDeleteProps = {
  task: Task
  onSuccess: (message: string) => void
}

/**
 * Archivo OT — Admin soft-delete via the same dialog + deleteTask(administration)
 * flow used in TaskRowActions.
 */
export function TaskAdminArchivePermanentDelete({
  task,
  onSuccess,
}: TaskAdminArchivePermanentDeleteProps) {
  const { deleteTask } = useTasks()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taskLabel = task.code?.trim() || task.title?.trim() || task.id

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
    onSuccess("Orden de trabajo eliminada definitivamente.")
  }

  return (
    <>
      <div className="flex justify-end border-t pt-6">
        <Button
          type="button"
          variant="destructive"
          className="gap-1.5"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          <Trash2 className="size-4" />
          Eliminar definitivamente
        </Button>
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
