"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type WorkOrderVencidaDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  isSubmitting?: boolean
  error?: string | null
}

export function WorkOrderVencidaDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
  error = null,
}: WorkOrderVencidaDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Eliminar esta OT?</DialogTitle>
          <DialogDescription>
            Esta OT está vencida y dejará de aparecer en los listados operativos.
            {error ? (
              <span className="mt-2 block text-destructive">{error}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
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
            onClick={() => {
              void onConfirm()
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Eliminando..." : "Eliminar OT"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
