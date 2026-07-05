"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

import { requestPermanentDelete } from "@/lib/admin/permanent-delete.client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type WorkOrderPermanentDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskLabel: string
  onSuccess: (message: string) => void
}

export function WorkOrderPermanentDeleteDialog({
  open,
  onOpenChange,
  taskId,
  taskLabel,
  onSuccess,
}: WorkOrderPermanentDeleteDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleConfirm() {
    setError(null)
    setIsSubmitting(true)

    try {
      const result = await requestPermanentDelete({
        entityType: "task",
        entityId: taskId,
      })

      if (!result.success) {
        setError(
          result.message ?? "No se pudo eliminar definitivamente la orden de trabajo."
        )
        return
      }

      onSuccess(`Orden de trabajo ${taskLabel} eliminada definitivamente.`)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Eliminar definitivamente la Orden de Trabajo</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Esta acción eliminará permanentemente toda la información
                relacionada con esta Orden de Trabajo.
              </p>
              <p>Se eliminarán:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Orden de Trabajo</li>
                <li>Checklist</li>
                <li>Fotografías de referencia</li>
                <li>Fotografías operativas</li>
                <li>Evidencias</li>
                <li>Incidencias</li>
                <li>Metadatos relacionados</li>
              </ul>
              <p className="font-medium text-destructive">
                Esta acción no puede deshacerse.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="gap-1.5"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            <Trash2 className="size-4" />
            {isSubmitting ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
