"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

import { WorkOrderPermanentDeleteDialog } from "@/components/tareas/work-order-permanent-delete-dialog"
import { Button } from "@/components/ui/button"
import type { Task } from "@/lib/types/tasks"

type TaskAdminArchivePermanentDeleteProps = {
  task: Task
  onSuccess: (message: string) => void
}

export function TaskAdminArchivePermanentDelete({
  task,
  onSuccess,
}: TaskAdminArchivePermanentDeleteProps) {
  const [open, setOpen] = useState(false)
  const taskLabel = task.code?.trim() || task.title?.trim() || task.id

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
          Eliminar definitivamente
        </Button>
      </div>

      <WorkOrderPermanentDeleteDialog
        open={open}
        onOpenChange={setOpen}
        taskId={task.id}
        taskLabel={taskLabel}
        onSuccess={onSuccess}
      />
    </>
  )
}
