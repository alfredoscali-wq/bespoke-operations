"use client"

import { DeletePermanentDialog } from "@/components/admin/delete-permanent-dialog"

type WorkOrderPermanentDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskLabel: string
  onSuccess: (message: string) => void
}

/** @deprecated Prefer DeletePermanentDialog with entityType="task". */
export function WorkOrderPermanentDeleteDialog({
  open,
  onOpenChange,
  taskId,
  taskLabel,
  onSuccess,
}: WorkOrderPermanentDeleteDialogProps) {
  return (
    <DeletePermanentDialog
      open={open}
      onOpenChange={onOpenChange}
      entityType="task"
      entityId={taskId}
      entityLabel={taskLabel}
      onSuccess={onSuccess}
    />
  )
}
